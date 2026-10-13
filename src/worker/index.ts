import cron from "node-cron";
import { runJob, type JobName } from "@/lib/jobs";

const tz = process.env.TZ || "America/Sao_Paulo";

function schedule(expr: string, job: JobName) {
  cron.schedule(
    expr,
    () => {
      runJob(job).catch(() => undefined);
    },
    { timezone: tz },
  );
  console.log(`[worker] ${job} agendado: "${expr}" (${tz})`);
}

schedule(process.env.INGEST_CRON || "0 * * * *", "ingest");
schedule(process.env.DIGEST_CRON || "0 7 * * *", "digest");
schedule("0 4 * * 0", "politicians");
schedule("30 3 * * *", "cleanup");

// ao subir: completa dados que faltam e já coleta notícias
(async () => {
  await runJob("politiciansMissing").catch(() => undefined);
  await runJob("ingest").catch(() => undefined);
})();

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
