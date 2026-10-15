import { processAlerts } from "@/lib/alerts";
import { db } from "@/lib/db";
import { sendDigests } from "@/lib/digest";
import { classifyPending, runIngest } from "@/lib/news/ingest";
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
  /** classifica notícias que ficaram pendentes (ex.: a coleta trouxe mais do que cabe numa rodada) */
  async classifyBacklog() {
    let classified = 0;
    let removed = 0;
    let reused = 0;
    for (let round = 0; round < 6; round++) {
      const r = await classifyPending();
      classified += r.classified;
      removed += r.removed;
      reused += r.reused;
      if (r.classified + r.removed < 300) break;
    }
    return { classified, removed, reused };
  },
  /** reclassifica notícias eleitorais sem cargo (preenche cargo e pesquisa nas antigas) */
  async reclassifyElections() {
    const reopened = await db.article.updateMany({
      where: { cargo: null, OR: [{ category: "ELEICOES" }, { searchText: { contains: "eleic" } }, { searchText: { contains: "candidat" } }, { searchText: { contains: "pesquisa" } }, { searchText: { contains: "segundo turno" } }] },
      data: { classified: false },
    });
    let classified = 0;
    let removed = 0;
    for (let round = 0; round < 10; round++) {
      const r = await classifyPending();
      classified += r.classified;
      removed += r.removed;
      if (r.classified + r.removed < 300) break;
    }
    return { reopened: reopened.count, classified, removed };
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
    // assuntos rejeitados e uso de IA antigos não precisam ficar para sempre
    await db.rejectedCluster.deleteMany({ where: { at: { lt: new Date(Date.now() - 30 * 86400000) } } });
    await db.aiUsage.deleteMany({ where: { at: { lt: new Date(Date.now() - 90 * 86400000) } } });
    const days = Number((await getSettings()).retentionDays) || 0;
    if (days <= 0) return { deleted: 0, note: "retenção desligada (guarda todo o histórico)" };
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * Math.max(7, days));
    const r = await db.article.deleteMany({ where: { publishedAt: { lt: cutoff }, favorites: { none: {} } } });
    return { deleted: r.count };
  },
};

export type JobName = keyof typeof JOBS;

const running = new Set<string>();

/**
 * `scheduled`: chamada por um agendador (cron do worker ou tarefa do Coolify). A coleta respeita o intervalo
 * configurado no painel; execuções manuais (botão do admin, `npm run job -- ingest`) ignoram o intervalo.
 */
/** Sinal de vida do agendador (aparece na Visão geral do admin). */
export async function pingScheduler(): Promise<void> {
  const now = new Date().toISOString();
  await db.setting.upsert({ where: { key: "schedulerPing" }, create: { key: "schedulerPing", value: now }, update: { value: now } }).catch(() => undefined);
}

/** Minutos que faltam para a próxima coleta (0 = já está na hora). Tolerância de 3 min: os agendadores disparam em minutos "redondos". */
export async function minutesUntilIngest(): Promise<number> {
  const minutes = Math.min(1440, Math.max(10, Number((await getSettings()).ingestIntervalMinutes) || 60));
  const last = await db.jobRun.findFirst({ where: { job: "ingest" }, orderBy: { startedAt: "desc" }, select: { startedAt: true } });
  if (!last) return 0;
  const left = minutes - (Date.now() - last.startedAt.getTime()) / 60000;
  return left <= 3 ? 0 : Math.round(left);
}

export async function runJob(name: JobName, opts: { scheduled?: boolean } = {}): Promise<unknown> {
  if (opts.scheduled && name === "ingest") await pingScheduler();
  if (running.has(name)) return { skipped: "já em execução" };
  if (opts.scheduled && name === "ingest") {
    const left = await minutesUntilIngest();
    if (left > 0) {
      console.log(`[job:ingest] pulado: próxima coleta em ~${left} min`);
      return { skipped: `próxima coleta em ~${left} min` };
    }
  }
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
