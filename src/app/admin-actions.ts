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
import { saveSettings, SETTING_DEFAULTS, type Settings } from "@/lib/settings";
import { probeFeed } from "@/lib/news/ingest";
import { normalize } from "@/lib/text";
import { UFS } from "@/lib/taxonomy";

function backFontes(kind: "ok" | "erro", msg: string): never {
  redirect(`/admin/fontes?${kind}=${encodeURIComponent(msg)}`);
}

export async function saveRobotSettings(formData: FormData) {
  await requireAdmin();
  const values: Partial<Settings> = {};
  for (const key of Object.keys(SETTING_DEFAULTS) as (keyof Settings)[]) {
    if (key === "googleNews" || key === "aiClassify") values[key] = formData.get(key) === "on" ? "1" : "0";
    else values[key] = String(formData.get(key) ?? "").trim();
  }
  const num = (v: string | undefined, min: number, max: number, def: string) => String(Math.min(max, Math.max(min, Number(v) || Number(def))));
  values.maxAgeDays = num(values.maxAgeDays, 1, 14, SETTING_DEFAULTS.maxAgeDays);
  values.retentionDays = num(values.retentionDays, 7, 730, SETTING_DEFAULTS.retentionDays);
  await saveSettings(values);
  revalidatePath("/admin/fontes");
  backFontes("ok", "Configuração salva. Vale na próxima coleta (ou clique em “Coletar notícias agora” na aba Robô).");
}

export async function resetRobotSettings() {
  await requireAdmin();
  await db.setting.deleteMany();
  revalidatePath("/admin/fontes");
  backFontes("ok", "Configuração restaurada para o padrão.");
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

export async function addFeed(formData: FormData) {
  await requireAdmin();
  const parsed = feedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) backFontes("erro", parsed.error.issues[0].message);
  const d = parsed.data;
  if (d.scope !== "FEDERAL" && !(d.uf && d.uf in UFS)) backFontes("erro", "Feeds estaduais e municipais precisam de um estado (UF) válido.");
  if (d.scope === "MUNICIPAL" && !d.municipality) backFontes("erro", "Feeds municipais precisam do nome do município.");
  const probe = await probeFeed(d.feedUrl);
  if (!probe.ok) backFontes("erro", `Não consegui ler esse feed: ${probe.error}`);
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
    backFontes("erro", "Já existe um feed com esse nome ou essa URL.");
  }
  revalidatePath("/admin/fontes");
  backFontes("ok", `Feed “${d.name}” adicionado (${probe.items} itens encontrados).`);
}

export async function toggleFeed(id: string) {
  await requireAdmin();
  const f = await db.feedSource.findUnique({ where: { id } });
  if (f) await db.feedSource.update({ where: { id }, data: { active: !f.active } });
  revalidatePath("/admin/fontes");
}

export async function deleteFeed(id: string) {
  await requireAdmin();
  await db.feedSource.deleteMany({ where: { id } });
  revalidatePath("/admin/fontes");
}
