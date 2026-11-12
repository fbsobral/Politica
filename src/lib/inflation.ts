import { cached, getJson, sgs } from "@/lib/indicators/core";

/* ───────── Metas ───────── */

export type Band = { center: number; tol: number; label: string; source: string };

/** Meta do Conselho Monetário Nacional para o IPCA. Desde 2025 a meta é contínua (3% ± 1,5 p.p., medida no acumulado em 12 meses). */
const CMN: Record<number, number> = { 2004: 5.5, 2005: 4.5, 2006: 4.5, 2007: 4.5, 2008: 4.5, 2009: 4.5, 2010: 4.5, 2011: 4.5, 2012: 4.5, 2013: 4.5, 2014: 4.5, 2015: 4.5, 2016: 4.5, 2017: 4.5, 2018: 4.5, 2019: 4.25, 2020: 4, 2021: 3.75, 2022: 3.5, 2023: 3.25, 2024: 3 };
export function cmnMeta(year: number): Band {
  const center = CMN[year] ?? 3;
  // tolerância: 2,5 p.p. até 2005, 2 p.p. de 2006 a 2016 e 1,5 p.p. desde 2017
  const tol = year <= 2005 ? 2.5 : year <= 2016 ? 2 : 1.5;
  return { center, tol, label: `Meta do Brasil (${center.toLocaleString("pt-BR")}% ± ${tol.toLocaleString("pt-BR")} p.p.)`, source: "Conselho Monetário Nacional" };
}

/**
 * Padrão internacional: 2% ao ano é a meta dos principais bancos centrais (Fed, BCE, Banco da Inglaterra, Japão, Canadá...);
 * a faixa de ± 1 p.p. segue os bancos que publicam banda (Canadá, Nova Zelândia). Usado onde o governo não fixa meta — como nos pilares do IPCA.
 */
export const INTL: Band = { center: 2, tol: 1, label: "Padrão internacional (2% ± 1 p.p.)", source: "Meta de 2% dos principais bancos centrais" };

export type Status = "dentro" | "acima" | "abaixo";
export const statusOf = (v: number, b: Band): Status => (v > b.center + b.tol ? "acima" : v < b.center - b.tol ? "abaixo" : "dentro");

/* ───────── Tipos ───────── */

export type Pillar = {
  code: string;
  name: string;
  /** acumulado em 12 meses, % */
  y12: number | null;
  /** variação no último mês, % */
  m: number | null;
  /** peso no IPCA, % */
  weight?: number | null;
  /** 12 meses no mês anterior, para a tendência */
  prevY12?: number | null;
  /** últimos 13 meses do acumulado em 12 meses (sparkline) */
  history?: number[];
  /** mediana do Focus para o ano corrente e o próximo, quando o mercado projeta este pilar */
  focus?: { year: number; median: number }[];
  desc?: string;
  source: string;
  children?: Pillar[];
};

export type FocusYear = { year: number; median: number; min: number | null; max: number | null; respondents: number | null; median4w: number | null };

export type InflationData = {
  ref: { year: number; month: number } | null;
  headline: { y12: number | null; m: number | null; ytd: number | null; series: { year: number; month: number; v: number }[] };
  focus: { date: string | null; ipca: FocusYear[]; /** mediana do Focus para a Selic no fim de cada ano */ selic?: FocusYear[]; next12: number | null; pillars: Record<string, FocusYear[]> };
  /** Meta Selic (% ao ano) no fim de cada mês, definida pelo Copom (Banco Central, SGS 432) */
  selic: { year: number; month: number; v: number }[];
  groups: Pillar[];
  bc: Pillar[];
  cores: Pillar[];
  errors: string[];
  fetchedAt: string;
};

/* ───────── IBGE (SIDRA 7060: IPCA desde 2020, por grupo, subgrupo, item e subitem) ───────── */

type SidraRow = Record<string, string>;
const num = (v: string | undefined) => (v && !/^[.\-X]+$/.test(v.trim()) && Number.isFinite(Number(v)) ? Number(v) : null);

/** Descobre, pelo cabeçalho, quais dimensões são variável, mês e categoria. */
function dims(header: SidraRow) {
  const keys = Object.keys(header).filter((k) => /^D\d+N$/.test(k));
  const find = (re: RegExp) => keys.find((k) => re.test(header[k] ?? ""))?.slice(0, -1);
  return { variable: find(/^Vari/i) ?? "D2", period: find(/^M[eê]s/i) ?? "D3", cat: find(/grupo/i) ?? "D4" };
}

const GROUP_CODES = "7169,7170,7445,7486,7558,7625,7660,7712,7766,7786";

const GROUP_DESC: Record<string, string> = {
  "1": "Comida em casa e fora de casa.",
  "2": "Aluguel, condomínio, energia elétrica, água, gás.",
  "3": "Móveis, eletrodomésticos, eletrônicos.",
  "4": "Roupas, calçados, joias.",
  "5": "Combustíveis, passagens, carros, transporte público.",
  "6": "Remédios, plano de saúde, higiene pessoal.",
  "7": "Serviços pessoais, recreação, cigarro.",
  "8": "Mensalidades escolares, cursos, material escolar.",
  "9": "Telefone, internet, TV por assinatura.",
};

async function fetchGroups(): Promise<{ ref: { year: number; month: number } | null; headline: { m: number | null; y12: number | null; ytd: number | null }; groups: Pillar[]; foodHome: Pillar | null }> {
  const [all, hist] = await Promise.all([
    getJson<SidraRow[]>("https://apisidra.ibge.gov.br/values/t/7060/n1/all/v/63,66,69,2265/p/last%201/c315/all", 60000),
    getJson<SidraRow[]>(`https://apisidra.ibge.gov.br/values/t/7060/n1/all/v/2265/p/last%2013/c315/${GROUP_CODES}`, 60000).catch(() => [] as SidraRow[]),
  ]);
  if (all.length < 2) throw new Error("SIDRA 7060 vazio");
  const d = dims(all[0]);
  const period = all[1][`${d.period}C`];
  const ref = period && /^\d{6}$/.test(period) ? { year: Number(period.slice(0, 4)), month: Number(period.slice(4)) } : null;

  // categoria -> valores por variável
  type Cat = { code: string; label: string; num: string | null; name: string; v: Record<string, number | null> };
  const cats = new Map<string, Cat>();
  const order: string[] = [];
  for (const r of all.slice(1)) {
    const code = r[`${d.cat}C`];
    const label = r[`${d.cat}N`] ?? "";
    if (!code) continue;
    let c = cats.get(code);
    if (!c) {
      const m = label.match(/^(\d+)\.(.*)$/);
      c = { code, label, num: m ? m[1] : null, name: (m ? m[2] : label).trim(), v: {} };
      cats.set(code, c);
      order.push(code);
    }
    c.v[r[`${d.variable}C`]] = num(r.V);
  }
  const hByCat = new Map<string, { p: string; v: number }[]>();
  if (hist.length > 1) {
    const dh = dims(hist[0]);
    for (const r of hist.slice(1)) {
      const v = num(r.V);
      if (v === null) continue;
      const k = r[`${dh.cat}C`];
      hByCat.set(k, [...(hByCat.get(k) ?? []), { p: r[`${dh.period}C`], v }]);
    }
  }
  const SRC = "IBGE (SIDRA, tabela 7060)";
  const mk = (c: Cat): Pillar => {
    const h = (hByCat.get(c.code) ?? []).sort((a, b) => a.p.localeCompare(b.p)).map((x) => x.v);
    return { code: c.num ?? c.code, name: c.name, y12: c.v["2265"] ?? null, m: c.v["63"] ?? null, weight: c.v["66"] ?? null, prevY12: h.length > 1 ? h[h.length - 2] : null, history: h.length ? h : undefined, source: SRC };
  };
  const list = order.map((k) => cats.get(k)!);
  const general = list.find((c) => c.code === "7169" || /^[ÍI]ndice geral/i.test(c.label));
  const byLevel = (len: number, prefix?: string) => list.filter((c) => c.num && c.num.length === len && (!prefix || c.num.startsWith(prefix)));

  const groups = byLevel(1).map((g) => {
    const subs = byLevel(2, g.num!).map((s) => {
      const items = byLevel(4, s.num!).map(mk).filter((p) => p.y12 !== null);
      return { ...mk(s), children: items.length ? items : undefined };
    });
    return { ...mk(g), desc: GROUP_DESC[g.num!], children: subs.length ? subs : undefined };
  });
  const fh = list.find((c) => c.num === "11");
  return {
    ref,
    headline: { m: general?.v["63"] ?? null, y12: general?.v["2265"] ?? null, ytd: general?.v["69"] ?? null },
    groups,
    foodHome: fh ? { ...mk(fh), code: "alim-domicilio", name: "Alimentação no domicílio", desc: "Comida comprada para consumo em casa (supermercado, feira).", source: SRC } : null,
  };
}

/* ───────── Banco Central (SGS): classificação e núcleos ───────── */

/** Séries mensais do IPCA calculadas pelo Banco Central a partir dos dados do IBGE. */
const BC_SERIES: { code: number; id: string; name: string; desc: string }[] = [
  { code: 11428, id: "livres", name: "Preços livres", desc: "Preços definidos pela oferta e procura (comida, roupas, serviços…). É o que a política de juros mais influencia." },
  { code: 4449, id: "monitorados", name: "Preços monitorados (administrados)", desc: "Preços regulados ou definidos por contrato: energia, combustíveis, ônibus, planos de saúde, remédios." },
  { code: 10844, id: "servicos", name: "Serviços", desc: "Aluguel, cabeleireiro, alimentação fora de casa, mensalidades… Costuma acompanhar salários." },
  { code: 4447, id: "comercializaveis", name: "Comercializáveis", desc: "Bens que podem ser importados ou exportados; sensíveis ao dólar." },
  { code: 4448, id: "nao-comercializaveis", name: "Não comercializáveis", desc: "Itens que dependem da economia interna, como serviços." },
  { code: 10843, id: "duraveis", name: "Bens duráveis", desc: "Carros, eletrodomésticos, móveis." },
  { code: 10842, id: "semi-duraveis", name: "Bens semiduráveis", desc: "Roupas, calçados, livros." },
  { code: 10841, id: "nao-duraveis", name: "Bens não duráveis", desc: "Alimentos, produtos de limpeza e higiene." },
];
const CORE_SERIES: { code: number; id: string; name: string; desc: string }[] = [
  { code: 4466, id: "ms", name: "Médias aparadas com suavização (IPCA-MS)", desc: "Descarta as maiores e menores variações do mês e suaviza itens com reajuste concentrado." },
  { code: 11427, id: "ma", name: "Médias aparadas sem suavização (IPCA-MA)", desc: "Descarta os extremos de alta e de baixa de cada mês." },
  { code: 11426, id: "ex0", name: "Exclusão EX0", desc: "Tira alimentação no domicílio e preços monitorados." },
  { code: 16121, id: "ex1", name: "Exclusão EX1", desc: "Tira alimentos e combustíveis, entre outros itens voláteis." },
  { code: 16122, id: "dp", name: "Dupla ponderação (IPCA-DP)", desc: "Reduz o peso dos itens que mais oscilam." },
];

/** 12 meses a partir das variações mensais (juros compostos). */
function rolling12(points: { year: number; month: number; value: number }[]): { year: number; month: number; v: number }[] {
  const s = [...points].sort((a, b) => a.year - b.year || a.month - b.month);
  const out: { year: number; month: number; v: number }[] = [];
  for (let i = 11; i < s.length; i++) {
    const w = s.slice(i - 11, i + 1);
    const span = (w[11].year - w[0].year) * 12 + (w[11].month - w[0].month);
    if (span !== 11) continue; // falta mês no meio
    out.push({ year: s[i].year, month: s[i].month, v: (w.reduce((a, p) => a * (1 + p.value / 100), 1) - 1) * 100 });
  }
  return out;
}

async function sgsPillar(def: { code: number; id: string; name: string; desc: string }): Promise<Pillar | null> {
  const y = new Date().getFullYear();
  const pts = await sgs(def.code, y - 2, y);
  const r = rolling12(pts);
  const last = r[r.length - 1];
  // proteção contra código de série errado (índice em número-índice, não variação)
  if (!last || Math.abs(last.v) > 60) return null;
  const lastPt = [...pts].sort((a, b) => a.year - b.year || a.month - b.month).pop();
  return { code: def.id, name: def.name, desc: def.desc, y12: last.v, m: lastPt?.value ?? null, prevY12: r.length > 1 ? r[r.length - 2].v : null, history: r.slice(-13).map((x) => x.v), source: `Banco Central (SGS ${def.code})` };
}

/* ───────── Focus (expectativas do mercado, Banco Central) ───────── */

type FocusRow = { Indicador: string; Data: string; DataReferencia: string; Mediana: number; Minimo?: number; Maximo?: number; numeroRespondentes?: number; baseCalculo?: number };
const OLINDA = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata";
const odata = (resource: string, q: Record<string, string>) => `${OLINDA}/${resource}?${Object.entries(q).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function fetchFocus(): Promise<InflationData["focus"]> {
  const since = iso(new Date(Date.now() - 40 * 864e5));
  const [annual, m12] = await Promise.all([
    getJson<{ value: FocusRow[] }>(odata("ExpectativasMercadoAnuais", { $filter: `(startswith(Indicador,'IPCA') or Indicador eq 'Selic') and baseCalculo eq 0 and Data ge '${since}'`, $orderby: "Data desc", $top: "5000", $format: "json", $select: "Indicador,Data,DataReferencia,Mediana,Minimo,Maximo,numeroRespondentes,baseCalculo" }), 40000),
    getJson<{ value: { Mediana: number; Data: string }[] }>(odata("ExpectativasMercadoInflacao12Meses", { $filter: "Indicador eq 'IPCA' and Suavizada eq 'S' and baseCalculo eq 0", $orderby: "Data desc", $top: "1", $format: "json", $select: "Indicador,Data,Mediana" }), 40000).catch(() => ({ value: [] })),
  ]);
  const rows = annual.value ?? [];
  const byInd = new Map<string, FocusRow[]>();
  for (const r of rows) byInd.set(r.Indicador, [...(byInd.get(r.Indicador) ?? []), r]);
  const thisYear = new Date().getFullYear();
  let date: string | null = null;
  const build = (list: FocusRow[]): FocusYear[] => {
    const latest = list.reduce((a, r) => (r.Data > a ? r.Data : a), "");
    if (!date || latest > date) date = latest;
    const cutoff = iso(new Date(new Date(latest).getTime() - 28 * 864e5));
    const out: FocusYear[] = [];
    for (const ref of [...new Set(list.map((r) => Number(r.DataReferencia)))].filter((y) => y >= thisYear && y <= thisYear + 3).sort()) {
      const of = list.filter((r) => Number(r.DataReferencia) === ref).sort((a, b) => b.Data.localeCompare(a.Data));
      const now = of[0];
      const old = of.find((r) => r.Data <= cutoff);
      if (now) out.push({ year: ref, median: now.Mediana, min: now.Minimo ?? null, max: now.Maximo ?? null, respondents: now.numeroRespondentes ?? null, median4w: old?.Mediana ?? null });
    }
    return out;
  };
  const pillars: Record<string, FocusYear[]> = {};
  let ipca: FocusYear[] = [];
  let selic: FocusYear[] = [];
  for (const [ind, list] of byInd) {
    const k = ind.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (k === "ipca") ipca = build(list);
    else if (k === "selic") selic = build(list);
    else if (k.includes("administrad")) pillars.monitorados = build(list);
    else if (k.includes("livre")) pillars.livres = build(list);
    else if (k.includes("servic")) pillars.servicos = build(list);
    else if (k.includes("alimenta")) pillars["alim-domicilio"] = build(list);
    else if (k.includes("industria")) pillars["bens-industriais"] = build(list);
  }
  return { date, ipca, selic, next12: m12.value?.[0]?.Mediana ?? null, pillars };
}

/* ───────── Montagem ───────── */

export async function buildInflation(): Promise<InflationData> {
  const errors: string[] = [];
  const y = new Date().getFullYear();
  const soft = <T,>(label: string, p: Promise<T>, fallback: T) =>
    p.catch((err) => {
      errors.push(label);
      console.warn("[inflation]", label, (err as Error).message);
      return fallback;
    });
  const [groupsRes, headlinePts, selicPts, focus, bc, cores] = await Promise.all([
    soft("IBGE", fetchGroups(), null),
    soft("Banco Central (IPCA)", sgs(433, y - 31, y), [] as { year: number; month: number; value: number }[]),
    soft("Banco Central (Selic)", sgs(432, y - 31, y), [] as { year: number; month: number; value: number }[]),
    soft("Focus", fetchFocus(), { date: null, ipca: [], selic: [], next12: null, pillars: {} } as InflationData["focus"]),
    Promise.all(BC_SERIES.map((d) => sgsPillar(d).catch(() => null))),
    Promise.all(CORE_SERIES.map((d) => sgsPillar(d).catch(() => null))),
  ]);
  if (!groupsRes && !headlinePts.length) throw new Error("IBGE e Banco Central indisponíveis"); // mantém o cache anterior
  const series = rolling12(headlinePts);
  const lastPt = [...headlinePts].sort((a, b) => a.year - b.year || a.month - b.month).pop();
  const lastS = series[series.length - 1];
  const ref = groupsRes?.ref ?? (lastS ? { year: lastS.year, month: lastS.month } : null);
  const ytdPts = headlinePts.filter((p) => ref && p.year === ref.year && p.month <= ref.month);
  const withFocus = (p: Pillar): Pillar => {
    const f = focus.pillars[p.code];
    return f?.length ? { ...p, focus: f.slice(0, 2).map((x) => ({ year: x.year, median: x.median })) } : p;
  };
  const bcList = [...bc.filter((p): p is Pillar => !!p)];
  if (groupsRes?.foodHome) bcList.splice(Math.min(3, bcList.length), 0, groupsRes.foodHome);
  if (!bcList.length && BC_SERIES.length) errors.push("Banco Central (classificação)");
  return {
    ref,
    headline: {
      y12: groupsRes?.headline.y12 ?? lastS?.v ?? null,
      m: groupsRes?.headline.m ?? lastPt?.value ?? null,
      ytd: groupsRes?.headline.ytd ?? (ytdPts.length ? (ytdPts.reduce((a, p) => a * (1 + p.value / 100), 1) - 1) * 100 : null),
      series: series.slice(-(30 * 12 + 1)),
    },
    focus,
    // última meta Selic de cada mês (a série traz uma linha por dia útil, em ordem)
    selic: (() => {
      const byMonth = new Map<string, { year: number; month: number; v: number }>();
      for (const p of selicPts) byMonth.set(`${p.year}-${p.month}`, { year: p.year, month: p.month, v: p.value });
      return [...byMonth.values()].sort((a, b) => a.year - b.year || a.month - b.month);
    })(),
    groups: groupsRes?.groups ?? [],
    bc: bcList.map(withFocus),
    cores: cores.filter((p): p is Pillar => !!p),
    errors,
    fetchedAt: new Date().toISOString(),
  };
}

/** Painel da inflação, com cache de 12 horas (o IPCA sai uma vez por mês; o Focus, toda segunda-feira). */
export async function getInflation(opts: { force?: boolean } = {}): Promise<InflationData | null> {
  return cached("inflation:v5", 0.5, buildInflation, opts.force);
}
