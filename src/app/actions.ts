"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sendDigestNow, type DigestKind } from "@/lib/digest";
import { runJob } from "@/lib/jobs";
import { listMunicipalities } from "@/lib/ibge";
import { syncUf } from "@/lib/politicians/sync";
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
  runJob("ingest").catch(() => undefined);
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
