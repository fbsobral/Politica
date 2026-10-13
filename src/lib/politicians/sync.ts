import { db } from "@/lib/db";
import { syncDeputadosFederais, syncPresidencia, syncSenadores } from "./federal";
import { syncEstadual, syncMunicipal } from "./tse";

const running = new Set<string>();

/** Garante dados de uma UF (estadual + municipal). Evita execuções concorrentes. */
export async function syncUf(uf: string): Promise<void> {
  if (running.has(uf)) return;
  running.add(uf);
  try {
    await syncEstadual(uf);
    await syncMunicipal(uf);
  } finally {
    running.delete(uf);
  }
}

export async function syncFederal(): Promise<{ deputados: number; senadores: number }> {
  await syncPresidencia();
  const [deputados, senadores] = await Promise.all([syncDeputadosFederais(), syncSenadores()]);
  return { deputados, senadores };
}

/** Sincroniza tudo que é necessário para os usuários atuais. */
export async function syncAll(): Promise<void> {
  await syncFederal();
  const users = await db.user.findMany({ where: { uf: { not: null } }, distinct: ["uf"], select: { uf: true } });
  for (const u of users) {
    try {
      await syncUf(u.uf!);
    } catch (err) {
      console.warn(`[politicians] falha em ${u.uf}:`, (err as Error).message);
    }
  }
}

/** Sincroniza UFs de usuários que ainda não têm dados. */
export async function syncMissing(): Promise<void> {
  const count = await db.politician.count({ where: { role: "SENADOR" } });
  if (!count) await syncFederal();
  const users = await db.user.findMany({ where: { uf: { not: null } }, distinct: ["uf"], select: { uf: true } });
  for (const u of users) {
    const has = await db.politician.count({ where: { uf: u.uf!, role: "GOVERNADOR" } });
    if (!has) {
      try {
        await syncUf(u.uf!);
      } catch (err) {
        console.warn(`[politicians] falha em ${u.uf}:`, (err as Error).message);
      }
    }
  }
}
