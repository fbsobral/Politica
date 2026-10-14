import cron from "node-cron";
import { runJob, type JobName } from "@/lib/jobs";

const tz = process.env.TZ || "America/Sao_Paulo";
const g = globalThis as unknown as { __politicaScheduler?: boolean };

function schedule(expr: string, job: JobName) {
  cron.schedule(
    expr,
    () => {
      runJob(job, { scheduled: true }).catch(() => undefined);
    },
    { timezone: tz },
  );
  console.log(`[scheduler] ${job} agendado: "${expr}" (${tz})`);
}

/**
 * Agenda todos os jobs no próprio processo (site ou worker). A coleta de notícias confere a cada 5 min e só roda
 * quando o intervalo configurado em Admin → Robô já passou. Chamar mais de uma vez não duplica os agendamentos.
 */
export function startScheduler(opts: { bootDelayMs?: number } = {}) {
  if (g.__politicaScheduler) return;
  g.__politicaScheduler = true;

  // sempre a cada 5 min (o intervalo real da coleta vem do painel); INGEST_CRON não é mais usado
  schedule("*/5 * * * *", "ingest");
  schedule(process.env.DIGEST_CRON || "0 7 * * *", "digest");
  schedule(process.env.WEEKLY_DIGEST_CRON || "0 7 * * 1", "digestWeekly");
  schedule(process.env.MONTHLY_DIGEST_CRON || "0 7 1 * *", "digestMonthly");
  schedule("0 4 * * 0", "politicians");
  schedule("30 3 * * *", "cleanup");
  schedule("15 */6 * * *", "candidates");

  // ao subir: completa dados que faltam e já confere se está na hora de coletar
  setTimeout(async () => {
    await runJob("politiciansMissing").catch(() => undefined);
    await runJob("candidates").catch(() => undefined);
    await runJob("ingest", { scheduled: true }).catch(() => undefined);
  }, opts.bootDelayMs ?? 0);
}
