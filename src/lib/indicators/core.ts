import { db } from "@/lib/db";

export type Scope = "FEDERAL" | "ESTADUAL" | "MUNICIPAL";
export type YearSeries = Record<number, number>;

/**
 * Ano corrente ainda incompleto: qual período o valor cobre (ex.: "jan–out", "2º tri") e o valor do MESMO período
 * do ano anterior, para comparar parcial com parcial (jan–out/2026 × jan–out/2025) e não com o ano fechado.
 */
export type PartialInfo = { year: number; label: string; prev: number | null };
/** chave onde o buscador guarda a informação do parcial junto da série (não é um ano) */
export const PARTIAL_KEY = "_partial";
const partials = new WeakMap<object, PartialInfo>();

/** Separa a informação do parcial da série (para que só sobrem anos) e a deixa disponível em `partialOf`. */
export function splitPartial(data: YearSeries | null | undefined): YearSeries | null {
  if (!data) return null;
  const { [PARTIAL_KEY]: p, ...rest } = data as YearSeries & { [PARTIAL_KEY]?: PartialInfo };
  const clean = rest as YearSeries;
  if (p && clean[p.year] !== undefined) partials.set(clean, p);
  return clean;
}
export const partialOf = (s: YearSeries | null | undefined): PartialInfo | null => (s ? partials.get(s) ?? null : null);
/** Junta a informação do parcial à série que vai para o banco. */
export const withPartial = (s: YearSeries, p: PartialInfo | null): YearSeries => (p && s[p.year] !== undefined ? ({ ...s, [PARTIAL_KEY]: p } as YearSeries) : s);
/** Mantém a informação do parcial depois de recortar uma série. */
export const keepPartial = (from: YearSeries, to: YearSeries): YearSeries => { const p = partialOf(from); if (p && to[p.year] !== undefined) partials.set(to, p); return to; };

const MES = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Onde o usuário mora; os buscadores de cada indicador escolhem o que precisam. */
export type Geo = { uf: string; ufCode: number; ibge: string; municipalityKey: string };

const DAY = 24 * 3600 * 1000;

/** quantos anos a gente guarda; a tela mostra 5, 10, 20 ou 30 */
export const YEARS_BACK = 30;
export const lastClosedYear = () => new Date().getFullYear() - 1;
export const yearRange = () => {
  const last = lastClosedYear();
  return { from: last - YEARS_BACK + 1, to: last };
};

/** Cache no banco (tabela BudgetCache, usada também pelo orçamento). Em falha da fonte, devolve o último valor guardado. */
export async function cached<T>(key: string, ttlDays: number, fn: () => Promise<T>, force = false): Promise<T | null> {
  const hit = await db.budgetCache.findUnique({ where: { key } });
  if (!force && hit && Date.now() - hit.fetchedAt.getTime() < ttlDays * DAY) return hit.data as unknown as T;
  try {
    const fresh = await fn();
    await db.budgetCache.upsert({ where: { key }, create: { key, data: fresh as never }, update: { data: fresh as never, fetchedAt: new Date() } });
    return fresh;
  } catch (err) {
    console.warn("[indicators]", key, (err as Error).message);
    return hit ? (hit.data as unknown as T) : null;
  }
}

export async function getJson<T>(url: string, timeoutMs = 30000): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; PoliticaBot/1.0)" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${new URL(url).host}`);
  return (await res.json()) as T;
}

/* ───────── Banco Central (SGS) ───────── */

type SgsPoint = { data: string; valor: string };
const brDate = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/** Série do SGS entre dois anos; janelas de até 9 anos por chamada (limite do BCB para séries diárias). */
export async function sgs(code: number, fromYear: number, toYear: number): Promise<{ year: number; month: number; value: number }[]> {
  const out: { year: number; month: number; value: number }[] = [];
  for (let y = fromYear; y <= toYear; y += 8) {
    const end = Math.min(toYear, y + 7);
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${brDate(new Date(y, 0, 1))}&dataFinal=${brDate(new Date(end, 11, 31))}`;
    let rows: SgsPoint[] | null = null;
    // o BCB às vezes responde 200 com uma página HTML de erro; tenta de novo com pausa
    for (let attempt = 0; attempt < 4 && !rows; attempt++) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PoliticaBot/1.0)" }, signal: AbortSignal.timeout(40000) });
        const text = await res.text();
        if (res.ok && text.trimStart().startsWith("[")) rows = JSON.parse(text) as SgsPoint[];
      } catch {
        /* tenta de novo */
      }
      if (!rows) await new Promise((r) => setTimeout(r, 2500));
    }
    if (!rows) throw new Error(`BCB SGS ${code} indisponível`);
    for (const r of rows) {
      const [, m, yy] = r.data.split("/").map(Number);
      const v = Number(r.valor);
      if (Number.isFinite(v)) out.push({ year: yy, month: m, value: v });
    }
  }
  return out;
}

/**
 * Como `perYear`, mas também descreve o ano corrente incompleto: até que mês vai e o valor do mesmo período do ano anterior.
 */
export function perYearPartial(points: { year: number; month: number; value: number }[], mode: "avg" | "last" | "sum" | "compound"): { series: YearSeries; partial: PartialInfo | null } {
  const series = perYear(points, mode);
  const cur = lastClosedYear() + 1;
  const now = points.filter((p) => p.year === cur);
  if (!now.length) return { series, partial: null };
  const upTo = Math.max(...now.map((p) => p.month));
  if (upTo >= 12) return { series, partial: null };
  const prevPts = points.filter((p) => p.year === cur - 1 && p.month <= upTo);
  const prev = prevPts.length ? perYear(prevPts, mode)[cur - 1] ?? null : null;
  const label = mode === "last" ? MES[upTo] : upTo === 1 ? "jan" : `jan–${MES[upTo]}`;
  return { series, partial: { year: cur, label, prev } };
}

/** Agrega pontos mensais/diários em um valor por ano. */
export function perYear(points: { year: number; month: number; value: number }[], mode: "avg" | "last" | "sum" | "compound"): YearSeries {
  const by = new Map<number, { month: number; value: number }[]>();
  for (const p of points) by.set(p.year, [...(by.get(p.year) ?? []), { month: p.month, value: p.value }]);
  const out: YearSeries = {};
  for (const [y, list] of by) {
    list.sort((a, b) => a.month - b.month);
    if (mode === "last") out[y] = list[list.length - 1].value;
    else if (mode === "sum") out[y] = list.reduce((a, b) => a + b.value, 0);
    else if (mode === "compound") out[y] = (list.reduce((a, b) => a * (1 + b.value / 100), 1) - 1) * 100;
    else out[y] = list.reduce((a, b) => a + b.value, 0) / list.length;
  }
  return out;
}

/* ───────── IBGE SIDRA ───────── */

/** Consulta o SIDRA no formato compacto (/f/c e valores numéricos). Devolve linhas com os códigos das dimensões. */
export async function sidra(path: string): Promise<{ v: number | null; [dim: string]: string | number | null }[]> {
  const rows = await getJson<Record<string, string>[]>(`https://apisidra.ibge.gov.br/values/${path}`, 40000);
  return rows.slice(1).map((r) => {
    const o: { v: number | null; [dim: string]: string | number | null } = { v: r.V && !/^[.\-X]+$/.test(r.V) ? Number(r.V) : null };
    for (const [k, val] of Object.entries(r)) if (/^D\d+C$/.test(k)) o[k] = val;
    return o;
  });
}

/** Série anual (ano -> valor) a partir de linhas do SIDRA onde a dimensão `yearDim` traz o ano (ex.: "D3C"). */
export function sidraYears(rows: { v: number | null; [dim: string]: string | number | null }[], yearDim: string): YearSeries {
  const out: YearSeries = {};
  for (const r of rows) {
    const y = Number(String(r[yearDim]).slice(0, 4));
    if (r.v !== null && Number.isFinite(y)) out[y] = r.v;
  }
  return out;
}

export const clip = (s: YearSeries, from: number, to: number): YearSeries => Object.fromEntries(Object.entries(s).filter(([y]) => Number(y) >= from && Number(y) <= to).map(([y, v]) => [Number(y), v]));
