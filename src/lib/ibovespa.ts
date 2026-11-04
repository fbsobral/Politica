import { db } from "@/lib/db";
import { cached, getJson } from "@/lib/indicators/core";

/* ───────── Série do índice ───────── */

export type Point = { d: string; close: number };

type YahooChart = { chart: { result?: { timestamp: number[]; indicators: { quote: { close: (number | null)[] }[] } }[] } };

/** Fechamentos diários do Ibovespa (Yahoo Finance; se falhar, a série do Banco Central). */
async function fetchIbov(): Promise<{ points: Point[]; source: string }> {
  try {
    const j = await getJson<YahooChart>("https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?range=5y&interval=1d", 30000);
    const r = j.chart.result?.[0];
    const closes = r?.indicators.quote[0]?.close ?? [];
    const pts: Point[] = [];
    r?.timestamp.forEach((t, i) => {
      const c = closes[i];
      // data no fuso de São Paulo (o pregão abre às 10h; meio-dia UTC-3 evita virar o dia)
      if (c != null && c > 1000) pts.push({ d: new Date((t - 3 * 3600) * 1000).toISOString().slice(0, 10), close: Math.round(c) });
    });
    if (pts.length > 200) return { points: dedupe(pts), source: "B3 via Yahoo Finance" };
    throw new Error("série curta");
  } catch (err) {
    console.warn("[ibov] yahoo", (err as Error).message);
  }
  const raw = await sgsDaily(7, 5);
  const pts = [...raw.entries()].filter(([, v]) => v > 10000 && v < 1e6).map(([d, close]) => ({ d, close }));
  if (pts.length < 200) throw new Error("Ibovespa indisponível");
  return { points: dedupe(pts), source: "Banco Central (SGS 7)" };
}

const dedupe = (pts: Point[]) => [...new Map(pts.map((p) => [p.d, p])).values()].sort((a, b) => a.d.localeCompare(b.d));

/** SGS diário com a data completa (o helper `sgs` só guarda ano e mês). */
async function sgsDaily(code: number, years: number): Promise<Map<string, number>> {
  const end = new Date();
  const out = new Map<string, number>();
  for (let y = end.getFullYear() - years; y <= end.getFullYear(); y += 5) {
    const br = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const to = new Date(Math.min(end.getTime(), new Date(y + 4, 11, 31).getTime()));
    const rows = await getJson<{ data: string; valor: string }[]>(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${br(new Date(y, 0, 1))}&dataFinal=${br(to)}`, 40000);
    for (const r of rows) {
      const [dd, mm, yy] = r.data.split("/");
      const v = Number(r.valor);
      if (Number.isFinite(v)) out.set(`${yy}-${mm}-${dd}`, v);
    }
  }
  return out;
}

/* ───────── Temas (para ligar matérias e inferir motivos) ───────── */

export type Theme = { id: string; name: string; words: string[] };

export const THEMES: Theme[] = [
  { id: "juros", name: "Juros e Copom", words: ["selic", "copom", "juros", "banco central", "galípolo", "politica monetaria", "política monetária", "taxa básica"] },
  { id: "fiscal", name: "Contas públicas", words: ["fiscal", "arcabouço", "déficit", "deficit", "meta fiscal", "gastos públicos", "haddad", "dívida pública", "corte de gastos", "contingenciamento", "orçamento"] },
  { id: "inflacao", name: "Inflação", words: ["inflação", "ipca", "preços", "igp-m", "carestia"] },
  { id: "cambio", name: "Dólar e câmbio", words: ["dólar", "câmbio", "cambio", "real se", "moeda americana"] },
  { id: "petroleo", name: "Petróleo e Petrobras", words: ["petrobras", "petróleo", "brent", "opep", "combustível", "combustíveis", "gasolina", "diesel"] },
  { id: "commodities", name: "Minério, Vale e China", words: ["vale ", "minério", "china", "chinesa", "commodities", "siderurgia"] },
  { id: "exterior", name: "Exterior (EUA, Fed, tarifas)", words: ["fed ", "federal reserve", "trump", "tarifa", "tarifas", "wall street", "nasdaq", "dow jones", "treasur", "estados unidos", "eua"] },
  { id: "politica", name: "Política e eleições", words: ["eleição", "eleições", "pesquisa eleitoral", "lula", "bolsonaro", "tarcísio", "congresso", "reforma", "stf", "planalto", "impeachment"] },
  { id: "empresas", name: "Balanços e empresas", words: ["balanço", "lucro", "resultado trimestral", "itaú", "bradesco", "banco do brasil", "dividendos", "ações da", "ações do"] },
];
const MARKET = ["ibovespa", "bolsa", "b3", "ações", "mercado financeiro", "investidores", "pregão", "índice"];
const ALL_WORDS = [...new Set([...MARKET, ...THEMES.flatMap((t) => t.words)])].map((w) => w.trim()).filter((w) => w.length > 2);

const norm = (s: string) => ` ${s.toLowerCase()} `;
export function themesOf(text: string): string[] {
  const t = norm(text);
  return THEMES.filter((th) => th.words.some((w) => t.includes(w))).map((th) => th.id);
}

/* ───────── Montagem ───────── */

export type MoveArticle = { id: string; title: string; url: string; source: string; at: string; themes: string[]; market: boolean };
export type Signal = { kind: "dolar" | "copom"; text: string; theme: string };
export type Move = {
  d: string;
  /** variação no dia, % */
  ret: number;
  close: number;
  articles: MoveArticle[];
  signals: Signal[];
  /** temas em ordem de peso, com a contagem de evidências */
  themes: { id: string; score: number }[];
  confidence: "alta" | "média" | "baixa";
};

export type IbovData = {
  source: string;
  points: Point[];
  /** variação diária do dólar (%) no mesmo pregão, alinhada a `points` */
  usdRet: (number | null)[];
  /** mudanças da Selic: data da vigência e novo valor */
  selic: { d: string; from: number; to: number }[];
  moves: Move[];
  fetchedAt: string;
};

/** Limiar de "dia marcante": variação absoluta mínima. */
export const MOVE_MIN = 1.5;

async function linkArticles(moves: Omit<Move, "articles" | "themes" | "confidence">[], dates: string[]): Promise<Move[]> {
  if (!moves.length) return [];
  const prevOf = new Map(dates.map((d, i) => [d, dates[i - 1] ?? d]));
  const OR = ALL_WORDS.flatMap((w) => [{ title: { contains: w, mode: "insensitive" as const } }, { description: { contains: w, mode: "insensitive" as const } }]);
  const window = (d: string) => ({ from: new Date(`${prevOf.get(d)}T18:00:00-03:00`), to: new Date(`${d}T23:59:59-03:00`) });
  // uma consulta por dia marcante (janelas curtas, usando o índice por data), em lotes
  const byMove: Awaited<ReturnType<typeof query>>[] = [];
  function query(d: string) {
    const w = window(d);
    return db.article.findMany({
      where: { scope: { in: ["MUNICIPAL", "ESTADUAL", "FEDERAL"] }, publishedAt: { gte: w.from, lte: w.to }, OR },
      select: { id: true, title: true, description: true, url: true, directUrl: true, publishedAt: true, category: true, source: { select: { name: true } } },
      orderBy: { publishedAt: "asc" },
      take: 60,
    });
  }
  for (let i = 0; i < moves.length; i += 8) byMove.push(...(await Promise.all(moves.slice(i, i + 8).map((m) => query(m.d)))));
  return moves.map((m, idx) => {
    // janela: depois do fechamento do pregão anterior (18h) até o fim do dia
    const arts = byMove[idx]
      .map((r) => {
        const text = `${r.title} ${r.description ?? ""}`;
        const t = norm(text);
        const market = MARKET.some((w) => t.includes(w));
        return { r, themes: themesOf(text), market, econ: r.category === "ECONOMIA" };
      })
      .filter((a) => a.market || a.themes.length > 0)
      // matérias que falam da bolsa e de economia primeiro
      .sort((a, b) => Number(b.market) * 3 + Number(b.econ) * 2 + b.themes.length - (Number(a.market) * 3 + Number(a.econ) * 2 + a.themes.length));
    const seen = new Set<string>();
    const articles: MoveArticle[] = [];
    for (const a of arts) {
      const k = a.r.title.toLowerCase().slice(0, 60);
      if (seen.has(k)) continue;
      seen.add(k);
      articles.push({ id: a.r.id, title: a.r.title, url: a.r.directUrl ?? a.r.url, source: a.r.source.name, at: a.r.publishedAt.toISOString(), themes: a.themes, market: a.market });
      if (articles.length >= 8) break;
    }
    const score = new Map<string, number>();
    for (const a of articles) for (const t of a.themes) score.set(t, (score.get(t) ?? 0) + (a.market ? 2 : 1));
      // Copom é um fato do dia (peso alto); o dólar muitas vezes acompanha a bolsa em vez de causar o movimento (peso menor)
    for (const s of m.signals) score.set(s.theme, (score.get(s.theme) ?? 0) + (s.kind === "copom" ? 4 : 2));
    const themes = [...score.entries()].map(([id, s]) => ({ id, score: s })).sort((a, b) => b.score - a.score);
    const top = themes[0]?.score ?? 0;
    const confidence: Move["confidence"] = top >= 6 && articles.length >= 3 ? "alta" : top >= 3 ? "média" : "baixa";
    return { ...m, articles, themes, confidence };
  });
}

export async function buildIbovespa(): Promise<IbovData> {
  const { points, source } = await fetchIbov();
  const [usd, selicRaw] = await Promise.all([sgsDaily(1, 5).catch(() => new Map<string, number>()), sgsDaily(432, 5).catch(() => new Map<string, number>())]);
  const dates = points.map((p) => p.d);
  // dólar: variação entre pregões consecutivos do Ibovespa (usa o último valor disponível até cada data)
  const usdKeys = [...usd.keys()].sort();
  const usdAt = (d: string) => {
    let lo = 0, hi = usdKeys.length - 1, best: string | null = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (usdKeys[mid] <= d) { best = usdKeys[mid]; lo = mid + 1; } else hi = mid - 1;
    }
    return best ? usd.get(best)! : null;
  };
  const usdRet = points.map((p, i) => {
    if (!i) return null;
    const a = usdAt(points[i - 1].d), b = usdAt(p.d);
    return a && b && a !== b ? (b / a - 1) * 100 : a && b ? 0 : null;
  });
  // Selic: dias em que a meta mudou (vigência no dia seguinte à reunião do Copom)
  const selic: IbovData["selic"] = [];
  let prev: number | null = null;
  for (const k of [...selicRaw.keys()].sort()) {
    const v = selicRaw.get(k)!;
    if (prev !== null && v !== prev) selic.push({ d: k, from: prev, to: v });
    prev = v;
  }
  const raw: Omit<Move, "articles" | "themes" | "confidence">[] = [];
  for (let i = 1; i < points.length; i++) {
    const ret = (points[i].close / points[i - 1].close - 1) * 100;
    if (Math.abs(ret) < MOVE_MIN) continue;
    const d = points[i].d;
    const signals: Signal[] = [];
    const u = usdRet[i];
    if (u !== null && Math.abs(u) >= 0.8) signals.push({ kind: "dolar", theme: "cambio", text: `Dólar ${u > 0 ? "subiu" : "caiu"} ${Math.abs(u).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% no mesmo período` });
    const cop = selic.find((s) => s.d >= points[i - 1].d && s.d <= d) ?? selic.find((s) => s.d > d && Date.parse(s.d) - Date.parse(d) <= 86400000);
    if (cop) signals.push({ kind: "copom", theme: "juros", text: `Copom ${cop.to > cop.from ? "subiu" : "cortou"} a Selic de ${cop.from.toLocaleString("pt-BR")}% para ${cop.to.toLocaleString("pt-BR")}%` });
    raw.push({ d, ret, close: points[i].close, signals });
  }
  const moves = await linkArticles(raw, dates);
  return { source, points, usdRet, selic, moves, fetchedAt: new Date().toISOString() };
}

/** Painel do Ibovespa com cache de 3 horas (o índice fecha uma vez por dia; as matérias chegam a cada hora). */
export async function getIbovespa(opts: { force?: boolean } = {}): Promise<IbovData | null> {
  return cached("ibovespa:v1", 0.125, buildIbovespa, opts.force);
}

/* ───────── Inferências do período ───────── */

export function pearson(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 20) return null;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db2 = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db2 += (b[i] - mb) ** 2;
  }
  return da && db2 ? num / Math.sqrt(da * db2) : null;
}
