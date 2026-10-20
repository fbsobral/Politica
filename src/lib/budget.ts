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

const clean = (conta: string) => conta.replace(/^\d+(\.\d+)* - /, "").trim();

function slices(rows: { code: string; name: string; value: number }[], total: number, take = 12): Slice[] {
  const positive = rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const top = positive.slice(0, take);
  const rest = positive.slice(take).reduce((a, r) => a + r.value, 0);
  const out = top.map((r) => ({ ...r, share: total > 0 ? r.value / total : 0 }));
  if (rest > 0) out.push({ code: "outros", name: "Outras", value: rest, share: total > 0 ? rest / total : 0 });
  return out;
}

async function fetchAnnual(id: number, year: number): Promise<{ annual: Annual | null; pop: number | null; name: string | null }> {
  const [exp, rev] = await Promise.all([
    siconfi("dca", { an_exercicio: year, no_anexo: "DCA-Anexo I-E", id_ente: id }),
    siconfi("dca", { an_exercicio: year, no_anexo: "DCA-Anexo I-C", id_ente: id }),
  ]);
  if (!exp.length) return { annual: null, pop: null, name: null };

  // despesa empenhada: total + funções (códigos de 2 dígitos)
  const empenhada = exp.filter((i) => i.coluna === "Despesas Empenhadas");
  const total = empenhada.find((i) => /^Despesas Exceto Intraor/i.test(i.conta))?.valor ?? empenhada.filter((i) => /^\d{2} - /.test(i.conta)).reduce((a, i) => a + i.valor, 0);
  const fn = empenhada
    .filter((i) => /^\d{2} - /.test(i.conta))
    .map((i) => ({ code: i.conta.slice(0, 2), name: clean(i.conta), value: i.valor }));

  // receita bruta realizada: total + origens (nível "X.Y.0.0.00.0.0")
  const realizada = rev.filter((i) => i.coluna === "Receitas Brutas Realizadas");
  const revTotal = realizada.find((i) => i.cod_conta === "ReceitasExcetoIntraOrcamentarias")?.valor ?? 0;
  const origins = realizada
    .filter((i) => /^RO\d\.[1-9]\.0\.0\.00\.0\.0$/.test(i.cod_conta))
    .map((i) => ({ code: i.cod_conta, name: clean(i.conta), value: i.valor }));

  const first = exp[0];
  return {
    annual: { year, expenseTotal: total, expense: slices(fn, total), revenueTotal: revTotal, revenue: slices(origins, revTotal, 8) },
    pop: first.populacao ?? null,
    name: first.instituicao ?? null,
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
  const key = `budget:v1:${id}`;
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
