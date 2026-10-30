"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sendDigestNow, type DigestKind } from "@/lib/digest";
import { runJobDetached } from "@/lib/job-runner";
import { listMunicipalities } from "@/lib/ibge";
import { INDICATORS } from "@/lib/indicators/catalog";
import { syncUf } from "@/lib/politicians/sync";
import { PARTIES } from "@/lib/quiz/data";
import { UFS } from "@/lib/taxonomy";
import { getDbUser } from "@/lib/user";

export async function saveLocation(formData: FormData) {
  const user = await getDbUser();
  const uf = String(formData.get("uf") ?? "").toUpperCase();
  const city = String(formData.get("municipality") ?? "");
  if (!(uf in UFS)) redirect("/onboarding?erro=uf");
  const list = await listMunicipalities(uf);
  const match = list.find((m) => m.name === city);
  if (!match) redirect(`/onboarding?erro=municipio&uf=${uf}`);
  await db.user.update({ where: { id: user.id }, data: { uf, municipality: match.name, municipalityKey: match.key } });
  // carrega eleitos da UF em segundo plano (download do TSE leva alguns segundos)
  syncUf(uf).catch((e) => console.warn("[syncUf]", (e as Error).message));
  // coleta já as notícias da cidade escolhida, sem esperar a próxima hora cheia
  runJobDetached("ingest").catch(() => undefined);
  runJobDetached("budget").catch(() => undefined); // já deixa o orçamento da cidade em cache
  runJobDetached("indicators").catch(() => undefined); // e os indicadores
  revalidatePath("/", "layout");
  redirect("/");
}

/** Tiers marcados (1-3) como "1,2"; se nenhum estiver marcado, vale todos. */
function tiersOf(formData: FormData, name: string): string {
  const t = [...new Set(formData.getAll(name).map(Number).filter((n) => [1, 2, 3].includes(n)))].sort();
  return (t.length ? t : [1, 2, 3]).join(",");
}

export async function savePrefs(formData: FormData) {
  const user = await getDbUser();
  await db.user.update({
    where: { id: user.id },
    data: {
      dailyDigest: formData.get("dailyDigest") === "on",
      weeklyDigest: formData.get("weeklyDigest") === "on",
      monthlyDigest: formData.get("monthlyDigest") === "on",
      digestTiersDaily: tiersOf(formData, "tiers_daily"),
      digestTiersWeekly: tiersOf(formData, "tiers_weekly"),
      digestTiersMonthly: tiersOf(formData, "tiers_monthly"),
      alertEmails: formData.get("alertEmails") === "on",
    },
  });
  revalidatePath("/configuracoes");
}

export async function sendTestDigest(kind: DigestKind = "daily") {
  const user = await getDbUser();
  const r = await sendDigestNow(user, kind);
  redirect(`/configuracoes?digest=${r === true ? "ok" : r === "empty" ? "vazio" : "erro"}`);
}

export async function toggleFavorite(articleId: string) {
  const user = await getDbUser();
  const key = { userId_articleId: { userId: user.id, articleId } };
  const exists = await db.favorite.findUnique({ where: key });
  if (exists) await db.favorite.delete({ where: key });
  else await db.favorite.create({ data: { userId: user.id, articleId } });
  revalidatePath("/", "layout");
}

export async function toggleFollow(politicianId: string) {
  const user = await getDbUser();
  const key = { userId_politicianId: { userId: user.id, politicianId } };
  const exists = await db.follow.findUnique({ where: key });
  if (exists) await db.follow.delete({ where: key });
  else await db.follow.create({ data: { userId: user.id, politicianId } });
  revalidatePath("/", "layout");
}

export async function togglePoliticianAlert(politicianId: string) {
  const user = await getDbUser();
  const existing = await db.alert.findFirst({ where: { userId: user.id, politicianId } });
  if (existing) await db.alert.delete({ where: { id: existing.id } });
  else await db.alert.create({ data: { userId: user.id, politicianId } });
  revalidatePath("/", "layout");
}

export async function createKeywordAlert(formData: FormData) {
  const user = await getDbUser();
  const keyword = String(formData.get("keyword") ?? "").trim().slice(0, 80);
  if (keyword.length < 3) return;
  const count = await db.alert.count({ where: { userId: user.id } });
  if (count >= 50) return;
  const dup = await db.alert.findFirst({ where: { userId: user.id, keyword: { equals: keyword, mode: "insensitive" } } });
  if (!dup) await db.alert.create({ data: { userId: user.id, keyword } });
  revalidatePath("/alertas");
}

export async function toggleAlert(alertId: string) {
  const user = await getDbUser();
  const alert = await db.alert.findFirst({ where: { id: alertId, userId: user.id } });
  if (alert) await db.alert.update({ where: { id: alertId }, data: { active: !alert.active } });
  revalidatePath("/alertas");
}

export async function deleteAlert(alertId: string) {
  const user = await getDbUser();
  await db.alert.deleteMany({ where: { id: alertId, userId: user.id } });
  revalidatePath("/alertas");
}

export async function loadUfData() {
  const user = await getDbUser();
  if (user.uf) await syncUf(user.uf);
  revalidatePath("/representantes");
}

/** Define o partido do usuário (sigla do app) ou "NONE" (não tenho partido). */
export async function setMyParty(formData: FormData) {
  const user = await getDbUser();
  const sigla = String(formData.get("party") ?? "");
  const back = String(formData.get("back") ?? "/partidos");
  const ok = sigla === "NONE" || PARTIES.some((p) => p.sigla === sigla);
  if (ok) await db.user.update({ where: { id: user.id }, data: { party: sigla } });
  revalidatePath("/partidos", "layout");
  redirect(back.startsWith("/") ? back : "/partidos");
}

/** Guarda o resultado do quiz de perfil político do usuário. */
export async function saveQuiz(answers: Record<string, string>, weights: Record<string, number>): Promise<{ ok: boolean }> {
  const user = await getDbUser();
  const cleanA: Record<string, string> = {};
  for (let n = 1; n <= 12; n++) {
    const v = answers[String(n)];
    if (v === "a" || v === "b" || v === "c" || (n === 12 && v === "x")) cleanA[String(n)] = v;
  }
  if (Object.keys(cleanA).length < 12) return { ok: false };
  const cleanW: Record<string, number> = {};
  for (const k of ["economia", "costumes", "seguranca", "ambiente", "educacao", "estilo"]) {
    const w = Number(weights[k]);
    cleanW[k] = [0, 1, 2, 3].includes(w) ? w : 2;
  }
  await db.user.update({ where: { id: user.id }, data: { quizAnswers: cleanA, quizWeights: cleanW, quizAt: new Date() } });
  return { ok: true };
}

/** Igual a setMyParty, mas sem redirecionar (usado no fim do quiz). */
export async function saveMyParty(sigla: string): Promise<{ ok: boolean }> {
  const user = await getDbUser();
  if (!(sigla === "NONE" || PARTIES.some((p) => p.sigla === sigla))) return { ok: false };
  await db.user.update({ where: { id: user.id }, data: { party: sigla } });
  revalidatePath("/partidos", "layout");
  return { ok: true };
}

/** Salva o setup do score do usuário: indicadores de uma esfera, metas personalizadas (nulo = volta à meta fixa) e método. */
export async function saveScoreSetup(
  scope: "FEDERAL" | "ESTADUAL" | "MUNICIPAL",
  input: { ids: string[]; targets: Record<string, number | null>; method: "nivel" | "nivel-avanco" },
): Promise<{ ok: boolean }> {
  const user = await getDbUser();
  if (!["FEDERAL", "ESTADUAL", "MUNICIPAL"].includes(scope)) return { ok: false };
  const valid = new Set(INDICATORS.filter((i) => i.better).map((i) => i.id));
  const prev = (user.scoreConfig ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...prev };
  const ids = [...new Set(input.ids)].filter((id) => valid.has(id));
  if (ids.length) next[scope] = ids;
  else delete next[scope];
  const targets = { ...((prev.targets as Record<string, number> | undefined) ?? {}) };
  for (const [id, v] of Object.entries(input.targets)) {
    if (!valid.has(id)) continue;
    if (v == null || !Number.isFinite(v)) delete targets[id];
    else targets[id] = v;
  }
  next.targets = targets;
  next.method = input.method === "nivel-avanco" ? "nivel-avanco" : "nivel";
  await db.user.update({ where: { id: user.id }, data: { scoreConfig: next as never } });
  revalidatePath("/score");
  return { ok: true };
}
