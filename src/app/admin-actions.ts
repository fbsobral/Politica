"use server";

import { randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { JOBS, runJob, type JobName } from "@/lib/jobs";
import { requireAdmin } from "@/lib/user";

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  name: z.string().trim().max(120).optional(),
  role: z.enum(["USER", "ADMIN"]),
  mode: z.enum(["convite", "senha"]),
  password: z.string().optional(),
});

function back(kind: "ok" | "erro", msg: string): never {
  redirect(`/admin/usuarios?${kind}=${encodeURIComponent(msg)}`);
}

function clerkMessage(err: unknown): string {
  const e = err as { errors?: { longMessage?: string; message?: string }[]; message?: string };
  return e.errors?.[0]?.longMessage ?? e.errors?.[0]?.message ?? e.message ?? "Erro desconhecido";
}

export async function createUser(formData: FormData) {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
    role: formData.get("role"),
    mode: formData.get("mode"),
    password: formData.get("password") || undefined,
  });
  if (!parsed.success) back("erro", parsed.error.issues[0].message);
  const { email, name, role, mode, password } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) back("erro", "Já existe um usuário com esse e-mail.");
  if (mode === "senha" && (!password || password.length < 8)) back("erro", "A senha precisa ter pelo menos 8 caracteres.");

  const clerk = await clerkClient();
  try {
    if (mode === "senha") {
      const [firstName, ...rest] = (name ?? "").split(" ");
      const cu = await clerk.users.createUser({
        emailAddress: [email],
        password,
        firstName: firstName || undefined,
        lastName: rest.join(" ") || undefined,
      });
      await db.user.create({ data: { clerkId: cu.id, email, name: name || null, role } });
    } else {
      await clerk.invitations.createInvitation({ emailAddress: email, redirectUrl: `${appUrl()}/sign-up`, ignoreExisting: true });
      // pré-cadastro: o primeiro login desse e-mail assume este registro (e o papel definido aqui)
      await db.user.create({ data: { clerkId: `pending:${randomUUID()}`, email, name: name || null, role } });
    }
  } catch (err) {
    back("erro", clerkMessage(err));
  }
  revalidatePath("/admin/usuarios");
  back("ok", mode === "senha" ? `Usuário ${email} criado.` : `Convite enviado para ${email}.`);
}

export async function setRole(userId: string, role: "USER" | "ADMIN") {
  const admin = await requireAdmin();
  if (userId === admin.id) back("erro", "Você não pode alterar o seu próprio papel.");
  await db.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/usuarios");
  back("ok", "Papel atualizado.");
}

export async function deleteUser(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.id) back("erro", "Você não pode excluir a si mesmo.");
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) back("erro", "Usuário não encontrado.");
  if (target.role === "ADMIN" && (await db.user.count({ where: { role: "ADMIN" } })) <= 1) back("erro", "Não é possível excluir o último administrador.");
  if (!target.clerkId.startsWith("pending:")) {
    try {
      await (await clerkClient()).users.deleteUser(target.clerkId);
    } catch (err) {
      console.warn("[admin] falha ao excluir no Clerk:", clerkMessage(err));
    }
  }
  await db.user.delete({ where: { id: userId } });
  revalidatePath("/admin/usuarios");
  back("ok", `Usuário ${target.email} excluído.`);
}

export async function runJobNow(job: string) {
  await requireAdmin();
  if (!(job in JOBS)) return;
  runJob(job as JobName).catch(() => undefined); // em segundo plano
  revalidatePath("/admin/robo");
  redirect("/admin/robo?iniciado=" + encodeURIComponent(job));
}

// ───────── Configuração do robô ─────────
import { saveSettings, SETTING_DEFAULTS, SETTING_GROUPS, type SettingGroup, type Settings } from "@/lib/settings";
import { probeFeed } from "@/lib/news/ingest";
import { normalize } from "@/lib/text";
import { UFS } from "@/lib/taxonomy";

function go(kind: "ok" | "erro", msg: string, path = "/admin"): never {
  redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);
}

/** Destino pós-ação vindo do formulário (`_back`), restrito ao painel admin. */
function backOf(formData: FormData, fallback: string): string {
  const b = String(formData.get("_back") ?? "");
  return /^\/admin(\/[a-z-]*)?$/.test(b) ? b : fallback;
}

/** Salva só as configurações presentes no formulário (cada página do admin edita um grupo). */
export async function saveRobotSettings(formData: FormData) {
  await requireAdmin();
  const values: Partial<Settings> = {};
  for (const key of Object.keys(SETTING_DEFAULTS) as (keyof Settings)[]) {
    if (formData.has(`__cb_${key}`)) values[key] = formData.get(key) === "on" ? "1" : "0";
    else if (formData.has(key)) values[key] = String(formData.get(key) ?? "").trim();
  }
  const num = (v: string | undefined, min: number, max: number, def: string) => String(Math.min(max, Math.max(min, v === undefined || v === "" || Number.isNaN(Number(v)) ? Number(def) : Number(v))));
  if (values.maxAgeDays !== undefined) values.maxAgeDays = num(values.maxAgeDays, 0, 365, SETTING_DEFAULTS.maxAgeDays);
  if (values.ingestIntervalMinutes !== undefined) values.ingestIntervalMinutes = num(values.ingestIntervalMinutes, 10, 1440, SETTING_DEFAULTS.ingestIntervalMinutes);
  if (values.localMaxAgeDays !== undefined) values.localMaxAgeDays = num(values.localMaxAgeDays, 0, 365, SETTING_DEFAULTS.localMaxAgeDays);
  if (values.retentionDays !== undefined) values.retentionDays = num(values.retentionDays, 0, 3650, SETTING_DEFAULTS.retentionDays);
  await saveSettings(values);
  const back = backOf(formData, "/admin/robo");
  revalidatePath(back);
  go("ok", "Configuração salva. Vale na próxima coleta (ou use “Coletar notícias agora” no Robô).", back);
}

/** Restaura o padrão apenas do grupo de configurações da página (não mexe nos marcadores internos). */
export async function resetRobotSettings(formData: FormData) {
  await requireAdmin();
  const group = String(formData.get("_group") ?? "") as SettingGroup;
  const keys = SETTING_GROUPS[group];
  if (!keys) go("erro", "Grupo de configurações inválido.");
  await db.setting.deleteMany({ where: { key: { in: [...keys] } } });
  const back = backOf(formData, "/admin/robo");
  revalidatePath(back);
  go("ok", "Configuração restaurada para o padrão.", back);
}

const feedSchema = z.object({
  name: z.string().trim().min(2).max(80),
  feedUrl: z.string().trim().url("URL inválida"),
  category: z.enum(["PORTAL_NACIONAL", "JORNAL", "REVISTA", "TV", "RADIO", "AGENCIA_NOTICIAS", "ORGAO_OFICIAL", "REGIONAL", "BLOG_INDEPENDENTE", "OUTRO"]),
  scope: z.enum(["MUNICIPAL", "ESTADUAL", "FEDERAL"]),
  branch: z.enum(["", "LEGISLATIVO", "EXECUTIVO", "JUDICIARIO"]),
  uf: z.string().trim().toUpperCase().optional(),
  municipality: z.string().trim().optional(),
});

function goFeeds(k: "ok" | "erro", m: string): never {
  return go(k, m, "/admin/feeds");
}

export async function addFeed(formData: FormData) {
  await requireAdmin();
  const parsed = feedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) goFeeds("erro", parsed.error.issues[0].message);
  const d = parsed.data;
  if (d.scope !== "FEDERAL" && !(d.uf && d.uf in UFS)) goFeeds("erro", "Feeds estaduais e municipais precisam de um estado (UF) válido.");
  if (d.scope === "MUNICIPAL" && !d.municipality) goFeeds("erro", "Feeds municipais precisam do nome do município.");
  const probe = await probeFeed(d.feedUrl);
  if (!probe.ok) goFeeds("erro", `Não consegui ler esse feed: ${probe.error}`);
  try {
    await db.feedSource.create({
      data: {
        name: d.name,
        feedUrl: d.feedUrl,
        homepage: new URL(d.feedUrl).origin,
        category: d.category,
        scope: d.scope,
        branch: d.branch || null,
        uf: d.scope === "FEDERAL" ? null : d.uf,
        municipality: d.scope === "MUNICIPAL" ? d.municipality : null,
        municipalityKey: d.scope === "MUNICIPAL" ? normalize(d.municipality!) : null,
      },
    });
  } catch {
    goFeeds("erro", "Já existe um feed com esse nome ou essa URL.");
  }
  revalidatePath("/admin/feeds");
  goFeeds("ok", `Feed “${d.name}” adicionado (${probe.items} itens encontrados).`);
}

export async function toggleFeed(id: string) {
  await requireAdmin();
  const f = await db.feedSource.findUnique({ where: { id } });
  if (f) await db.feedSource.update({ where: { id }, data: { active: !f.active } });
  revalidatePath("/admin/feeds");
}

export async function deleteFeed(id: string) {
  await requireAdmin();
  await db.feedSource.deleteMany({ where: { id } });
  revalidatePath("/admin/feeds");
}

function goTiers(k: "ok" | "erro", m: string): never {
  return go(k, m, "/admin/veiculos");
}

export async function saveTiers(formData: FormData) {
  await requireAdmin();
  const ids = [...formData.keys()].filter((k) => k.startsWith("tier_")).map((k) => k.slice(5));
  const current = await db.source.findMany({ where: { id: { in: ids } }, select: { id: true, tier: true, tierBy: true } });
  let changed = 0;
  for (const s of current) {
    const raw = String(formData.get(`tier_${s.id}`) ?? "");
    const next = raw === "" ? null : Number(raw);
    if (next !== null && ![1, 2, 3].includes(next)) continue;
    if (next !== s.tier) {
      await db.source.update({ where: { id: s.id }, data: { tier: next, tierBy: next === null ? null : "admin" } });
      changed++;
    } else if (next !== null && s.tierBy !== "admin" && formData.get(`ok_${s.id}`) === "on") {
      await db.source.update({ where: { id: s.id }, data: { tierBy: "admin" } }); // confirmou a sugestão
    }
  }
  revalidatePath("/admin/veiculos");
  goTiers("ok", changed ? `${changed} veículo(s) atualizado(s).` : "Nenhuma mudança.");
}

function parseIds(formData: FormData): string[] {
  return formData.getAll("sel").map(String).filter(Boolean);
}

/** Aplica o mesmo tier a vários veículos de uma vez. */
export async function bulkApplyTiers(formData: FormData) {
  await requireAdmin();
  const ids = parseIds(formData);
  const raw = String(formData.get("bulkTier") ?? "");
  const tier = raw === "" ? null : Number(raw);
  if (!ids.length) goTiers("erro", "Marque pelo menos um veículo.");
  if (tier !== null && ![1, 2, 3].includes(tier)) goTiers("erro", "Tier inválido.");
  const r = await db.source.updateMany({ where: { id: { in: ids } }, data: { tier, tierBy: tier === null ? null : "admin" } });
  revalidatePath("/admin/veiculos");
  goTiers("ok", `${r.count} veículo(s) definidos como ${tier ? `Tier ${tier}` : "sem tier"}.`);
}

/** Confirma como definitivas as sugestões da IA dos veículos marcados. */
export async function bulkConfirmTiers(formData: FormData) {
  await requireAdmin();
  const ids = parseIds(formData);
  if (!ids.length) goTiers("erro", "Marque pelo menos um veículo.");
  const r = await db.source.updateMany({ where: { id: { in: ids }, tierBy: "ai" }, data: { tierBy: "admin" } });
  revalidatePath("/admin/veiculos");
  goTiers("ok", `${r.count} sugestão(ões) da IA confirmada(s).`);
}

/** Confirma TODAS as sugestões pendentes da IA. */
export async function confirmAllAiTiers() {
  await requireAdmin();
  const r = await db.source.updateMany({ where: { tierBy: "ai" }, data: { tierBy: "admin" } });
  revalidatePath("/admin/veiculos");
  goTiers("ok", `${r.count} sugestão(ões) da IA confirmada(s).`);
}
