import { processAlerts } from "@/lib/alerts";
import { db } from "@/lib/db";
import { sendDigests } from "@/lib/digest";
import { runIngest } from "@/lib/news/ingest";
import { getSettings } from "@/lib/settings";
import { syncAll, syncMissing } from "@/lib/politicians/sync";
import { syncCandidates } from "@/lib/politicians/tse";

export const JOBS = {
  /** coleta de notícias + classificação + alertas (a cada hora) */
  async ingest() {
    const r = await runIngest();
    const alerts = await processAlerts(r.newArticleIds);
    return { ...r, newArticleIds: r.newArticleIds.length, alerts };
  },
  /** resumo diário por e-mail */
  digest: () => sendDigests("daily"),
  /** resumo semanal (segunda, 7h) */
  digestWeekly: () => sendDigests("weekly"),
  /** resumo mensal (dia 1, 7h) */
  digestMonthly: () => sendDigests("monthly"),
  /** atualiza deputados, senadores e eleitos das UFs em uso */
  async politicians() {
    await syncAll();
    return { ok: true };
  },
  /** candidatos das eleições 2026 (presidente, governador, senado) */
  async candidates() {
    const users = await db.user.findMany({ where: { uf: { not: null } }, distinct: ["uf"], select: { uf: true } });
    return { candidates: await syncCandidates(users.map((u) => u.uf!)) };
  },
  /** só o que falta (usado na inicialização) */
  async politiciansMissing() {
    await syncMissing();
    return { ok: true };
  },
  /** remove notícias antigas (retenção configurável) que ninguém favoritou */
  async cleanup() {
    const days = Number((await getSettings()).retentionDays) || 0;
    if (days <= 0) return { deleted: 0, note: "retenção desligada (guarda todo o histórico)" };
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * Math.max(7, days));
    const r = await db.article.deleteMany({ where: { publishedAt: { lt: cutoff }, favorites: { none: {} } } });
    return { deleted: r.count };
  },
};

export type JobName = keyof typeof JOBS;

const running = new Set<string>();

export async function runJob(name: JobName): Promise<unknown> {
  if (running.has(name)) return { skipped: "já em execução" };
  running.add(name);
  const run = await db.jobRun.create({ data: { job: name } });
  try {
    const result = await JOBS[name]();
    await db.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), ok: true, info: JSON.stringify(result) } });
    console.log(`[job:${name}] ok`, result);
    return result;
  } catch (err) {
    const message = (err as Error).message;
    await db.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), ok: false, info: message } });
    console.error(`[job:${name}] erro`, err);
    throw err;
  } finally {
    running.delete(name);
  }
}
