import { siconfi, getBudgetHistory, type BudgetScope } from "@/lib/budget";
import { db } from "@/lib/db";
import { clip, lastClosedYear, perYear, sgs, sidra, sidraYears, YEARS_BACK, type Geo, type Scope, type YearSeries } from "./core";

export type Fetcher = (geo: Geo) => Promise<YearSeries>;

const span = () => ({ from: lastClosedYear() - YEARS_BACK + 1, to: lastClosedYear() });

/* ───────── Banco Central ───────── */

/** Série do Banco Central (SGS) agregada por ano. */
export const bcb = (code: number, mode: "avg" | "last" | "sum" | "compound", scale = 1): Fetcher => async () => {
  const { from, to } = span();
  const s = clip(perYear(await sgs(code, from, to), mode), from, to);
  return scale === 1 ? s : Object.fromEntries(Object.entries(s).map(([y, v]) => [y, v * scale]));
};

/* ───────── IBGE (SIDRA) ───────── */

const terr = (scope: Scope, geo: Geo) => (scope === "FEDERAL" ? "n1/1" : scope === "ESTADUAL" ? `n3/${geo.ufCode}` : `n6/${geo.ibge}`);
const toRange = (s: YearSeries) => clip(s, span().from, span().to);

export const sidraPib = (scope: Scope): Fetcher => async (geo) => {
  if (scope === "FEDERAL") {
    const rows = await sidra("t/6784/n1/1/v/9808/p/all"); // R$ milhões (Contas Nacionais anuais, até 2023)
    const official: YearSeries = Object.fromEntries(Object.entries(sidraYears(rows, "D3C")).map(([y, v]) => [y, v * 1e6]));
    // anos mais novos: o PIB anual divulgado pelo IBGE nas Contas Trimestrais (valor preliminar, via Banco Central SGS 1207)
    const { from, to } = span();
    const recent = perYear(await sgs(1207, from, to), "last");
    for (const [y, v] of Object.entries(recent)) if (official[Number(y)] === undefined) official[Number(y)] = v;
    return toRange(official);
  }
  const rows = await sidra(`t/5938/${terr(scope, geo)}/v/37/p/all`); // R$ mil
  return toRange(Object.fromEntries(Object.entries(sidraYears(rows, "D3C")).map(([y, v]) => [y, v * 1e3])));
};

/**
 * População oficial: estimativas anuais do IBGE (tabela 6579) e, para 2022, o Censo (tabela 4714).
 * Em 2023 o IBGE não publicou estimativa municipal nem estadual, então esse ano fica sem valor (nada é inventado).
 */
export const sidraPop = (scope: Scope): Fetcher => async (geo) => {
  const t = terr(scope, geo);
  const [est, censo] = await Promise.all([sidra(`t/6579/${t}/v/9324/p/all`), sidra(`t/4714/${t}/v/93/p/all`).catch(() => [])]);
  return toRange({ ...sidraYears(est, "D3C"), ...sidraYears(censo, "D3C") });
};

/** PIB por habitante já publicado pelo IBGE (só existe pronto para o Brasil; estados e municípios não têm a série oficial). */
export const pibPerCapitaOficial: Fetcher = async () => toRange(sidraYears(await sidra("t/6784/n1/1/v/9812/p/all"), "D3C"));

/** Taxa de desocupação do 4º trimestre de cada ano, exatamente como o IBGE publica (PNAD Contínua). */
export const unemploymentQ4 = (scope: Scope, variable = 4099): Fetcher => async (geo) => {
  const rows = await sidra(`t/4099/${terr(scope, geo)}/v/${variable}/p/all`);
  const out: YearSeries = {};
  for (const r of rows) {
    const code = String(r.D3C);
    if (r.v !== null && code.endsWith("04")) out[Number(code.slice(0, 4))] = r.v;
  }
  return toRange(out);
};

/** Rendimento médio mensal REAL do trabalho (PNAD Contínua anual, tabela 7444): o IBGE já publica a preços do último ano, então nada é corrigido aqui. */
export const incomeReal = (scope: Scope): Fetcher => async (geo) => toRange(sidraYears(await sidra(`t/7444/${terr(scope, geo)}/v/10774/p/all`), "D3C"));

/** Série anual pronta do IBGE (SIDRA) para Brasil ou UF, exatamente como publicada; `classes` fixa as categorias "Total" quando a tabela tem cortes. Nada é calculado. */
export const sidraAnnual = (scope: Scope, table: number, variable: number, classes = ""): Fetcher => async (geo) => {
  const rows = await sidra(`t/${table}/${terr(scope, geo)}/v/${variable}${classes}/p/all`);
  // com classificações na URL a coluna do ano muda de posição: acha a que traz um ano (1900–2099)
  const col = ["D3C", "D4C", "D5C", "D6C", "D7C"].find((c) => /^(19|20)\d{2}$/.test(String((rows[0] as Record<string, unknown> | undefined)?.[c] ?? ""))) ?? "D3C";
  return toRange(sidraYears(rows, col));
};

export const giniSidra = (scope: Scope): Fetcher => async (geo) => toRange(sidraYears(await sidra(`t/7435/${terr(scope, geo)}/v/10681/p/all`), "D3C"));

/**
 * Valor adicionado por setor (Contas Regionais do IBGE, tabela 5938), como publicado, para Brasil, UF e município.
 * `scale` só converte a unidade (mil reais -> reais). A série vai até o último ano publicado (hoje 2021) e mostra até os 20 anos mais recentes.
 */
export const sectorFor = (scope: Scope, variable: number, scale = 1): Fetcher => async (geo) => {
  const rows = await sidra(`t/5938/${terr(scope, geo)}/v/${variable}/p/all`);
  const all = sidraYears(rows, "D3C");
  const ys = Object.keys(all).map(Number).sort((a, b) => a - b);
  const last = ys[ys.length - 1];
  const out: YearSeries = {};
  for (const y of ys) if (y > last - YEARS_BACK) out[y] = all[y] * scale;
  return out;
};

/** Censo de empresas (CEMPRE): salário médio mensal em R$ e pessoal ocupado. */
export const cempre = (variable: 10143 | 707): Fetcher => async (geo) => toRange(sidraYears(await sidra(`t/1685/n6/${geo.ibge}/v/${variable}/p/all`), "D3C"));

/* ───────── Tesouro (Siconfi): RGF ───────── */

async function rgfYear(ente: string, year: number, anexo: "RGF-Anexo 01" | "RGF-Anexo 02"): Promise<{ cod_conta: string; coluna: string; valor: number }[]> {
  for (const [per, nr] of [["Q", 3], ["S", 2]] as const) {
    try {
      const rows = await siconfi("rgf", { an_exercicio: year, in_periodicidade: per, nr_periodo: nr, co_tipo_demonstrativo: "RGF", no_anexo: anexo, co_poder: "E", id_ente: ente });
      if (rows.length) return rows as never;
    } catch {
      /* tenta a outra periodicidade */
    }
  }
  return [];
}

async function eachYear(fn: (y: number) => Promise<number | null>): Promise<YearSeries> {
  const { from, to } = span();
  const years = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const out: YearSeries = {};
  let next = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < years.length) {
      const y = years[next++];
      const v = await fn(y).catch(() => null);
      if (v !== null && Number.isFinite(v)) out[y] = v;
    }
  }));
  return out;
}

const entity = (scope: Scope, geo: Geo) => (scope === "ESTADUAL" ? String(geo.ufCode) : geo.ibge);

/** Dívida consolidada líquida como % da receita corrente líquida (fim do ano). */
export const dclRcl = (scope: Scope): Fetcher => async (geo) =>
  eachYear(async (y) => {
    const rows = await rgfYear(entity(scope, geo), y, "RGF-Anexo 02");
    return rows.find((r) => r.cod_conta === "PercentualDaDCLSobreARCL" && /^At[ée] o (3º Quadrimestre|2º Semestre)/i.test(r.coluna))?.valor ?? null;
  });

/** Despesa total com pessoal em % da RCL, na coluna "% sobre a RCL Ajustada" publicada no RGF (nada é calculado aqui). */
export const pessoalRcl = (scope: Scope): Fetcher => async (geo) =>
  eachYear(async (y) => {
    const rows = await rgfYear(entity(scope, geo), y, "RGF-Anexo 01");
    return rows.find((r) => r.cod_conta === "DespesaComPessoalTotal" && r.coluna === "% sobre a RCL Ajustada")?.valor ?? null;
  });

/* ───────── valores em R$ publicados no DCA (Siconfi) ───────── */

const budgetScope = (scope: Scope): BudgetScope => scope;

/** Valor (R$ do ano) de um tipo de gasto, exatamente como o ente declarou no DCA (ex.: Pessoal e encargos sociais). */
export const expenseValue = (scope: Scope, natureCode: string): Fetcher => async (geo) => {
  const h = await getBudgetHistory(budgetScope(scope), { uf: geo.uf, municipalityKey: geo.municipalityKey });
  return h?.nature.find((x) => x.code === natureCode)?.values ?? {};
};

/** Valor (R$ do ano) de uma origem de receita declarada no DCA (ex.: Transferências correntes). */
export const revenueValue = (scope: Scope, name: RegExp): Fetcher => async (geo) => {
  const h = await getBudgetHistory(budgetScope(scope), { uf: geo.uf, municipalityKey: geo.municipalityKey });
  return h?.revenue.find((x) => !x.parent && name.test(x.name))?.values ?? {};
};

/** Despesa ou receita total declarada no DCA. */
export const budgetTotal = (scope: Scope, kind: "expense" | "revenue"): Fetcher => async (geo) => {
  const h = await getBudgetHistory(budgetScope(scope), { uf: geo.uf, municipalityKey: geo.municipalityKey });
  return h ? { ...h.totals[kind] } : {};
};

/* ───────── séries gravadas por jobs (arquivos grandes do IPEA) ───────── */

/** Lê o que o job de indicadores gravou; nunca baixa nada durante a visita do usuário. */
export const stored = (id: string, scope: Scope): Fetcher => async (geo) => {
  const place = scope === "FEDERAL" ? "br" : scope === "ESTADUAL" ? geo.uf : geo.ibge;
  const hit = await db.budgetCache.findUnique({ where: { key: `ind:v1:${id}:${scope}:${place}` } });
  return (hit?.data as unknown as YearSeries | undefined) ?? {};
};
