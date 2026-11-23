import { siconfi, getBudgetHistory, type BudgetScope } from "@/lib/budget";
import { db } from "@/lib/db";
import { clip, getJson, lastClosedYear, perYear, perYearPartial, sgs, sidra, sidraYears, withPartial, YEARS_BACK, type Geo, type Scope, type YearSeries } from "./core";

export type Fetcher = (geo: Geo) => Promise<YearSeries>;

/** De 30 anos atrás até o ano corrente: o valor do ano corrente é parcial (o mais recente publicado no ano). */
const span = () => ({ from: lastClosedYear() - YEARS_BACK + 1, to: lastClosedYear() + 1 });

/* ───────── Banco Central ───────── */

/** Série do Banco Central (SGS) agregada por ano. */
export const bcb = (code: number, mode: "avg" | "last" | "sum" | "compound", scale = 1): Fetcher => async () => {
  const { from, to } = span();
  const { series, partial } = perYearPartial(await sgs(code, from, to), mode);
  const s = clip(series, from, to);
  const scaled = scale === 1 ? s : Object.fromEntries(Object.entries(s).map(([y, v]) => [y, v * scale]));
  return withPartial(scaled, partial && { ...partial, prev: partial.prev === null ? null : partial.prev * scale });
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
    // ano corrente: parcial, a soma dos trimestres já divulgados nas Contas Trimestrais (IBGE, tabela 1846)
    const cur = lastClosedYear() + 1;
    let partial = null;
    if (official[cur] === undefined) {
      const q = (await sidra(`t/1846/n1/all/v/585/p/last%208/c11255/90707`).catch(() => [])).filter((r) => r.v !== null);
      const quarters = q.filter((r) => String(r.D3C).startsWith(String(cur))).map((r) => Number(String(r.D3C).slice(4)));
      const sumOf = (y: number) => q.filter((r) => String(r.D3C).startsWith(String(y)) && quarters.includes(Number(String(r.D3C).slice(4)))).reduce((a, r) => a + (r.v as number), 0);
      if (quarters.length && quarters.length < 4) {
        official[cur] = sumOf(cur) * 1e6;
        const n = Math.max(...quarters);
        const prev = sumOf(cur - 1);
        partial = { year: cur, label: n === 1 ? "1º tri" : `1º–${n}º tri`, prev: prev ? prev * 1e6 : null };
      }
    }
    return withPartial(toRange(official), partial);
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
  // ano corrente (parcial): o trimestre mais recente já divulgado, comparado com o mesmo trimestre do ano anterior
  const cur = lastClosedYear() + 1;
  const latest = rows.filter((r) => r.v !== null && String(r.D3C).startsWith(String(cur))).sort((a, b) => String(b.D3C).localeCompare(String(a.D3C)))[0];
  let partial = null;
  if (latest && out[cur] === undefined) {
    out[cur] = latest.v as number;
    const q = String(latest.D3C).slice(4);
    const prev = rows.find((r) => String(r.D3C) === `${cur - 1}${q}` && r.v !== null);
    partial = { year: cur, label: `${Number(q)}º tri`, prev: prev ? (prev.v as number) : null };
  }
  return withPartial(toRange(out), partial);
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

/** Censo 2022 (IBGE): um único ano, para Brasil, estados e municípios. `complement` devolve 100 − valor (ex.: alfabetização → analfabetismo). */
export const censo2022 = (scope: Scope, table: number, variable: number, classes: string, complement = false): Fetcher => async (geo) => {
  const s = await sidraAnnual(scope, table, variable, classes)(geo);
  return complement ? Object.fromEntries(Object.entries(s).map(([y, v]) => [Number(y), Math.round((100 - v) * 100) / 100])) : s;
};

/** Soma, ano a ano, várias categorias de uma classificação do SIDRA (ex.: deslocamento "mais de 1 hora" = três faixas). */
export const sidraSum = (scope: Scope, table: number, variable: number, classes: string): Fetcher => async (geo) => {
  const rows = await sidra(`t/${table}/${terr(scope, geo)}/v/${variable}${classes}/p/all`);
  const col = ["D3C", "D4C", "D5C", "D6C", "D7C"].find((c) => /^(19|20)\d{2}$/.test(String((rows[0] as Record<string, unknown> | undefined)?.[c] ?? ""))) ?? "D3C";
  const out: YearSeries = {};
  for (const r of rows) {
    const y = Number(String(r[col]).slice(0, 4));
    if (r.v !== null && Number.isFinite(y)) out[y] = Math.round(((out[y] ?? 0) + r.v) * 100) / 100;
  }
  return toRange(out);
};

/** Razão entre duas categorias de uma classificação do SIDRA, em % (ex.: renda das mulheres ÷ renda dos homens × 100). */
export const sidraRatio = (scope: Scope, table: number, variable: number, cls: number, num: number, den: number): Fetcher => async (geo) => {
  const rows = await sidra(`t/${table}/${terr(scope, geo)}/v/${variable}/p/all/c${cls}/${num},${den}`);
  const col = ["D3C", "D4C", "D5C"].find((c) => /^(19|20)\d{2}$/.test(String((rows[0] as Record<string, unknown> | undefined)?.[c] ?? ""))) ?? "D3C";
  const catCol = ["D3C", "D4C", "D5C"].find((c) => c !== col && rows.some((r) => String(r[c]) === String(num))) ?? "D4C";
  const by: Record<number, { n?: number; d?: number }> = {};
  for (const r of rows) {
    if (r.v === null) continue;
    const y = Number(String(r[col]).slice(0, 4));
    const o = (by[y] ??= {});
    if (String(r[catCol]) === String(num)) o.n = r.v; else o.d = r.v;
  }
  const out: YearSeries = {};
  for (const [y, o] of Object.entries(by)) if (o.n != null && o.d) out[Number(y)] = Math.round((o.n / o.d) * 1000) / 10;
  return toRange(out);
};

/** Série anual do Brasil no Banco Mundial (indicadores que o IBGE não publica, como vacinação e poluição do ar). */
export const worldBank = (code: string): Fetcher => async () => {
  const j = await getJson<[unknown, { date: string; value: number | null }[] | null]>(`https://api.worldbank.org/v2/country/BRA/indicator/${code}?format=json&per_page=100`, 90000);
  const out: YearSeries = {};
  for (const r of j[1] ?? []) if (r.value != null) out[Number(r.date)] = Math.round(r.value * 100) / 100;
  if (!Object.keys(out).length) throw new Error(`Banco Mundial sem dados para ${code}`);
  return toRange(out);
};

/**
 * Crescimento real do PIB: anos fechados pelo Banco Central (SGS 7326) e, no ano corrente, a taxa acumulada no ano
 * contra o mesmo período do ano anterior, das Contas Trimestrais do IBGE (tabela 5932). Ela já é uma comparação
 * com o mesmo período, então não há outro valor para comparar.
 */
export const pibGrowth: Fetcher = async (geo) => {
  const base = await bcb(7326, "last")(geo);
  const cur = lastClosedYear() + 1;
  if (base[cur] !== undefined) return base;
  const rows = (await sidra("t/5932/n1/all/v/6563/p/last%204/c11255/90707").catch(() => [])).filter((r) => r.v !== null && String(r.D3C).startsWith(String(cur)));
  const last = rows.sort((a, b) => String(b.D3C).localeCompare(String(a.D3C)))[0];
  if (!last) return base;
  const q = Number(String(last.D3C).slice(4));
  if (q >= 4) return base;
  return withPartial({ ...base, [cur]: last.v as number }, { year: cur, label: q === 1 ? "1º tri" : `1º–${q}º tri`, prev: null });
};

export const giniSidra = (scope: Scope): Fetcher => async (geo) => toRange(sidraYears(await sidra(`t/7435/${terr(scope, geo)}/v/10681/p/all`), "D3C"));

/**
 * Valor adicionado por setor (Contas Regionais do IBGE, tabela 5938), como publicado, para Brasil, UF e município.
 * `scale` só converte a unidade (mil reais -> reais). A série vai até o último ano publicado (hoje 2021) e mostra até os 30 anos mais recentes.
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
  const { to } = span();
  const from = Math.max(span().from, 2013); // o Siconfi (RGF) não tem anos anteriores a 2013
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
/** Anos que o IPEA marca como ESTIMADOS (não publicados pela fonte primária): ficam de fora, pela regra de só usar dado real. */
const ESTIMATED_BY_IPEA: Record<string, number[]> = { pobreza: [2025], "pobreza-int": [2025] };

export const stored = (id: string, scope: Scope): Fetcher => async (geo) => {
  const place = scope === "FEDERAL" ? "br" : scope === "ESTADUAL" ? geo.uf : geo.ibge;
  const hit = await db.budgetCache.findUnique({ where: { key: `ind:v1:${id}:${scope}:${place}` } });
  const data = { ...((hit?.data as unknown as YearSeries | undefined) ?? {}) };
  for (const y of ESTIMATED_BY_IPEA[id] ?? []) delete data[y];
  return data;
};
