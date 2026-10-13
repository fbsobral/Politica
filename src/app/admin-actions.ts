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
