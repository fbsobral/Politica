import cron from "node-cron";
import { runJob, type JobName } from "@/lib/jobs";

const tz = process.env.TZ || "America/Sao_Paulo";

function schedule(expr: string, job: JobName) {
  cron.schedule(
    expr,
    () => {
      runJob(job, { scheduled: true }).catch(() => undefined);
    },
    { timezone: tz },
  );
  console.log(`[worker] ${job} agendado: "${expr}" (${tz})`);
}

// verifica a cada 5 min; o intervalo real da coleta é configurado em Admin → Robô
schedule(process.env.INGEST_CRON || "*/5 * * * *", "ingest");
schedule(process.env.DIGEST_CRON || "0 7 * * *", "digest");
schedule(process.env.WEEKLY_DIGEST_CRON || "0 7 * * 1", "digestWeekly");
schedule(process.env.MONTHLY_DIGEST_CRON || "0 7 1 * *", "digestMonthly");
schedule("0 4 * * 0", "politicians");
schedule("30 3 * * *", "cleanup");
schedule("15 */6 * * *", "candidates");

// ao subir: completa dados que faltam e já coleta notícias
(async () => {
  await runJob("politiciansMissing").catch(() => undefined);
  await runJob("candidates").catch(() => undefined);
  await runJob("ingest").catch(() => undefined);
})();

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
