import { db } from "@/lib/db";

/*
 * Frequência de atualização de cada grupo de dados, escolhida em Admin → Dados (padrão: mensal, no dia 2).
 * O agendador confere uma vez por dia (3h) e roda só os grupos cujo prazo já venceu.
 */

export type Freq = "mensal" | "quinzenal" | "semanal" | "diaria";

export const FREQS: { v: Freq; label: string }[] = [
  { v: "mensal", label: "Mensal (dia 2)" },
  { v: "quinzenal", label: "Quinzenal (dias 2 e 16)" },
  { v: "semanal", label: "Semanal (segunda)" },
  { v: "diaria", label: "Diária" },
];
export const DEFAULT_FREQ: Freq = "mensal";

/** Grupos de dados e o job que atualiza cada um. */
export const DATA_JOBS: { job: string; label: string; desc: string }[] = [
  { job: "indicators", label: "Indicadores e IPEA", desc: "Séries do IBGE, Banco Central, Tesouro, Banco Mundial e Atlas da Violência (Indicadores, Pilares, Score, Diagnóstico)" },
  { job: "budget", label: "Orçamento", desc: "Siconfi: balanços e relatórios do município, do estado e da União (Orçamento, Expectativa fiscal, Diagnóstico)" },
  { job: "marketData", label: "Inflação, juros, Ibovespa e PIB por setor", desc: "IPCA, Selic, Focus, a bolsa e as Contas Trimestrais" },
  { job: "studies", label: "Impostos e salários", desc: "OCDE e Penn World Table (Impostos, Salários e lucros)" },
  { job: "politicians", label: "Representantes", desc: "Deputados, senadores e eleitos" },
  { job: "candidates", label: "Candidatos", desc: "Candidatos do TSE" },
];

const key = (job: string) => `dataFreq:${job}`;
const isFreq = (v: unknown): v is Freq => FREQS.some((f) => f.v === v);

export async function getFrequencies(): Promise<Record<string, Freq>> {
  const rows = await db.setting.findMany({ where: { key: { in: DATA_JOBS.map((j) => key(j.job)) } } }).catch(() => []);
  const out: Record<string, Freq> = {};
  for (const j of DATA_JOBS) {
    const v = rows.find((r) => r.key === key(j.job))?.value;
    out[j.job] = isFreq(v) ? v : DEFAULT_FREQ;
  }
  return out;
}

export async function setFrequency(job: string, freq: string): Promise<void> {
  if (!DATA_JOBS.some((j) => j.job === job) || !isFreq(freq)) return;
  await db.setting.upsert({ where: { key: key(job) }, create: { key: key(job), value: freq }, update: { value: freq } });
}

/** Último horário previsto para a atualização (3h do dia certo), a partir do qual o grupo precisa ter rodado. */
export function lastSlot(freq: Freq, now = new Date()): Date {
  const at = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 3, 0, 0);
  const today = at(now);
  const back = (days: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - days, 3, 0, 0);
  if (freq === "diaria") return now >= today ? today : back(1);
  if (freq === "semanal") {
    const sinceMon = (today.getDay() + 6) % 7; // segunda = 0
    const mon = back(sinceMon);
    return now >= mon ? mon : back(sinceMon + 7);
  }
  const days = freq === "quinzenal" ? [2, 16] : [2];
  // percorre os dias anteriores até achar um dia de atualização que já passou
  for (let i = 0; i < 62; i++) {
    const d = back(i);
    if (days.includes(d.getDate()) && d <= now) return d;
  }
  return back(31);
}

export function nextSlot(freq: Freq, now = new Date()): Date {
  for (let i = 0; i < 62; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 3, 0, 0);
    if (d <= now) continue;
    if (freq === "diaria" || (freq === "semanal" && d.getDay() === 1) || ((freq === "mensal" ? [2] : freq === "quinzenal" ? [2, 16] : []).includes(d.getDate()))) return d;
  }
  return now;
}

/** Grupos que já passaram do horário previsto sem uma atualização bem-sucedida depois dele. */
export async function dueJobs(now = new Date()): Promise<string[]> {
  const freqs = await getFrequencies();
  const due: string[] = [];
  for (const j of DATA_JOBS) {
    const slot = lastSlot(freqs[j.job], now);
    const ok = await db.jobRun.findFirst({ where: { job: { in: [j.job, "dataMonthly"] }, ok: true, startedAt: { gte: slot } }, select: { id: true } }).catch(() => null);
    if (!ok) due.push(j.job);
  }
  return due;
}
