import { db } from "@/lib/db";
import { ibgeIdFor } from "@/lib/ibge";
import { sgs } from "@/lib/indicators/core";
import { siconfi, UF_CODE, type BudgetScope, type Item } from "@/lib/budget";

const DAY = 24 * 3600 * 1000;

/** Uma linha do previsto x realizado: previsto na LOA (inicial), atualizado e o realizado até o bimestre. */
export type PlanItem = {
  code: string;
  name: string;
  initial: number;
  updated: number;
  /** receita arrecadada ou despesa empenhada até o bimestre */
  done: number;
  /** só despesa: liquidada e paga até o bimestre (quando o anexo traz) */
  liquidated?: number;
  paid?: number;
  children?: PlanItem[];
};
export type Plan = { expense: PlanItem[]; revenue: PlanItem[]; nature: PlanItem[] };

/** As 28 funções de governo (Portaria 42/1999) + reserva: no Anexo 02 do RREO cada função vem antes das suas subfunções. */
const FUNCTIONS = [
  "Legislativa", "Judiciária", "Essencial à Justiça", "Administração", "Defesa Nacional", "Segurança Pública", "Relações Exteriores",
  "Assistência Social", "Previdência Social", "Saúde", "Trabalho", "Educação", "Cultura", "Direitos da Cidadania", "Urbanismo",
  "Habitação", "Saneamento", "Gestão Ambiental", "Ciência e Tecnologia", "Agricultura", "Organização Agrária", "Indústria",
  "Comércio e Serviços", "Comunicações", "Energia", "Transporte", "Desporto e Lazer", "Encargos Especiais", "Reserva de Contingência",
];
/** Origens da receita (MCASP): no Anexo 01 cada origem vem antes dos seus desdobramentos. */
const ORIGINS = [
  "Impostos, Taxas e Contribuições de Melhoria", "Contribuições", "Receita Patrimonial", "Receita Agropecuária", "Receita Industrial",
  "Receita de Serviços", "Transferências Correntes", "Outras Receitas Correntes", "Operações de Crédito", "Alienação de Bens",
  "Amortização de Empréstimos", "Transferências de Capital", "Outras Receitas de Capital",
];
const NATURE_ROTULO_NAME: Record<string, string> = {
  PessoalEEncargosSociais: "Pessoal e encargos sociais",
  JurosEEncargosDaDivida: "Juros e encargos da dívida",
  OutrasDespesasCorrentes: "Outras despesas correntes",
  Investimentos: "Investimentos",
  InversoesFinanceiras: "Inversões financeiras",
  AmortizacaoDaDivida: "Amortização da dívida",
};

const strip = (n: string) => n.replace(/\s*\([^)]*\)\s*$/g, "").replace(/^\d+(\.\d+)*\s*-\s*/, "").trim();
const nkey = (n: string) => strip(n).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const FN_KEYS = new Map(FUNCTIONS.map((f) => [nkey(f), f]));
const ORIGIN_KEYS = new Map(ORIGINS.map((f) => [nkey(f), f]));

type Cols = Record<string, RegExp>;

/**
 * Monta a árvore categoria → subcategoria de um anexo do RREO percorrendo as linhas na ordem publicada:
 * uma linha que é categoria conhecida abre um grupo; as seguintes são subcategorias até a próxima categoria ou um cabeçalho.
 * A seção intra-orçamentária (que repete as mesmas linhas) é ignorada.
 */
function planTree(rows: Item[], cols: Cols, tops: Map<string, string>, isHeader: (k: string, raw: string) => boolean, stop: (raw: string) => boolean): PlanItem[] {
  const vals = new Map<string, Record<string, number>>(); // chave "top" ou "top>sub"
  const order: { key: string; top: string; name: string }[] = [];
  for (const [field, re] of Object.entries(cols)) {
    let top: string | null = null;
    for (const i of rows) {
      if (!re.test(i.coluna)) continue;
      if (stop(i.conta)) break;
      const k = nkey(i.conta);
      if (!k) continue;
      let key: string;
      if (tops.has(k)) {
        top = k;
        key = k;
      } else if (isHeader(k, i.conta)) {
        top = null;
        continue;
      } else if (top) key = `${top}>${k}`;
      else continue;
      let v = vals.get(key);
      if (!v) {
        v = {};
        vals.set(key, v);
        order.push({ key, top: top!, name: tops.has(k) ? tops.get(k)! : strip(i.conta) });
      }
      if (!(field in v)) v[field] = Number(i.valor) || 0; // a primeira ocorrência vale
    }
  }
  const mk = (o: { key: string; name: string }): PlanItem => {
    const v = vals.get(o.key) ?? {};
    return { code: o.key, name: o.name, initial: v.initial ?? 0, updated: v.updated ?? v.initial ?? 0, done: v.done ?? 0, liquidated: v.liquidated, paid: v.paid };
  };
  const has = (p: PlanItem) => p.initial > 0 || p.updated > 0 || p.done > 0;
  return order
    .filter((o) => o.key === o.top)
    .map((o) => {
      const kids = order.filter((c) => c.top === o.top && c.key !== o.key).map(mk).filter(has).sort((a, b) => b.updated - a.updated || b.done - a.done);
      const it = mk(o);
      return kids.length ? { ...it, children: kids } : it;
    })
    .filter(has)
    .sort((a, b) => b.updated - a.updated || b.done - a.done);
}

const EXP_COLS: Cols = {
  initial: /DOTA..O INICIAL/i,
  updated: /DOTA..O ATUALIZADA/i,
  done: /DESPESAS EMPENHADAS AT. O BIME/i,
  liquidated: /DESPESAS LIQUIDADAS AT. O BIME/i,
  paid: /DESPESAS PAGAS AT. O BIME/i,
};
const REV_COLS: Cols = { initial: /PREVIS.O INICIAL/i, updated: /PREVIS.O ATUALIZADA/i, done: /^At. o Bimestre \(c\)/i };

export function parsePlan(a1: Item[], a2: Item[]): Plan {
  const intra = (raw: string) => /INTRA-?OR/i.test(raw) && !/EXCETO/i.test(raw);
  const expense = planTree(a2, EXP_COLS, FN_KEYS, (k, raw) => /^(despesas|total|subtotal)\b/.test(k) || raw === raw.toUpperCase(), intra);
  // receita: só a parte de cima do Anexo 01 (as despesas vêm depois)
  const revRows = a1.filter((i) => REV_COLS.initial.test(i.coluna) || REV_COLS.updated.test(i.coluna) || REV_COLS.done.test(i.coluna));
  const revenue = planTree(revRows, REV_COLS, ORIGIN_KEYS, (k) => /^(receitas|total|subtotal|deducoes|deficit|saldos|operacoes de credito refinanciamento)\b/.test(k) || k.startsWith("receitas "), intra);
  const nature: PlanItem[] = [];
  for (const [rot, name] of Object.entries(NATURE_ROTULO_NAME)) {
    const pick = (re: RegExp) => a1.find((i) => i.cod_conta === rot && re.test(i.coluna))?.valor;
    const it: PlanItem = { code: `nat:${rot}`, name, initial: pick(EXP_COLS.initial) ?? 0, updated: pick(EXP_COLS.updated) ?? pick(EXP_COLS.initial) ?? 0, done: pick(EXP_COLS.done) ?? 0, liquidated: pick(EXP_COLS.liquidated), paid: pick(EXP_COLS.paid) };
    if (it.updated > 0 || it.done > 0) nature.push(it);
  }
  nature.sort((a, b) => b.updated - a.updated);
  return { expense, revenue, nature };
}


/* ───────── Expectativa fiscal: RREO do ano corrente x LOA, com projeção do fechamento ───────── */

type Totals = {
  revenue: { initial: number; updated: number; done: number };
  expense: { initial: number; updated: number; done: number; liquidated: number; paid: number };
};
type Snapshot = { year: number; period: number; name: string | null; pop: number | null; totals: Totals; plan: Plan; primary: { meta: number | null; realized: number | null } | null };

const rreo = (id: number, year: number, period: number, anexo: string) => siconfi("rreo", { an_exercicio: year, nr_periodo: period, co_tipo_demonstrativo: "RREO", no_anexo: anexo, id_ente: id });

/** Meta de resultado primário da LDO e o resultado até o bimestre, como declarados no Anexo 06 do RREO (melhor esforço: o layout varia entre entes). */
function parsePrimary(a6: Item[], year: number): Snapshot["primary"] {
  if (!a6.length) return null;
  const money = (i: Item) => !/%|PIB/i.test(i.coluna) && Number.isFinite(Number(i.valor));
  const meta = a6.find((i) => /META/i.test(i.conta) && /PRIM/i.test(i.conta) && money(i) && Number(i.valor) !== 0);
  const res = a6.filter((i) => /^RESULTADO PRIM/i.test(i.conta.trim()) && money(i));
  const pick = (list: Item[]) => list.find((i) => i.coluna.includes(String(year))) ?? list.find((i) => !i.coluna.includes(String(year - 1))) ?? null;
  const realized = pick(res.filter((i) => /ACIMA DA LINHA/i.test(i.conta))) ?? pick(res);
  if (!meta && !realized) return null;
  return { meta: meta ? Number(meta.valor) : null, realized: realized ? Number(realized.valor) : null };
}

async function fetchSnapshot(id: number, year: number, period: number, withPrimary: boolean): Promise<Snapshot | null> {
  const a1 = await rreo(id, year, period, "RREO-Anexo 01");
  if (!a1.length) return null;
  const [a2, a6] = await Promise.all([rreo(id, year, period, "RREO-Anexo 02").catch(() => [] as Item[]), withPrimary ? rreo(id, year, period, "RREO-Anexo 06").catch(() => [] as Item[]) : Promise.resolve([] as Item[])]);
  const val = (cod: string, col: RegExp) => Number(a1.find((i) => i.cod_conta === cod && col.test(i.coluna))?.valor ?? 0);
  const R = "ReceitasExcetoIntraOrcamentarias";
  const D = "DespesasExcetoIntraOrcamentarias";
  return {
    year,
    period,
    name: a1[0].instituicao ?? null,
    pop: a1[0].populacao ?? null,
    totals: {
      revenue: { initial: val(R, REV_COLS.initial), updated: val(R, REV_COLS.updated), done: val(R, REV_COLS.done) },
      expense: { initial: val(D, EXP_COLS.initial), updated: val(D, EXP_COLS.updated), done: val(D, EXP_COLS.done), liquidated: val(D, EXP_COLS.liquidated), paid: val(D, EXP_COLS.paid) },
    },
    plan: parsePlan(a1, a2),
    primary: withPrimary ? parsePrimary(a6, year) : null,
  };
}

/** Snapshot de um bimestre com cache no banco (ano corrente: 1 dia; anos passados: 90 dias). */
async function snapshot(id: number, year: number, period: number, opts: { primary?: boolean; force?: boolean } = {}): Promise<Snapshot | null> {
  const key = `fiscal:rreo:v1:${id}:${year}:${period}${opts.primary ? ":p" : ""}`;
  const hit = await db.budgetCache.findUnique({ where: { key } });
  const d = hit?.data as unknown as (Snapshot & { empty?: boolean }) | undefined;
  const ttl = year >= new Date().getFullYear() ? 1 : 90;
  if (!opts.force && hit && d && Date.now() - hit.fetchedAt.getTime() < (d.empty ? 1 : ttl) * DAY) return d.empty ? null : d;
  try {
    const fresh = await fetchSnapshot(id, year, period, !!opts.primary);
    await db.budgetCache.upsert({ where: { key }, create: { key, data: (fresh ?? { empty: true }) as never }, update: { data: (fresh ?? { empty: true }) as never, fetchedAt: new Date() } });
    return fresh;
  } catch (err) {
    console.warn("[fiscal]", id, year, period, (err as Error).message);
    return d && !d.empty ? d : null;
  }
}

export type Projection = { value: number; seasonal: boolean };

/**
 * Projeta o fechamento do ano a partir do acumulado: divide pela fração que estava acumulada no mesmo bimestre do ano anterior
 * (sazonalidade: IPTU no começo do ano, 13º no fim...). Sem histórico confiável, proporcionaliza para 12 meses.
 */
export function projectClose(done: number, period: number, prevAtPeriod?: number, prevClosed?: number): Projection {
  if (period >= 6) return { value: done, seasonal: true };
  if (prevAtPeriod && prevClosed && prevAtPeriod > 0 && prevClosed > 0) {
    const f = prevAtPeriod / prevClosed;
    if (f > 0.05 && f <= 1.05) return { value: Math.max(done, done / f), seasonal: true };
  }
  return { value: (done * 6) / period, seasonal: false };
}

export type FiscalData = {
  scope: BudgetScope;
  entity: string;
  population: number | null;
  year: number;
  period: number;
  totals: Totals;
  plan: Plan;
  /** projeção do fechamento: "revenue:<code>", "expense:<code>", "nature:<code>", "total:revenue", "total:expense" */
  projection: Record<string, Projection>;
  primary: { meta: number | null; realized: number | null } | null;
  /** há o ano anterior para comparar a sazonalidade */
  hasHistory: boolean;
  fetchedAt: string;
};

function flat(items: PlanItem[]): PlanItem[] {
  return items.flatMap((i) => [i, ...(i.children ?? [])]);
}

async function entityId(scope: BudgetScope, user: { uf: string; municipalityKey: string }): Promise<number | null> {
  return scope === "FEDERAL" ? 1 : scope === "ESTADUAL" ? UF_CODE[user.uf] ?? null : await ibgeIdFor(user.uf, user.municipalityKey);
}

export async function getFiscal(scope: BudgetScope, user: { uf: string; municipalityKey: string }, opts: { force?: boolean } = {}): Promise<FiscalData | null> {
  const id = await entityId(scope, user);
  if (!id) return null;
  const key = `fiscal:v1:${id}`;
  const hit = await db.budgetCache.findUnique({ where: { key } });
  if (hit && !opts.force && Date.now() - hit.fetchedAt.getTime() < DAY) return hit.data as unknown as FiscalData;
  try {
    const now = new Date().getFullYear();
    let cur: Snapshot | null = null;
    for (const y of [now, now - 1]) {
      for (let p = 6; p >= 1 && !cur; p--) cur = await snapshot(id, y, p, { primary: true, force: opts.force });
      if (cur) break;
    }
    if (!cur) return hit ? (hit.data as unknown as FiscalData) : null;
    const [prevP, prev6] = cur.period < 6 ? await Promise.all([snapshot(id, cur.year - 1, cur.period), snapshot(id, cur.year - 1, 6)]) : [null, null];

    const projection: Record<string, Projection> = {};
    for (const kind of ["revenue", "expense", "nature"] as const) {
      const a = new Map(flat(prevP?.plan[kind] ?? []).map((i) => [i.code, i.done]));
      const b = new Map(flat(prev6?.plan[kind] ?? []).map((i) => [i.code, i.done]));
      for (const i of flat(cur.plan[kind])) projection[`${kind}:${i.code}`] = projectClose(i.done, cur.period, a.get(i.code), b.get(i.code));
    }
    projection["total:revenue"] = projectClose(cur.totals.revenue.done, cur.period, prevP?.totals.revenue.done, prev6?.totals.revenue.done);
    projection["total:expense"] = projectClose(cur.totals.expense.done, cur.period, prevP?.totals.expense.done, prev6?.totals.expense.done);

    const data: FiscalData = {
      scope,
      entity: cur.name ?? (scope === "FEDERAL" ? "Governo Federal" : ""),
      population: cur.pop,
      year: cur.year,
      period: cur.period,
      totals: cur.totals,
      plan: cur.plan,
      projection,
      primary: cur.primary,
      hasHistory: !!(prevP && prev6),
      fetchedAt: new Date().toISOString(),
    };
    await db.budgetCache.upsert({ where: { key }, create: { key, data: data as never }, update: { data: data as never, fetchedAt: new Date() } });
    return data;
  } catch (err) {
    console.warn("[fiscal]", scope, id, (err as Error).message);
    return hit ? (hit.data as unknown as FiscalData) : null;
  }
}

/** Situação frente à LOA: dentro de ±5% conta como "segue a LOA". */
export const LOA_TOLERANCE = 0.05;
export function loaStatus(projected: number, loa: number): "segue" | "acima" | "abaixo" | null {
  if (!(loa > 0)) return null;
  const d = projected / loa - 1;
  return Math.abs(d) <= LOA_TOLERANCE ? "segue" : d > 0 ? "acima" : "abaixo";
}

/**
 * Resultado primário em % do PIB, acumulado em 12 meses, como o Banco Central publica (convenção do BC: positivo = déficit).
 * União: SGS 5783 (Governo Federal e Banco Central). Estados e municípios: o BC só publica o conjunto de todos eles (SGS 5786).
 */
export type PrimaryPct = { pct: number; month: string; code: number; perimeter: string };

export async function getPrimaryPct(scope: BudgetScope): Promise<PrimaryPct | null> {
  const code = scope === "FEDERAL" ? 5783 : 5786;
  const perimeter = scope === "FEDERAL" ? "Governo Federal e Banco Central" : "todos os estados e municípios juntos";
  const key = `fiscal:pibpct:v1:${code}`;
  const hit = await db.budgetCache.findUnique({ where: { key } });
  if (hit && Date.now() - hit.fetchedAt.getTime() < DAY) return { ...(hit.data as unknown as { pct: number; month: string }), code, perimeter };
  try {
    const y = new Date().getFullYear();
    const rows = await sgs(code, y - 1, y);
    const last = rows.sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month)).pop();
    if (!last) return hit ? { ...(hit.data as unknown as { pct: number; month: string }), code, perimeter } : null;
    const data = { pct: last.value, month: `${String(last.month).padStart(2, "0")}/${last.year}` };
    await db.budgetCache.upsert({ where: { key }, create: { key, data: data as never }, update: { data: data as never, fetchedAt: new Date() } });
    return { ...data, code, perimeter };
  } catch (err) {
    console.warn("[fiscal:pibpct]", (err as Error).message);
    return hit ? { ...(hit.data as unknown as { pct: number; month: string }), code, perimeter } : null;
  }
}

/* ───────── Série histórica das 4 caixas da Expectativa fiscal ───────── */

export type SeriesPoint = {
  year: number;
  /** bimestre do RREO (acumulado no ano até ele); 6 = ano fechado */
  period: number;
  revenue: number;
  expense: number;
  /** receita realizada menos despesa empenhada */
  balance: number;
  /** resultado primário do RREO (Anexo 6); nulo quando o ente não o publicou */
  primary: number | null;
  /** resultado primário em % do PIB acumulado em 12 meses, até o fim do bimestre (Banco Central; convenção deste app: positivo = superávit) */
  pibPct: number | null;
};

export type FiscalSeries = {
  scope: BudgetScope;
  entity: string;
  /** um ponto por ano: ano fechado (6º bimestre) e, no último, o ano corrente até o último bimestre publicado */
  annual: SeriesPoint[];
  /** bimestre a bimestre (acumulado no ano) dos dois últimos anos */
  bimesters: SeriesPoint[];
  firstYear: number | null;
  currentYear: number;
  currentPeriod: number;
  /** de onde vem o % do PIB */
  pibSource: { code: number; perimeter: string };
  fetchedAt: string;
};

const toPoint = (s: Snapshot, pib: Map<string, number>): SeriesPoint => ({
  year: s.year,
  period: s.period,
  revenue: s.totals.revenue.done,
  expense: s.totals.expense.done,
  balance: s.totals.revenue.done - s.totals.expense.done,
  primary: s.primary?.realized ?? null,
  // o bimestre fecha nos meses 2, 4, 6, 8, 10 e 12; o BC publica o acumulado em 12 meses de cada mês (+ = déficit, então inverte)
  pibPct: pib.has(`${s.year}-${s.period * 2}`) ? -pib.get(`${s.year}-${s.period * 2}`)! : null,
});

/** Executa as tarefas com no máximo `n` ao mesmo tempo. */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

export async function getFiscalSeries(scope: BudgetScope, user: { uf: string; municipalityKey: string }): Promise<FiscalSeries | null> {
  const id = await entityId(scope, user);
  if (!id) return null;
  const now = new Date().getFullYear();

  // último bimestre publicado (ano corrente, ou o anterior se o ano ainda não começou a publicar)
  let cur: Snapshot | null = null;
  for (const y of [now, now - 1]) {
    for (let p = 6; p >= 1 && !cur; p--) cur = await snapshot(id, y, p, { primary: true });
    if (cur) break;
  }
  if (!cur) return null;

  // resultado primário em % do PIB (Banco Central): mensal, acumulado em 12 meses
  const pibCode = scope === "FEDERAL" ? 5783 : 5786;
  const pib = new Map<string, number>();
  try {
    for (const r of await sgs(pibCode, now - 31, now)) pib.set(`${r.year}-${r.month}`, r.value);
  } catch (err) {
    console.warn("[fiscal:series:pib]", (err as Error).message);
  }

  // anos fechados: do mais recente para trás; para ao achar 2 anos seguidos sem dados depois de já ter achado algum
  const closed: SeriesPoint[] = [];
  const years = Array.from({ length: 30 }, (_, i) => cur!.year - 1 - i);
  const snaps = await pool(years, 3, (y) => snapshot(id, y, 6, { primary: true }));
  let misses = 0;
  for (let i = 0; i < years.length; i++) {
    const s = snaps[i];
    if (s) { closed.push(toPoint(s, pib)); misses = 0; } else if (closed.length && ++misses >= 2) break;
  }
  closed.sort((a, b) => a.year - b.year);

  const annual = [...closed, toPoint(cur, pib)];

  // bimestre a bimestre dos dois últimos anos
  const want: [number, number][] = [];
  for (const y of [cur.year - 1, cur.year]) for (let p = 1; p <= (y === cur.year ? cur.period : 6); p++) want.push([y, p]);
  const bim = (await pool(want, 3, ([y, p]) => (y === cur!.year && p === cur!.period ? Promise.resolve(cur) : snapshot(id, y, p, { primary: true })))).filter((s): s is Snapshot => !!s).map((s) => toPoint(s, pib));

  return { scope, entity: cur.name ?? (scope === "FEDERAL" ? "Governo Federal" : ""), annual, bimesters: bim, firstYear: annual[0]?.year ?? null, currentYear: cur.year, currentPeriod: cur.period, pibSource: { code: pibCode, perimeter: scope === "FEDERAL" ? "Governo Federal e Banco Central" : "todos os estados e municípios juntos" }, fetchedAt: new Date().toISOString() };
}

/** PIB mensal a preços correntes (R$), somado de janeiro até o mês, segundo o Banco Central (SGS 4380). É o denominador de um resultado acumulado no ano. */
export async function getPibYtd(year: number, throughMonth: number): Promise<number | null> {
  const key = `fiscal:pibytd:v1:${year}`;
  const hit = await db.budgetCache.findUnique({ where: { key } });
  const cachedMonths = (hit?.data as unknown as { m?: Record<string, number> } | undefined)?.m;
  const fresh = hit && Date.now() - hit.fetchedAt.getTime() < DAY;
  let months = cachedMonths;
  if (!fresh || !months) {
    try {
      const rows = await sgs(4380, year, year);
      months = Object.fromEntries(rows.filter((r) => r.year === year).map((r) => [String(r.month), r.value * 1e6])); // a série vem em R$ milhões
      await db.budgetCache.upsert({ where: { key }, create: { key, data: { m: months } as never }, update: { data: { m: months } as never, fetchedAt: new Date() } });
    } catch (err) {
      console.warn("[fiscal:pibytd]", (err as Error).message);
    }
  }
  if (!months) return null;
  let sum = 0;
  for (let m = 1; m <= throughMonth; m++) {
    if (months[String(m)] === undefined) return null; // falta um mês: não soma parcial
    sum += months[String(m)];
  }
  return sum;
}

export type PrimaryYtd = { month: number; flow: number; pct: number; code: number; perimeter: string };

/**
 * Resultado primário do Governo Federal e Banco Central acumulado no ano, em R$ (soma do fluxo mensal, SGS 4639; convenção do BC: positivo = déficit)
 * e em % do PIB do mesmo período. Vai até o mês mais recente que o Banco Central já publicou, que costuma ser mais novo que o RREO.
 */
export async function getPrimaryYtd(year: number): Promise<PrimaryYtd | null> {
  try {
    const rows = (await sgs(4639, year, year)).filter((r) => r.year === year).sort((a, b) => a.month - b.month);
    if (!rows.length) return null;
    const last = rows[rows.length - 1].month;
    // só meses seguidos desde janeiro
    if (rows.length !== last) return null;
    const flow = rows.reduce((a, r) => a + r.value, 0) * 1e6;
    const pib = await getPibYtd(year, last);
    if (!pib) return null;
    return { month: last, flow, pct: (flow / pib) * 100, code: 4639, perimeter: "Governo Federal e Banco Central" };
  } catch (err) {
    console.warn("[fiscal:primaryytd]", (err as Error).message);
    return null;
  }
}
