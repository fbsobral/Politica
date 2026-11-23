import { processAlerts } from "@/lib/alerts";
import { db } from "@/lib/db";
import { sendDigests } from "@/lib/digest";
import { classifyPending, runIngest } from "@/lib/news/ingest";
import { getSettings } from "@/lib/settings";
import { syncAll, syncMissing } from "@/lib/politicians/sync";
import { syncCandidates } from "@/lib/politicians/tse";
import { getBudget, getBudgetHistory } from "@/lib/budget";
import { refreshIndicators } from "@/lib/indicators/job";
import { dueJobs } from "@/lib/data-schedule";
import { getInflation } from "@/lib/inflation";
import { getIbovespa } from "@/lib/ibovespa";
import { getTaxes } from "@/lib/taxes";
import { getLaborShare } from "@/lib/labor-share";
import { billLabels } from "@/lib/bills";
import { camaraAgenda, camaraVotes, senadoAgenda, senadoVotes } from "@/lib/open-data";

/** Gera os rótulos das proposições citadas na agenda e nas votações recentes. */
async function warmBillLabels(): Promise<number> {
  const all = await Promise.allSettled([camaraAgenda(10), senadoAgenda(10), camaraVotes(45), senadoVotes(45)]);
  const texts = all.flatMap((r) => (r.status === "fulfilled" ? r.value.map((x) => x.description) : []));
  return (await billLabels(texts, { generate: true, max: 40 })).size;
}

export const JOBS = {
  /** coleta de notícias + classificação + alertas (a cada hora) */
  async ingest() {
    const r = await runIngest();
    const alerts = await processAlerts(r.newArticleIds);
    // prepara os nomes legíveis das proposições da agenda e das votações (a página só usa o que já está pronto ou sai rápido)
    const bills = await warmBillLabels().catch((err) => (console.warn("[ingest] proposições", (err as Error).message), 0));
    return { ...r, newArticleIds: r.newArticleIds.length, alerts, bills };
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
  /** atualiza o orçamento (Siconfi) do município, do estado e da União de cada usuário */
  async budget() {
    const users = await db.user.findMany({ where: { uf: { not: null }, municipalityKey: { not: null } }, select: { uf: true, municipalityKey: true }, distinct: ["uf", "municipalityKey"] });
    let n = 0;
    await getBudget("FEDERAL", { uf: "SP", municipalityKey: "" }, { force: true });
    await getBudgetHistory("FEDERAL", { uf: "SP", municipalityKey: "" }, { force: true });
    n++;
    const ufs = new Set<string>();
    for (const u of users) {
      const loc = { uf: u.uf!, municipalityKey: u.municipalityKey! };
      if (!ufs.has(loc.uf)) {
        ufs.add(loc.uf);
        await getBudget("ESTADUAL", loc, { force: true });
        await getBudgetHistory("ESTADUAL", loc, { force: true });
        n++;
      }
      await getBudget("MUNICIPAL", loc, { force: true });
      await getBudgetHistory("MUNICIPAL", loc, { force: true });
      n++;
    }
    return { refreshed: n };
  },
  /** indicadores (Banco Central, IBGE, IPEA, Tesouro): baixa e guarda as séries de 10 anos de cada local */
  async indicators() {
    return refreshIndicators();
  },
  /** inflação, juros, Focus e Ibovespa (mudam todo dia útil) */
  async marketData() {
    const [inflation, ibovespa] = await Promise.all([getInflation({ force: true }).then((d) => Boolean(d)).catch(() => false), getIbovespa({ force: true }).then((d) => Boolean(d)).catch(() => false)]);
    return { inflation, ibovespa };
  },
  /** estudos com fonte internacional anual: impostos (OCDE) e salários e lucros */
  async studies() {
    const [taxes, laborShare] = await Promise.all([getTaxes({ force: true }).then((d) => Boolean(d)).catch(() => false), getLaborShare({ force: true }).then((d) => Boolean(d)).catch(() => false)]);
    return { taxes, laborShare };
  },
  /** atualização mensal de TODAS as bases (dia 2): indicadores, IPEA, orçamento, mercado, estudos, representantes e candidatos; resultado em Admin → Dados */
  async dataMonthly() {
    const out: Record<string, unknown> = {};
    for (const [name, fn] of [["indicators", () => refreshIndicators()], ["budget", () => JOBS.budget()], ["marketData", () => JOBS.marketData()], ["studies", () => JOBS.studies()], ["politicians", () => JOBS.politicians()], ["candidates", () => JOBS.candidates()]] as const) {
      const t0 = Date.now();
      try {
        const result = await fn();
        out[name] = { ok: true, seconds: Math.round((Date.now() - t0) / 1000), result };
      } catch (err) {
        out[name] = { ok: false, error: (err as Error).message };
      }
    }
    return out;
  },
  /** conferência diária (3h): roda só os grupos de dados cuja frequência (Admin → Dados, padrão mensal) já venceu */
  async dataScheduled() {
    const due = await dueJobs();
    const out: Record<string, unknown> = {};
    for (const job of due) {
      try {
        await runJob(job as JobName);
        out[job] = "ok";
      } catch (err) {
        out[job] = (err as Error).message;
      }
    }
    return due.length ? out : { nada: "nenhum grupo vencido" };
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
