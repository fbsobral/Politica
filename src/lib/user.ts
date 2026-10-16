import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { isSignupOpen } from "@/lib/settings";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Usuário do banco correspondente à sessão Clerk.
 * - primeiro acesso: cria o registro; se o e-mail foi pré-cadastrado por um admin, assume esse registro (mantendo o papel);
 * - e-mails em ADMIN_EMAILS viram ADMIN automaticamente (forma de criar o primeiro admin).
 */
export const getDbUser = cache(async function getDbUser(): Promise<User> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  let user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    const cu = await currentUser();
    const email = (cu?.primaryEmailAddress?.emailAddress ?? cu?.emailAddresses[0]?.emailAddress ?? `${userId}@sem-email.local`).toLowerCase();
    const name = [cu?.firstName, cu?.lastName].filter(Boolean).join(" ") || null;
    const pending = await db.user.findUnique({ where: { email } });
    // cadastro aberto: qualquer conta do Clerk entra. Fechado: só e-mails cadastrados por um admin (ou em ADMIN_EMAILS)
    if (!pending && !adminEmails().includes(email) && !(await isSignupOpen())) redirect("/acesso-negado");
    user = pending
      ? await db.user.update({ where: { id: pending.id }, data: { clerkId: userId, name: pending.name ?? name } })
      : await db.user.create({ data: { clerkId: userId, email, name } });
  }
  if (user.role !== "ADMIN" && adminEmails().includes(user.email.toLowerCase())) {
    user = await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  }
  return user;
});

/** Igual a getDbUser, mas exige localização configurada. */
export async function requireUser(): Promise<User & { uf: string; municipality: string; municipalityKey: string }> {
  const user = await getDbUser();
  if (!user.uf || !user.municipality || !user.municipalityKey) redirect("/onboarding");
  return user as User & { uf: string; municipality: string; municipalityKey: string };
}

/** Só administradores; os demais voltam para o feed. */
export async function requireAdmin(): Promise<User> {
  const user = await getDbUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
