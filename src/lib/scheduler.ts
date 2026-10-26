import cron from "node-cron";
import { db } from "@/lib/db";
import { todayKey } from "@/lib/digest";
import { runJobDetached } from "@/lib/job-runner";
import { minutesUntilIngest, pingScheduler, type JobName } from "@/lib/jobs";

const tz = process.env.TZ || "America/Sao_Paulo";
const g = globalThis as unknown as { __politicaScheduler?: boolean };

function schedule(expr: string, job: JobName) {
  cron.schedule(
    expr,
    () => {
      runJobDetached(job, { scheduled: true }).catch(() => undefined);
    },
    { timezone: tz },
  );
  console.log(`[scheduler] ${job} agendado: "${expr}" (${tz})`);
}

/** Hora (0-23) configurada num cron "m h * * *"; padrão 7. */
const hourOf = (expr: string | undefined) => {
  const h = Number(expr?.trim().split(/\s+/)[1]);
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : 7;
};

/** Hora, dia da semana e dia do mês em Brasília. */
function nowBr() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23", weekday: "short", day: "numeric" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { hour: Number(get("hour")), weekday: get("weekday"), dom: Number(get("day")) };
}

/**
 * Agenda todos os jobs no próprio processo (site ou worker). Os jobs pesados rodam em processos separados
 * (não travam o site). A coleta confere a cada 5 min e só roda quando o intervalo do painel já passou.
 * Chamar mais de uma vez não duplica os agendamentos.
 */
export function startScheduler(opts: { bootDelayMs?: number } = {}) {
  if (g.__politicaScheduler) return;
  g.__politicaScheduler = true;

  // coleta: sinal de vida a cada 5 min; só dispara o job se já está na hora (evita abrir processo à toa)
  cron.schedule(
    "*/5 * * * *",
    async () => {
      try {
        await pingScheduler();
        if ((await minutesUntilIngest()) === 0) await runJobDetached("ingest", { scheduled: true });
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    },
    { timezone: tz },
  );
  console.log(`[scheduler] ingest confere a cada 5 min (${tz})`);

  schedule(process.env.DIGEST_CRON || "0 7 * * *", "digest");
  schedule(process.env.WEEKLY_DIGEST_CRON || "0 7 * * 1", "digestWeekly");
  schedule(process.env.MONTHLY_DIGEST_CRON || "0 7 1 * *", "digestMonthly");
  schedule("0 4 * * 0", "politicians");
  schedule("30 3 * * *", "cleanup");
  schedule("0 5 * * 1", "budget");
  schedule("30 5 * * 1", "indicators");
  schedule("15 */6 * * *", "candidates");

  // fila de classificação: se sobrou notícia sem classificar, termina o serviço sem esperar a próxima coleta
  cron.schedule(
    "2-59/5 * * * *",
    async () => {
      try {
        if ((await db.article.count({ where: { classified: false } })) > 0) await runJobDetached("classifyBacklog");
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    },
    { timezone: tz },
  );

  // resumos por e-mail: se o horário passou sem envio (site fora do ar às 7h, deploy no meio...), envia assim que puder
  const attempts = new Map<string, number>();
  cron.schedule(
    "4-59/5 * * * *",
    async () => {
      try {
        const { hour, weekday, dom } = nowBr();
        const day = todayKey();
        const kinds = [
          { kind: "daily", job: "digest" as const, flag: "dailyDigest" as const, due: hour >= hourOf(process.env.DIGEST_CRON) },
          { kind: "weekly", job: "digestWeekly" as const, flag: "weeklyDigest" as const, due: weekday === "Mon" && hour >= hourOf(process.env.WEEKLY_DIGEST_CRON) },
          { kind: "monthly", job: "digestMonthly" as const, flag: "monthlyDigest" as const, due: dom === 1 && hour >= hourOf(process.env.MONTHLY_DIGEST_CRON) },
        ];
        for (const k of kinds) {
          const key = `${k.kind}:${day}`;
          if (!k.due || (attempts.get(key) ?? 0) >= 3) continue;
          const missing = await db.user.count({ where: { [k.flag]: true, uf: { not: null }, digests: { none: { kind: k.kind, day } } } });
          if (missing > 0) {
            attempts.set(key, (attempts.get(key) ?? 0) + 1);
            console.log(`[scheduler] resumo ${k.kind}: ${missing} usuário(s) sem envio hoje — enviando (tentativa ${attempts.get(key)})`);
            await runJobDetached(k.job);
          }
        }
        if (attempts.size > 20) attempts.clear();
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    },
    { timezone: tz },
  );

  // ao subir: completa dados que faltam e já confere se está na hora de coletar
  setTimeout(async () => {
    await runJobDetached("politiciansMissing").catch(() => undefined);
    await runJobDetached("candidates").catch(() => undefined);
    await pingScheduler();
    if ((await minutesUntilIngest().catch(() => 1)) === 0) await runJobDetached("ingest", { scheduled: true }).catch(() => undefined);
  }, opts.bootDelayMs ?? 0);
}
