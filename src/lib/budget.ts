import { db } from "@/lib/db";
import { ibgeIdFor } from "@/lib/ibge";

const API = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt";
const DAY = 24 * 3600 * 1000;

export type BudgetScope = "MUNICIPAL" | "ESTADUAL" | "FEDERAL";

/** Código IBGE das UFs (2 dígitos) — é o id_ente dos estados no Siconfi. */
export const UF_CODE: Record<string, number> = {
  RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29,
  MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53,
};

export type Item = { exercicio: number; instituicao: string; cod_ibge: number; uf: string; populacao: number | null; anexo: string; rotulo: string; coluna: string; cod_conta: string; conta: string; valor: number };

export type Slice = { code: string; name: string; value: number; share: number; /** participação dentro do item pai */ shareOfParent?: number; children?: Slice[] };

export type Annual = {
  year: number;
  expenseTotal: number;
  expense: Slice[]; // por função, maior primeiro
  revenueTotal: number;
  revenue: Slice[]; // por origem, maior primeiro
  /** despesa por natureza econômica (pessoal, juros, investimentos…); vazio se o município não declarou */
  nature: Slice[];
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

export async function siconfi(path: string, params: Record<string, string | number>): Promise<Item[]> {
  const url = `${API}/${path}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`Siconfi ${res.status}`);
  const json = (await res.json()) as { items: Item[] };
  return json.items ?? [];
}

const clean = (conta: string) => conta.replace(/^\d+(\.\d+)*\s*-?\s*/, "").trim();

function childrenOf(rows: Raw[], parent: string, total: number, parentValue: number, limit = 14): Slice[] {
  const kids = rows.filter((r) => r.parent === parent && r.value > 0).sort((a, b) => b.value - a.value);
  const top = kids.slice(0, limit).map((r) => ({
    code: r.code,
    name: r.name,
    value: r.value,
    share: total > 0 ? r.value / total : 0,
    shareOfParent: parentValue > 0 ? r.value / parentValue : 0,
    children: childrenOf(rows, r.code, total, r.value, limit),
  }));
  const rest = kids.slice(limit).reduce((acc, r) => acc + r.value, 0);
  if (rest > 0) top.push({ code: `${parent}:outros`, name: "Outros", value: rest, share: total > 0 ? rest / total : 0, shareOfParent: parentValue > 0 ? rest / parentValue : 0, children: [] });
  return top.map((t) => (t.children?.length ? t : { ...t, children: undefined }));
}

/** Itens de primeiro nível (sem pai) com seus filhos, maior primeiro; o resto vira "Outras". */
function slices(rows: Raw[], total: number, take = 12): Slice[] {
  const roots = rows.filter((r) => !r.parent && r.value > 0).sort((a, b) => b.value - a.value);
  const top = roots.slice(0, take);
  const rest = roots.slice(take).reduce((acc, r) => acc + r.value, 0);
  const out: Slice[] = top.map((r) => ({ code: r.code, name: r.name, value: r.value, share: total > 0 ? r.value / total : 0, children: childrenOf(rows, r.code, total, r.value) }));
  if (rest > 0) out.push({ code: "outros", name: "Outras", value: rest, share: total > 0 ? rest / total : 0 });
  return out.map((o) => (o.children?.length ? o : { ...o, children: undefined }));
}

type Raw = { code: string; name: string; value: number; parent?: string };
type DcaYear = { year: number; empty?: boolean; name: string | null; pop: number | null; expenseTotal: number; expense: Raw[]; revenueTotal: number; revenue: Raw[]; nature?: Raw[] };

/** Interpreta os anexos I-E (despesa por função) e I-C (receita) do DCA, nos formatos antigo (até 2017) e novo. */
function parseDca(exp: Item[], rev: Item[], year: number): DcaYear {
  if (!exp.length) return { year, empty: true, name: null, pop: null, expenseTotal: 0, expense: [], revenueTotal: 0, revenue: [] };
  const empenhada = exp.filter((i) => i.coluna === "Despesas Empenhadas");
  const fn: Raw[] = empenhada.filter((i) => /^\d{2} - /.test(i.conta)).map((i) => ({ code: i.conta.slice(0, 2), name: clean(i.conta), value: i.valor }));
  const fnSum = fn.reduce((a, r) => a + r.value, 0);
  const expenseTotal = empenhada.find((i) => /^Despesas \(?Exceto Intraor/i.test(i.conta))?.valor ?? fnSum;
  // subfunções (NN.NNN) e o agregado "FUnn - Demais Subfunções"
  const subs: Raw[] = empenhada.filter((i) => /^\d{2}\.\d{3} - /.test(i.conta)).map((i) => ({ code: i.conta.slice(0, 6), name: clean(i.conta), value: i.valor, parent: i.conta.slice(0, 2) }));
  const demais: Raw[] = empenhada.filter((i) => /^FU\d{2} - /.test(i.conta)).map((i) => ({ code: `${i.conta.slice(2, 4)}.out`, name: "Demais subfunções", value: i.valor, parent: i.conta.slice(2, 4) }));
  const fnCodes = new Set(fn.map((f) => f.code));
  const expense = [...fn, ...[...subs, ...demais].filter((r) => fnCodes.has(r.parent!))];

  const realizada = rev.filter((i) => i.coluna === "Receitas Brutas Realizadas");
  const cat = (c: string) => realizada.find((i) => /^RO\d\.0(\.0+)+$/.test(i.cod_conta) && i.cod_conta.startsWith(c))?.valor ?? 0;
  const revenueTotal =
    realizada.find((i) => i.cod_conta === "ReceitasExcetoIntraOrcamentarias")?.valor ??
    realizada.find((i) => i.cod_conta === "TotalReceitas")?.valor ??
    cat("RO1") + cat("RO2");

  // árvore da receita: origem (RO1.1) → grupos → tributo (IPTU, ISS...). Níveis fundos têm código instável entre anos: usamos o caminho de nomes.
  type N = { id: string; segs: number[]; depth: number; name: string; value: number };
  const nodes: N[] = realizada
    .filter((i) => /^RO\d(\.\d+)+$/.test(i.cod_conta) && i.valor !== 0)
    .map((i) => {
      const segs = i.cod_conta.slice(2).split(".").map(Number);
      let d = segs.length;
      while (d > 0 && segs[d - 1] === 0) d--;
      return { id: segs.slice(0, d).join("."), segs, depth: d, name: clean(i.conta), value: i.valor };
    })
    .filter((n) => n.depth >= 2);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const keyOf = new Map<string, string>();
  const key = (n: N): string => {
    const hit = keyOf.get(n.id);
    if (hit) return hit;
    let parent: N | undefined;
    for (let d = n.depth - 1; d >= 2 && !parent; d--) parent = byId.get(n.segs.slice(0, d).join("."));
    const k = n.depth === 2 ? `RO${n.id}` : `${parent ? key(parent) : "RO" + n.segs.slice(0, 2).join(".")}>${n.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, " ").trim()}`;
    keyOf.set(n.id, k);
    return k;
  };
  const revenue: Raw[] = nodes.map((n) => {
    let parent: N | undefined;
    for (let d = n.depth - 1; d >= 2 && !parent; d--) parent = byId.get(n.segs.slice(0, d).join("."));
    return { code: key(n), name: n.name, value: n.value, parent: parent ? key(parent) : undefined };
  });

  return { year, name: exp[0].instituicao ?? null, pop: exp[0].populacao ?? null, expenseTotal, expense, revenueTotal, revenue };
}

/** Grupos de natureza da despesa (DCA Anexo I-D): 3.x correntes e 4.x capital. */
const NATURE_NAMES: Record<string, string> = {
  "3.1": "Pessoal e encargos sociais",
  "3.2": "Juros e encargos da dívida",
  "3.3": "Outras despesas correntes",
  "4.4": "Investimentos",
  "4.5": "Inversões financeiras",
  "4.6": "Amortização da dívida",
};

function parseNature(items: Item[]): Raw[] {
  const out: Raw[] = [];
  for (const i of items) {
    if (i.coluna !== "Despesas Empenhadas") continue;
    const m = /^([34]\.\d)\.00\.00\.00 - /.exec(i.conta);
    if (m && NATURE_NAMES[m[1]]) out.push({ code: `nat:${m[1]}`, name: NATURE_NAMES[m[1]], value: i.valor });
  }
  return out;
}

async function fetchDca(id: number, year: number): Promise<DcaYear> {
  const [exp, rev, nat] = await Promise.all([
    siconfi("dca", { an_exercicio: year, no_anexo: "DCA-Anexo I-E", id_ente: id }),
    siconfi("dca", { an_exercicio: year, no_anexo: "DCA-Anexo I-C", id_ente: id }),
    siconfi("dca", { an_exercicio: year, no_anexo: "DCA-Anexo I-D", id_ente: id }).catch(() => [] as Item[]),
  ]);
  return { ...parseDca(exp, rev, year), nature: parseNature(nat) };
}

function natureSlices(rows: Raw[]): Slice[] {
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (total <= 0) return [];
  return rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value).map((r) => ({ code: r.code, name: r.name, value: r.value, share: r.value / total }));
}

async function fetchAnnual(id: number, year: number): Promise<{ annual: Annual | null; pop: number | null; name: string | null }> {
  const d = await fetchDca(id, year);
  if (d.empty) return { annual: null, pop: null, name: null };
  return {
    annual: { year, expenseTotal: d.expenseTotal, expense: slices(d.expense, d.expenseTotal), revenueTotal: d.revenueTotal, revenue: slices(d.revenue, d.revenueTotal, 10), nature: natureSlices(d.nature ?? []) },
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

/** Só lê o cache do banco (sem ir ao Tesouro): usado para montar o contexto do agente sem custo de espera. */
export async function peekBudget(scope: BudgetScope, user: { uf: string; municipalityKey: string }): Promise<BudgetData | null> {
  const id = scope === "FEDERAL" ? 1 : scope === "ESTADUAL" ? UF_CODE[user.uf] : await ibgeIdFor(user.uf, user.municipalityKey);
  if (!id) return null;
  const hit = await db.budgetCache.findUnique({ where: { key: `budget:v4:${id}` } });
  return (hit?.data as unknown as BudgetData | undefined) ?? null;
}

/** Busca os números de uma esfera (com cache no banco: 7 dias para o fechado do ano, 1 dia para o ano corrente). */
export async function getBudget(scope: BudgetScope, user: { uf: string; municipalityKey: string }, opts: { force?: boolean } = {}): Promise<BudgetData | null> {
  const id = scope === "FEDERAL" ? 1 : scope === "ESTADUAL" ? UF_CODE[user.uf] : await ibgeIdFor(user.uf, user.municipalityKey);
  if (!id) return null;
  const key = `budget:v4:${id}`;
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


/* ───────── Ano corrente parcial (RREO) e projeção ───────── */

const normName = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const NATURE_BY_ROTULO: Record<string, string> = {
  PessoalEEncargosSociais: "nat:3.1",
  JurosEEncargosDaDivida: "nat:3.2",
  OutrasDespesasCorrentes: "nat:3.3",
  Investimentos: "nat:4.4",
  InversoesFinanceiras: "nat:4.5",
  AmortizacaoDaDivida: "nat:4.6",
};

/** Acumulado até o bimestre, por nome normalizado (função, origem da receita) e por grupo de natureza. */
type Cum = { expenseTotal: number; revenueTotal: number; expense: Record<string, number>; revenue: Record<string, number>; nature: Record<string, number> };

async function fetchRreoCum(id: number, year: number, period: number): Promise<Cum | null> {
  const get = (anexo: string) => siconfi("rreo", { an_exercicio: year, nr_periodo: period, co_tipo_demonstrativo: "RREO", no_anexo: anexo, id_ente: id });
  const [a1, a2] = await Promise.all([get("RREO-Anexo 01"), get("RREO-Anexo 02").catch(() => [] as Item[])]);
  if (!a1.length) return null;
  const cum: Cum = { expenseTotal: 0, revenueTotal: 0, expense: {}, revenue: {}, nature: {} };
  for (const i of a1) {
    if (/^At. o Bimestre \(c\)/i.test(i.coluna)) {
      if (i.cod_conta === "ReceitasExcetoIntraOrcamentarias") cum.revenueTotal = i.valor;
      const k = normName(i.conta);
      if (!(k in cum.revenue)) cum.revenue[k] = i.valor;
    } else if (/^DESPESAS EMPENHADAS AT. O BIME/i.test(i.coluna)) {
      if (i.cod_conta === "DespesasExcetoIntraOrcamentarias") cum.expenseTotal = i.valor;
      const code = NATURE_BY_ROTULO[i.cod_conta];
      if (code) cum.nature[code] = i.valor;
    }
  }
  for (const i of a2) {
    if (!/^DESPESAS EMPENHADAS AT. O BIME/i.test(i.coluna) || /^DESPESAS \(/i.test(i.conta) || /^FU\d{2} - /.test(i.conta)) continue;
    const k = normName(i.conta);
    if (!(k in cum.expense)) cum.expense[k] = i.valor; // a função vem antes das suas subfunções
  }
  return cum;
}

async function rreoCached(id: number, year: number, period: number, ttlDays: number): Promise<Cum | null> {
  const key = `budget:rreo:v1:${id}:${year}:${period}`;
  const hit = await db.budgetCache.findUnique({ where: { key } });
  const d = hit?.data as unknown as (Cum & { empty?: boolean }) | undefined;
  if (hit && d && Date.now() - hit.fetchedAt.getTime() < (d.empty ? 1 : ttlDays) * DAY) return d.empty ? null : d;
  try {
    const fresh = await fetchRreoCum(id, year, period);
    const data = fresh ?? { empty: true };
    await db.budgetCache.upsert({ where: { key }, create: { key, data: data as never }, update: { data: data as never, fetchedAt: new Date() } });
    return fresh;
  } catch (err) {
    console.warn("[budget:rreo]", id, year, period, (err as Error).message);
    return d && !d.empty ? d : null;
  }
}

/** Projeta o ano a partir do acumulado: divide pela fração que costuma estar acumulada no mesmo bimestre (mediana dos anos anteriores). */
function projectYear(current: number, priors: { c: number; f: number }[], period: number): { value: number; seasonal: boolean } {
  const ratios = priors.filter((p) => p.c > 0 && p.f > 0).map((p) => p.c / p.f).filter((r) => r > 0.05 && r <= 1.2).sort((a, b) => a - b);
  if (ratios.length >= 2) {
    const med = ratios[Math.floor(ratios.length / 2)];
    // anos muito dispersos = série irregular (envio atrasado, evento atípico): não confia na sazonalidade
    if ((ratios[ratios.length - 1] - ratios[0]) / med < 0.35) return { value: current / med, seasonal: true };
  }
  return { value: (current * 6) / period, seasonal: false };
}

async function buildPartial(
  id: number,
  now: number,
  have: number[],
  series: { expense: Series[]; revenue: Series[]; nature: Series[] },
  totals: { expense: Record<number, number>; revenue: Record<number, number>; nature: Record<number, number> },
): Promise<PartialYear | null> {
  let period = 0;
  let cur: Cum | null = null;
  for (let p = 6; p >= 1 && !cur; p--) {
    const c = await rreoCached(id, now, p, 1);
    if (c && (c.expenseTotal > 0 || c.revenueTotal > 0)) {
      cur = c;
      period = p;
    }
  }
  if (!cur) return null;
  const priorYears = have.filter((y) => y < now).slice(-3);
  const priorCum = new Map<number, Cum>();
  for (const y of priorYears) {
    const c = await rreoCached(id, y, period, 90);
    if (c) priorCum.set(y, c);
  }

  const actual: Record<string, number> = {};
  const projected: Record<string, number> = {};
  let seasonalTotals = true;
  const put = (key: string, current: number | undefined, prior: (c: Cum) => number | undefined, past: Record<number, number>, isTotal: boolean) => {
    if (current === undefined || current <= 0) return;
    const priors = priorYears.flatMap((y) => {
      const c = priorCum.get(y);
      const cv = c ? prior(c) : undefined;
      return cv !== undefined && past[y] !== undefined ? [{ c: cv, f: past[y] }] : [];
    });
    const p = projectYear(current, priors, period);
    if (isTotal && !p.seasonal) seasonalTotals = false;
    actual[key] = current;
    projected[key] = Math.max(current, p.value);
  };

  put("total:expense", cur.expenseTotal, (c) => c.expenseTotal, totals.expense, true);
  put("total:revenue", cur.revenueTotal, (c) => c.revenueTotal, totals.revenue, true);
  for (const s of series.expense.filter((x) => !x.parent)) put(s.code, cur.expense[normName(s.name)], (c) => c.expense[normName(s.name)], s.values, false);
  for (const s of series.revenue.filter((x) => !x.parent)) put(s.code, cur.revenue[normName(s.name)], (c) => c.revenue[normName(s.name)], s.values, false);
  for (const s of series.nature) put(s.code, cur.nature[s.code], (c) => c.nature[s.code], s.values, false);
  // a natureza é outro corte da mesma despesa: o total e as fatias seguem a projeção da despesa total
  if (actual["total:expense"] !== undefined) {
    actual["total:nature"] = actual["total:expense"];
    projected["total:nature"] = projected["total:expense"];
    const codes = series.nature.map((x) => x.code).filter((c) => projected[c] !== undefined);
    const sum = codes.reduce((a, c) => a + projected[c], 0);
    if (sum > 0) for (const c of codes) projected[c] *= projected["total:nature"] / sum;
  }

  if (actual["total:expense"] === undefined && actual["total:revenue"] === undefined) return null;
  return { year: now, period, method: seasonalTotals ? "sazonal" : "linear", actual, projected };
}

/* ───────── Histórico de 10 anos ───────── */

export type Series = { code: string; name: string; parent?: string; values: Record<number, number> };

export type PartialYear = {
  year: number;
  period: number; // bimestre
  /** "sazonal": projeta pelo que já estava acumulado nos anos anteriores no mesmo bimestre; "linear": só proporcional (menos confiável) */
  method: "sazonal" | "linear";
  /** chaves: código da série, "total:expense", "total:revenue" ou "total:nature" */
  actual: Record<string, number>;
  projected: Record<string, number>;
};

export type BudgetHistory = {
  scope: BudgetScope;
  entity: string;
  years: number[];
  expense: Series[];
  revenue: Series[];
  nature: Series[];
  /** ano corrente: acumulado até o último bimestre publicado e projeção; null se não houver dados */
  partial: PartialYear | null;
  totals: { expense: Record<number, number>; revenue: Record<number, number>; nature: Record<number, number> };
  population: Record<number, number>;
  /** fator para converter o valor nominal de cada ano para os preços do último ano (IPCA) */
  deflator: Record<number, number>;
  fetchedAt: string;
};

/** Média anual do IPCA (número-índice, IBGE/SIDRA 1737) por ano; cache de 30 dias. */
async function ipcaByYear(): Promise<Record<number, number>> {
  const key = "ipca:v2";
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
    for (const [y, list] of Object.entries(byYear)) if (list.length >= 11 || (Number(y) === new Date().getFullYear() && list.length >= 1)) avg[Number(y)] = list.reduce((a, b) => a + b, 0) / list.length;
    await db.budgetCache.upsert({ where: { key }, create: { key, data: avg as never }, update: { data: avg as never, fetchedAt: new Date() } });
    return avg;
  } catch (err) {
    console.warn("[ipca]", (err as Error).message);
    return hit ? (hit.data as unknown as Record<number, number>) : {};
  }
}

async function dcaCached(id: number, year: number, ttlDays: number, force: boolean): Promise<DcaYear> {
  const key = `budget:dca:v5:${id}:${year}`;
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

/** Tributos e transferências conhecidos: o código/nome muda entre os anos (nova classificação em 2018), então as séries são montadas por nome. */
const CANON: { key: string; name: string; parent: string; re: RegExp }[] = [
  { key: "iptu", name: "IPTU (propriedade urbana)", parent: "RO1.1", re: /propriedade predial e territorial urbana/ },
  { key: "iss", name: "ISS (serviços)", parent: "RO1.1", re: /^impostos? sobre servicos|^imposto sobre servicos/ },
  { key: "itbi", name: "ITBI (transmissão de imóveis)", parent: "RO1.1", re: /transmissao .?inter vivos/ },
  { key: "icms", name: "ICMS", parent: "RO1.1", re: /^(?!.*cota).*circulacao de mercadorias e sobre prest|^icms$/ },
  { key: "ipva", name: "IPVA (veículos)", parent: "RO1.1", re: /propriedade de veiculos automotores/ },
  { key: "itcmd", name: "ITCMD (heranças e doações)", parent: "RO1.1", re: /causa mortis/ },
  { key: "ir", name: "Imposto de Renda", parent: "RO1.1", re: /^impostos? sobre a renda e proventos/ },
  { key: "ipi", name: "IPI", parent: "RO1.1", re: /^imposto sobre produtos industrializados/ },
  { key: "iof", name: "IOF", parent: "RO1.1", re: /operacoes de credito, cambio e seguro/ },
  { key: "cofins", name: "COFINS", parent: "RO1.2", re: /cofins|financiamento da seguridade social/ },
  { key: "pis", name: "PIS/PASEP", parent: "RO1.2", re: /pis\/pasep|^contribuicao para o pis|programa de integracao social/ },
  { key: "csll", name: "CSLL (lucro líquido)", parent: "RO1.2", re: /lucro liquido/ },
  { key: "prev", name: "Contribuições previdenciárias", parent: "RO1.2", re: /^contribuicoes? (sociais )?(previdenciarias|do regime geral|para o regime)|contribuicoes previdenciarias/ },
  { key: "fpm", name: "FPM (fundo dos municípios)", parent: "RO1.7", re: /fundo de participacao dos municipios/ },
  { key: "fpe", name: "FPE (fundo dos estados)", parent: "RO1.7", re: /fundo de participacao dos estados/ },
  { key: "cp-icms", name: "Cota-parte do ICMS", parent: "RO1.7", re: /cota-?parte do icms|cota parte do icms/ },
  { key: "cp-ipva", name: "Cota-parte do IPVA", parent: "RO1.7", re: /cota-?parte do ipva|cota parte do ipva/ },
  { key: "fundeb", name: "FUNDEB (transferências)", parent: "RO1.7", re: /^transferencias? de recursos do fundeb|fundo de manutencao e desenvolvimento da educacao basica/ },
  { key: "sus", name: "SUS (transferências)", parent: "RO1.7", re: /transferencias? de recursos do sistema unico de saude|^transferencias? do sus/ },
  { key: "royalties", name: "Royalties e compensações", parent: "RO1.7", re: /compensacao financeira|royalt/ },
];
const EXCLUDE_CANON = /divida ativa|multas|juros de mora|restitui|deducoes|retificadora/;
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

/** Monta as séries canônicas de um ano: soma os nós de mais alto nível que casam com cada regra. */
function canonicalRows(rows: Raw[]): Raw[] {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const out: Raw[] = [];
  for (const c of CANON) {
    const match = (r: Raw) => c.re.test(norm(r.name)) && !EXCLUDE_CANON.test(norm(r.name)) && !!r.parent;
    const hits = rows.filter(match);
    const top = hits.filter((r) => {
      for (let p = r.parent ? byCode.get(r.parent) : undefined; p; p = p.parent ? byCode.get(p.parent) : undefined) if (match(p)) return false;
      return true;
    });
    const value = top.reduce((a, r) => a + r.value, 0);
    if (value > 0) out.push({ code: `tax:${c.key}`, name: c.name, value, parent: c.parent });
  }
  return out;
}

function toSeries(perYear: { year: number; rows: Raw[] }[]): Series[] {
  const map = new Map<string, Series>();
  for (const { year, rows } of perYear) {
    for (const r of rows) {
      const s = map.get(r.code) ?? { code: r.code, name: r.name, parent: r.parent, values: {} };
      s.values[year] = (s.values[year] ?? 0) + r.value;
      s.name = r.name; // o nome do ano mais recente prevalece (anos vêm em ordem crescente)
      s.parent = r.parent ?? s.parent;
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
  const natYears = have.filter((y) => (data.get(y)?.nature?.length ?? 0) > 0);
  const expenseS = toSeries(have.map((y) => ({ year: y, rows: data.get(y)!.expense })));
  const revenueS = toSeries(rev.map((y) => ({ year: y, rows: [...data.get(y)!.revenue.filter((r) => !r.parent), ...canonicalRows(data.get(y)!.revenue)] }))).filter((x) => !x.code.startsWith("tax:") || (x.values[rev[rev.length - 1]] ?? 0) > 0);
  const natureS = toSeries(natYears.map((y) => ({ year: y, rows: data.get(y)!.nature! })));
  const totals = {
    nature: Object.fromEntries(natYears.map((y) => [y, data.get(y)!.nature!.reduce((a, r) => a + r.value, 0)])) as Record<number, number>,
    expense: Object.fromEntries(have.map((y) => [y, data.get(y)!.expenseTotal])) as Record<number, number>,
    revenue: Object.fromEntries(rev.map((y) => [y, data.get(y)!.revenueTotal])) as Record<number, number>,
  };
  let partial: PartialYear | null = null;
  try {
    partial = await buildPartial(id, now, have, { expense: expenseS, revenue: revenueS, nature: natureS }, totals);
  } catch (err) {
    console.warn("[budget:partial]", (err as Error).message);
  }
  if (partial) {
    if (ipca[now] && base) deflator[now] = base / ipca[now];
    if (carry) population[now] = carry;
  }
  return {
    scope,
    entity: probe.name ?? (scope === "FEDERAL" ? "Governo Federal" : ""),
    years: have,
    expense: expenseS,
    revenue: revenueS,
    nature: natureS,
    partial,
    totals,
    population,
    deflator,
    fetchedAt: new Date().toISOString(),
  };
}
