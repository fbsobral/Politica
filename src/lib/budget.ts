import { db } from "@/lib/db";
import { ibgeIdFor } from "@/lib/ibge";

const API = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt";
const DAY = 24 * 3600 * 1000;

export type BudgetScope = "MUNICIPAL" | "ESTADUAL" | "FEDERAL";

/** Código IBGE das UFs (2 dígitos) — é o id_ente dos estados no Siconfi. */
const UF_CODE: Record<string, number> = {
  RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29,
  MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53,
};

type Item = { exercicio: number; instituicao: string; cod_ibge: number; uf: string; populacao: number | null; anexo: string; rotulo: string; coluna: string; cod_conta: string; conta: string; valor: number };

export type Slice = { code: string; name: string; value: number; share: number };

export type Annual = {
  year: number;
  expenseTotal: number;
  expense: Slice[]; // por função, maior primeiro
  revenueTotal: number;
  revenue: Slice[]; // por origem, maior primeiro
};

export type Current = {
  year: number;
  period: number; // bimestre
  revenue: { initial: number; updated: number; realized: number };
  expense: { initial: number; updated: number; committed: number };
};

export type BudgetData = {
  scope: BudgetScope;
  entity: string;
  population: number | null;
  annual: Annual | null;
  current: Current | null;
  fetchedAt: string;
};

async function siconfi(path: string, params: Record<string, string | number>): Promise<Item[]> {
  const url = `${API}/${path}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`Siconfi ${res.status}`);
  const json = (await res.json()) as { items: Item[] };
  return json.items ?? [];
}

const clean = (conta: string) => conta.replace(/^\d+(\.\d+)*\s*-?\s*/, "").trim();

function slices(rows: { code: string; name: string; value: number }[], total: number, take = 12): Slice[] {
  const positive = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const top = positive.slice(0, take);
  const rest = positive.slice(take).reduce((a, r) => a + r.value, 0);
  const out = top.map((r) => ({ ...r, share: total > 0 ? r.value / total : 0 }));
  if (rest > 0) out.push({ code: "outros", name: "Outras", value: rest, share: total > 0 ? rest / total : 0 });
  return out;
}

type Raw = { code: string; name: string; value: number };
type DcaYear = { year: number; empty?: boolean; name: string | null; pop: number | null; expenseTotal: number; expense: Raw[]; revenueTotal: number; revenue: Raw[] };

/** Interpreta os anexos I-E (despesa por função) e I-C (receita) do DCA, nos formatos antigo (até 2017) e novo. */
function parseDca(exp: Item[], rev: Item[], year: number): DcaYear {
  if (!exp.length) return { year, empty: true, name: null, pop: null, expenseTotal: 0, expense: [], revenueTotal: 0, revenue: [] };
  const empenhada = exp.filter((i) => i.coluna === "Despesas Empenhadas");
  const fn: Raw[] = empenhada.filter((i) => /^\d{2} - /.test(i.conta)).map((i) => ({ code: i.conta.slice(0, 2), name: clean(i.conta), value: i.valor }));
  const fnSum = fn.reduce((a, r) => a + r.value, 0);
  const expenseTotal = empenhada.find((i) => /^Despesas \(?Exceto Intraor/i.test(i.conta))?.valor ?? fnSum;

  const realizada = rev.filter((i) => i.coluna === "Receitas Brutas Realizadas");
  const origins: Raw[] = realizada
    .filter((i) => /^RO\d\.[1-9](\.0+)+$/.test(i.cod_conta))
    .map((i) => ({ code: i.cod_conta.slice(0, 5), name: clean(i.conta), value: i.valor }));
  const cat = (c: string) => realizada.find((i) => /^RO\d\.0(\.0+)+$/.test(i.cod_conta) && i.cod_conta.startsWith(c))?.valor ?? 0;
  const revenueTotal =
    realizada.find((i) => i.cod_conta === "ReceitasExcetoIntraOrcamentarias")?.valor ??
    realizada.find((i) => i.cod_conta === "TotalReceitas")?.valor ??
    cat("RO1") + cat("RO2");

  return { year, name: exp[0].instituicao ?? null, pop: exp[0].populacao ?? null, expenseTotal, expense: fn, revenueTotal, revenue: origins };
}

async function fetchDca(id: number, year: number): Promise<DcaYear> {
  const [exp, rev] = await Promise.all([
    siconfi("dca", { an_exercicio: year, no_anexo: "DCA-Anexo I-E", id_ente: id }),
    siconfi("dca", { an_exercicio: year, no_anexo: "DCA-Anexo I-C", id_ente: id }),
  ]);
  return parseDca(exp, rev, year);
}

async function fetchAnnual(id: number, year: number): Promise<{ annual: Annual | null; pop: number | null; name: string | null }> {
  const d = await fetchDca(id, year);
  if (d.empty) return { annual: null, pop: null, name: null };
  return {
    annual: { year, expenseTotal: d.expenseTotal, expense: slices(d.expense, d.expenseTotal), revenueTotal: d.revenueTotal, revenue: slices(d.revenue, d.revenueTotal, 8) },
    pop: d.pop,
    name: d.name,
  };
}

async function fetchCurrent(id: number, year: number): Promise<{ current: Current | null; pop: number | null; name: string | null }> {
  for (let period = 6; period >= 1; period--) {
    let rows: Item[] = [];
    try {
      rows = await siconfi("rreo", { an_exercicio: year, nr_periodo: period, co_tipo_demonstrativo: "RREO", no_anexo: "RREO-Anexo 01", id_ente: id });
    } catch {
      continue;
    }
    if (!rows.length) continue;
    const val = (cod: string, col: RegExp) => rows.find((i) => i.cod_conta === cod && col.test(i.coluna))?.valor ?? 0;
    const R = "ReceitasExcetoIntraOrcamentarias";
    const D = "DespesasExcetoIntraOrcamentarias";
    return {
      current: {
        year,
        period,
        revenue: { initial: val(R, /PREVIS.O INICIAL/i), updated: val(R, /PREVIS.O ATUALIZADA/i), realized: val(R, /^At. o Bimestre \(c\)/i) },
        expense: { initial: val(D, /DOTA..O INICIAL/i), updated: val(D, /DOTA..O ATUALIZADA/i), committed: val(D, /DESPESAS EMPENHADAS AT. O BIME/i) },
      },
      pop: rows[0].populacao ?? null,
      name: rows[0].instituicao ?? null,
    };
  }
  return { current: null, pop: null, name: null };
}

/** Busca os números de uma esfera (com cache no banco: 7 dias para o fechado do ano, 1 dia para o ano corrente). */
export async function getBudget(scope: BudgetScope, user: { uf: string; municipalityKey: string }, opts: { force?: boolean } = {}): Promise<BudgetData | null> {
  const id = scope === "FEDERAL" ? 1 : scope === "ESTADUAL" ? UF_CODE[user.uf] : await ibgeIdFor(user.uf, user.municipalityKey);
  if (!id) return null;
  const key = `budget:v2:${id}`;
  const hit = await db.budgetCache.findUnique({ where: { key } });
  if (hit && !opts.force && Date.now() - hit.fetchedAt.getTime() < DAY) return hit.data as unknown as BudgetData;

  const now = new Date().getFullYear();
  try {
    // o ano fechado (DCA) sai com atraso: tenta o ano passado e, se ainda não saiu, o retrasado
    let annualRes = await fetchAnnual(id, now - 1);
    if (!annualRes.annual) annualRes = await fetchAnnual(id, now - 2);
    let currentRes = await fetchCurrent(id, now);
    if (!currentRes.current) currentRes = await fetchCurrent(id, now - 1);
    const data: BudgetData = {
      scope,
      entity: annualRes.name ?? currentRes.name ?? (scope === "FEDERAL" ? "Governo Federal" : ""),
      population: annualRes.pop ?? currentRes.pop,
      annual: annualRes.annual,
      current: currentRes.current,
      fetchedAt: new Date().toISOString(),
    };
    await db.budgetCache.upsert({ where: { key }, create: { key, data: data as never }, update: { data: data as never, fetchedAt: new Date() } });
    return data;
  } catch (err) {
    console.warn("[budget]", scope, id, (err as Error).message);
    return hit ? (hit.data as unknown as BudgetData) : null; // devolve o cache velho se a fonte caiu
  }
}

/** Habitantes do Brasil (estimativa IBGE, arredondada) — o Siconfi não traz a população da União. */
export const BRAZIL_POPULATION = 212_600_000;

export const PERIOD_LABEL = ["", "jan–fev", "jan–abr", "jan–jun", "jan–ago", "jan–out", "jan–dez"];

/** R$ em formato curto: 4,53 bi · 320 mi · 85 mil. */
export function brlShort(v: number): string {
  const abs = Math.abs(v);
  const f = (n: number, unit: string) => `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: n >= 100 ? 0 : n >= 10 ? 1 : 2 })} ${unit}`;
  if (abs >= 1e12) return f(v / 1e12, "tri");
  if (abs >= 1e9) return f(v / 1e9, "bi");
  if (abs >= 1e6) return f(v / 1e6, "mi");
  if (abs >= 1e3) return f(v / 1e3, "mil");
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

export const pct = (n: number, digits = 1) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: digits })}%`;


/* ───────── Histórico de 10 anos ───────── */

export type Series = { code: string; name: string; values: Record<number, number> };

export type BudgetHistory = {
  scope: BudgetScope;
  entity: string;
  years: number[];
  expense: Series[];
  revenue: Series[];
  totals: { expense: Record<number, number>; revenue: Record<number, number> };
  population: Record<number, number>;
  /** fator para converter o valor nominal de cada ano para os preços do último ano (IPCA) */
  deflator: Record<number, number>;
  fetchedAt: string;
};

/** Média anual do IPCA (número-índice, IBGE/SIDRA 1737) por ano; cache de 30 dias. */
async function ipcaByYear(): Promise<Record<number, number>> {
  const key = "ipca:v1";
  const hit = await db.budgetCache.findUnique({ where: { key } });
  if (hit && Date.now() - hit.fetchedAt.getTime() < 30 * DAY) return hit.data as unknown as Record<number, number>;
  try {
    const res = await fetch("https://servicodados.ibge.gov.br/api/v3/agregados/1737/periodos/-170/variaveis/2266?localidades=N1[all]", { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`IBGE ${res.status}`);
    const json = (await res.json()) as { resultados: { series: { serie: Record<string, string> }[] }[] }[];
    const serie = json[0].resultados[0].series[0].serie;
    const byYear: Record<number, number[]> = {};
    for (const [ym, v] of Object.entries(serie)) (byYear[Number(ym.slice(0, 4))] ??= []).push(Number(v));
    const avg: Record<number, number> = {};
    for (const [y, list] of Object.entries(byYear)) if (list.length >= 11) avg[Number(y)] = list.reduce((a, b) => a + b, 0) / list.length;
    await db.budgetCache.upsert({ where: { key }, create: { key, data: avg as never }, update: { data: avg as never, fetchedAt: new Date() } });
    return avg;
  } catch (err) {
    console.warn("[ipca]", (err as Error).message);
    return hit ? (hit.data as unknown as Record<number, number>) : {};
  }
}

async function dcaCached(id: number, year: number, ttlDays: number, force: boolean): Promise<DcaYear> {
  const key = `budget:dca:v3:${id}:${year}`;
  const hit = await db.budgetCache.findUnique({ where: { key } });
  const d = hit?.data as unknown as DcaYear | undefined;
  const ttl = (d?.empty ? 7 : ttlDays) * DAY;
  if (hit && d && !force && Date.now() - hit.fetchedAt.getTime() < ttl) return d;
  try {
    const fresh = await fetchDca(id, year);
    await db.budgetCache.upsert({ where: { key }, create: { key, data: fresh as never }, update: { data: fresh as never, fetchedAt: new Date() } });
    return fresh;
  } catch (err) {
    console.warn("[budget:dca]", id, year, (err as Error).message);
    return d ?? { year, empty: true, name: null, pop: null, expenseTotal: 0, expense: [], revenueTotal: 0, revenue: [] };
  }
}

function toSeries(perYear: { year: number; rows: Raw[] }[]): Series[] {
  const map = new Map<string, Series>();
  for (const { year, rows } of perYear) {
    for (const r of rows) {
      const s = map.get(r.code) ?? { code: r.code, name: r.name, values: {} };
      s.values[year] = (s.values[year] ?? 0) + r.value;
      s.name = r.name; // o nome do ano mais recente prevalece (anos vêm em ordem crescente)
      map.set(r.code, s);
    }
  }
  const latest = perYear.length ? perYear[perYear.length - 1].year : 0;
  return [...map.values()].sort((a, b) => (b.values[latest] ?? 0) - (a.values[latest] ?? 0) || Math.max(...Object.values(b.values)) - Math.max(...Object.values(a.values)));
}

/** Série de despesa (por função) e receita (por origem) dos últimos 10 anos fechados, com cache por ano no banco. */
export async function getBudgetHistory(scope: BudgetScope, user: { uf: string; municipalityKey: string }, opts: { force?: boolean; years?: number } = {}): Promise<BudgetHistory | null> {
  const id = scope === "FEDERAL" ? 1 : scope === "ESTADUAL" ? UF_CODE[user.uf] : await ibgeIdFor(user.uf, user.municipalityKey);
  if (!id) return null;
  const now = new Date().getFullYear();
  const n = opts.years ?? 10;

  // último ano fechado com dados (o DCA sai com atraso)
  let last = now - 1;
  let probe = await dcaCached(id, last, 14, opts.force ?? false);
  if (probe.empty) {
    last = now - 2;
    probe = await dcaCached(id, last, 14, opts.force ?? false);
  }
  const years = Array.from({ length: n }, (_, i) => last - (n - 1) + i);

  // busca o resto em paralelo limitado (3 por vez)
  const data = new Map<number, DcaYear>([[last, probe]]);
  const pending = years.filter((y) => y !== last);
  let next = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (next < pending.length) {
        const y = pending[next++];
        data.set(y, await dcaCached(id, y, y >= last - 1 ? 14 : 90, (opts.force ?? false) && y >= last - 1));
      }
    }),
  );

  const have = years.filter((y) => !data.get(y)?.empty);
  if (!have.length) return null;
  const ipca = await ipcaByYear();
  const base = ipca[last] ?? ipca[have[have.length - 1]];
  const deflator: Record<number, number> = {};
  for (const y of years) if (ipca[y] && base) deflator[y] = base / ipca[y];

  const population: Record<number, number> = {};
  let carry: number | null = null;
  for (const y of years) {
    const p = data.get(y)?.pop ?? null;
    if (p) carry = p;
    if (carry) population[y] = carry;
  }
  const rev = have.filter((y) => (data.get(y)?.revenue.length ?? 0) > 0 || (data.get(y)?.revenueTotal ?? 0) > 0);
  return {
    scope,
    entity: probe.name ?? (scope === "FEDERAL" ? "Governo Federal" : ""),
    years: have,
    expense: toSeries(have.map((y) => ({ year: y, rows: data.get(y)!.expense }))),
    revenue: toSeries(rev.map((y) => ({ year: y, rows: data.get(y)!.revenue }))),
    totals: {
      expense: Object.fromEntries(have.map((y) => [y, data.get(y)!.expenseTotal])),
      revenue: Object.fromEntries(rev.map((y) => [y, data.get(y)!.revenueTotal])),
    },
    population,
    deflator,
    fetchedAt: new Date().toISOString(),
  };
}
