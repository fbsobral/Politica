import { cached, getJson, sidra, sidraYears } from "@/lib/indicators/core";

/*
 * Participação dos salários e taxa de exploração (Brasil), no sentido usado por Clara Mattei em "A Ordem do Capital":
 *   participação dos salários = remuneração dos empregados ÷ PIB (ou ÷ renda dos fatores);
 *   taxa de exploração        = excedente operacional bruto ÷ remuneração dos empregados
 *                               (quanto o capital recebe para cada R$ 1 pago em salários).
 *
 * As tabelas do IBGE são DESCOBERTAS pelo nome no catálogo do SIDRA (sem códigos fixos) e os valores são validados:
 * se algo não fizer sentido, o bloco fica indisponível em vez de mostrar número errado.
 */

const IBGE = "https://servicodados.ibge.gov.br/api/v3/agregados";

type Catalog = { id: string; nome: string; agregados: { id: string; nome: string }[] }[];
type Meta = {
  id: number;
  nome: string;
  periodicidade: { frequencia: string; inicio: number; fim: number };
  variaveis: { id: number; nome: string; unidade: string }[];
  classificacoes: { id: number; nome: string; categorias: { id: number; nome: string; nivel?: number }[] }[];
};
type ValuesResp = { id: string; variavel: string; unidade: string; resultados: { classificacoes: { id: string; categoria: Record<string, string> }[]; series: { serie: Record<string, string> }[] }[] }[];

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Itens da conta de geração da renda, reconhecidos pelo nome. */
const ITEMS = {
  wages: (n: string) => /remuneracao dos empregados/.test(n) && !/contribuic|salarios e ordenados/.test(n),
  surplus: (n: string) => /excedente operacional/.test(n) && !/liquido/.test(n) && !/rendimento misto/.test(n),
  mixed: (n: string) => /rendimento misto/.test(n) && !/liquido/.test(n) && !/excedente/.test(n),
  gdp: (n: string) => /^(produto interno bruto|pib)( a precos de mercado)?$/.test(n) || /^pib a precos (correntes|de mercado)/.test(n),
};
type ItemKey = keyof typeof ITEMS;

/** Onde cada item está numa tabela: como variável própria ou como categoria de uma classificação. */
type Loc = { variable: number; unit: string; classification?: { id: number; category: number } };
type Plan = { table: number; name: string; freq: "anual" | "trimestral"; from: number; to: number; locs: Partial<Record<ItemKey, Loc>> };

const MONEY = /reais|r\$/i;

function locate(meta: Meta, key: ItemKey): Loc | null {
  const test = ITEMS[key];
  const v = meta.variaveis.find((x) => test(norm(x.nome)) && MONEY.test(x.unidade));
  if (v) return { variable: v.id, unit: v.unidade };
  const money = meta.variaveis.find((x) => MONEY.test(x.unidade) && !/variacao|indice|taxa|%/.test(norm(x.nome)));
  if (!money) return null;
  for (const c of meta.classificacoes) {
    const cat = c.categorias.find((k) => test(norm(k.nome)));
    if (cat) return { variable: money.id, unit: money.unidade, classification: { id: c.id, category: cat.id } };
  }
  return null;
}

async function discover(): Promise<{ annual: Plan | null; quarterly: Plan | null }> {
  const catalog = await getJson<Catalog>(IBGE, 60000);
  const candidates = catalog
    .filter((p) => /contas? (nacionais|economicas|trimestrais)|sistema de contas/.test(norm(p.nome)))
    .flatMap((p) => p.agregados)
    .filter((a) => /renda|remuneracao|excedente|geracao|otica/.test(norm(a.nome)))
    .slice(0, 25);
  const plans: Plan[] = [];
  for (const a of candidates) {
    try {
      const meta = await getJson<Meta>(`${IBGE}/${a.id}/metadados`, 30000);
      const locs: Partial<Record<ItemKey, Loc>> = {};
      for (const k of Object.keys(ITEMS) as ItemKey[]) {
        const l = locate(meta, k);
        if (l) locs[k] = l;
      }
      if (!locs.wages || !locs.surplus) continue;
      const f = norm(meta.periodicidade.frequencia);
      const freq = f.startsWith("anual") ? "anual" : f.startsWith("trimestr") ? "trimestral" : null;
      if (!freq) continue;
      plans.push({ table: meta.id, name: meta.nome, freq, from: meta.periodicidade.inicio, to: meta.periodicidade.fim, locs });
    } catch (err) {
      console.warn("[labor-share] metadados", a.id, (err as Error).message);
    }
  }
  // a mais nova e mais longa de cada periodicidade
  const best = (freq: Plan["freq"]) => plans.filter((p) => p.freq === freq).sort((a, b) => b.to - a.to || a.from - b.from)[0] ?? null;
  return { annual: best("anual"), quarterly: best("trimestral") };
}

/** Períodos do SIDRA entre início e fim (anos: 2000; trimestres: 200001). */
function periods(p: Plan): string[] {
  const out: string[] = [];
  if (p.freq === "anual") for (let y = Math.max(p.from, 1990); y <= p.to; y++) out.push(String(y));
  else {
    const start = Math.max(p.from, 200001);
    for (let y = Math.floor(start / 100); y <= Math.floor(p.to / 100); y++) for (let q = 1; q <= 4; q++) {
      const k = y * 100 + q;
      if (k >= start && k <= p.to) out.push(String(k));
    }
  }
  return out;
}

async function fetchItem(p: Plan, loc: Loc): Promise<Record<string, number>> {
  const per = periods(p);
  const out: Record<string, number> = {};
  // o SIDRA limita o tamanho da consulta: lotes de 40 períodos
  for (let i = 0; i < per.length; i += 40) {
    const cls = loc.classification ? `&classificacao=${loc.classification.id}[${loc.classification.category}]` : "";
    const r = await getJson<ValuesResp>(`${IBGE}/${p.table}/periodos/${per.slice(i, i + 40).join("|")}/variaveis/${loc.variable}?localidades=N1[all]${cls}`, 40000);
    for (const v of r) for (const res of v.resultados) for (const s of res.series) for (const [k, val] of Object.entries(s.serie)) {
      const n = Number(val);
      if (Number.isFinite(n)) out[k] = n;
    }
  }
  return out;
}

/** PIB anual em R$ milhões (IBGE, tabela 6784, a mesma usada em Indicadores), quando a tabela de renda não traz o PIB. */
async function gdpFallback(p: Plan): Promise<Record<string, number>> {
  if (p.freq !== "anual" || !/milh/i.test(p.locs.wages!.unit)) return {};
  try {
    const rows = await sidra("t/6784/n1/1/v/9808/p/all");
    return Object.fromEntries(Object.entries(sidraYears(rows, "D3C")).map(([y, v]) => [String(y), v]));
  } catch {
    return {};
  }
}

export type SharePoint = {
  /** "2015" ou "2015-T3" */
  period: string;
  year: number;
  /** remuneração dos empregados ÷ PIB */
  wageGdp: number | null;
  /** remuneração ÷ (remuneração + excedente operacional + rendimento misto) */
  wageFactor: number | null;
  /** excedente operacional ÷ remuneração dos empregados */
  exploitation: number;
  /** valores de origem, em reais correntes (memória de cálculo) */
  wages: number;
  surplus: number;
  mixed: number | null;
  gdp: number | null;
};

/** Fator para converter a unidade do IBGE em reais ("Milhões de Reais" → 1e6). */
const scaleOf = (unit: string) => (/milh/i.test(unit) ? 1e6 : /bilh/i.test(unit) ? 1e9 : /\bmil\b/i.test(unit) ? 1e3 : 1);

async function series(p: Plan): Promise<SharePoint[]> {
  const [w, s, m, g] = await Promise.all([
    fetchItem(p, p.locs.wages!),
    fetchItem(p, p.locs.surplus!),
    p.locs.mixed ? fetchItem(p, p.locs.mixed).catch(() => ({})) : Promise.resolve({} as Record<string, number>),
    p.locs.gdp ? fetchItem(p, p.locs.gdp).catch(() => ({})) : gdpFallback(p),
  ]);
  const pts: SharePoint[] = [];
  for (const k of Object.keys(w).sort()) {
    const wage = w[k], surplus = (s as Record<string, number>)[k];
    if (!(wage > 0) || !(surplus > 0)) continue;
    const mixed = (m as Record<string, number>)[k], gdp = (g as Record<string, number>)[k];
    const wageGdp = gdp > 0 ? wage / gdp : null;
    const wageFactor = wage / (wage + surplus + (mixed > 0 ? mixed : 0));
    const exploitation = surplus / wage;
    // validação: fora destas faixas, a tabela encontrada não é a certa
    if ((wageGdp !== null && (wageGdp < 0.2 || wageGdp > 0.8)) || wageFactor < 0.2 || wageFactor > 0.9 || exploitation < 0.1 || exploitation > 4) continue;
    const year = Number(k.slice(0, 4));
    const f = scaleOf(p.locs.wages!.unit);
    pts.push({ period: k.length === 6 ? `${year}-T${Number(k.slice(4))}` : k, year, wageGdp, wageFactor, exploitation, wages: wage * f, surplus: surplus * f, mixed: mixed > 0 ? mixed * f : null, gdp: gdp > 0 ? gdp * f : null });
  }
  return pts;
}

/** Série anual do FRED (CSV público, sem chave): ano → valor. */
async function fred(id: string): Promise<Map<number, number>> {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PoliticaBot/1.0)" }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`FRED ${id} ${res.status}`);
  const out = new Map<number, number>();
  for (const line of (await res.text()).split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(",");
    const n = Number(v);
    if (/^\d{4}-/.test(d ?? "") && Number.isFinite(n)) out.set(Number(d.slice(0, 4)), n);
  }
  return out;
}

type LongPoint = {
  year: number;
  share: number;
  exploitation: number;
  profitRate: number | null;
  profitShare: number;
  outputCapital: number | null;
  /** valores de origem em dólares a preços correntes de PPC (memória de cálculo) */
  gdpPpp: number | null;
  capitalPpp: number | null;
};

/**
 * Penn World Table (via FRED), Brasil, desde 1950:
 *   participação do trabalho no PIB (inclui a parte do trabalho dos autônomos);
 *   taxa de lucro bruta = (1 − participação do trabalho) × PIB ÷ estoque de capital, os dois a preços correntes de PPC.
 */
async function pwt(): Promise<LongPoint[]> {
  const [labsh, gdp, cap] = await Promise.all([
    fred("LABSHPBRA156NRUG"),
    fred("CGDPOBRA666NRUG").catch(() => new Map<number, number>()),
    fred("CKSPPPBRA666NRUG").catch(() => new Map<number, number>()),
  ]);
  const out: LongPoint[] = [];
  for (const [year, share] of [...labsh.entries()].sort((a, b) => a[0] - b[0])) {
    if (!(share > 0.2 && share < 0.9)) continue;
    const y = gdp.get(year), k = cap.get(year);
    const outputCapital = y && k && k > 0 ? y / k : null;
    let profitRate = outputCapital !== null ? (1 - share) * outputCapital : null;
    // validação: taxa de lucro bruta da economia fica tipicamente entre 3% e 60%
    if (profitRate !== null && (profitRate < 0.03 || profitRate > 0.6)) profitRate = null;
    // a PWT publica PIB e capital em milhões de dólares
    out.push({ year, share, exploitation: (1 - share) / share, profitRate, profitShare: 1 - share, outputCapital: profitRate !== null ? outputCapital : null, gdpPpp: y ? y * 1e6 : null, capitalPpp: k && profitRate !== null ? k * 1e6 : null });
  }
  return out;
}

export type LaborShareData = {
  annual: SharePoint[];
  quarterly: SharePoint[];
  annualSource: string | null;
  quarterlySource: string | null;
  /** participação do trabalho no PIB (Penn World Table), longo prazo */
  longRun: LongPoint[];
  errors: string[];
  fetchedAt: string;
};

export async function buildLaborShare(): Promise<LaborShareData> {
  const errors: string[] = [];
  const [plans, long] = await Promise.all([
    discover().catch((err) => {
      errors.push("IBGE");
      console.warn("[labor-share] catálogo", (err as Error).message);
      return { annual: null, quarterly: null };
    }),
    pwt().catch((err) => {
      errors.push("Penn World Table");
      console.warn("[labor-share] pwt", (err as Error).message);
      return [] as LongPoint[];
    }),
  ]);
  const [annual, quarterly] = await Promise.all([
    plans.annual ? series(plans.annual).catch(() => (errors.push("IBGE anual"), [] as SharePoint[])) : Promise.resolve([] as SharePoint[]),
    plans.quarterly ? series(plans.quarterly).catch(() => (errors.push("IBGE trimestral"), [] as SharePoint[])) : Promise.resolve([] as SharePoint[]),
  ]);
  if (!annual.length && !long.length) throw new Error("sem dados"); // mantém o cache anterior
  return {
    annual,
    quarterly,
    annualSource: plans.annual && annual.length ? `IBGE, Contas Nacionais (tabela ${plans.annual.table}: ${plans.annual.name})` : null,
    quarterlySource: plans.quarterly && quarterly.length ? `IBGE (tabela ${plans.quarterly.table}: ${plans.quarterly.name})` : null,
    longRun: long,
    errors,
    fetchedAt: new Date().toISOString(),
  };
}

/** Dados de salários e lucros do Brasil (cache de 7 dias: as contas nacionais saem uma vez por ano, as trimestrais a cada 3 meses). */
export async function getLaborShare(opts: { force?: boolean } = {}): Promise<LaborShareData | null> {
  return cached("labor-share:v3", 7, buildLaborShare, opts.force);
}
