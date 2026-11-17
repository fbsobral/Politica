import { cached } from "@/lib/indicators/core";

/*
 * Participação dos salários e taxa de exploração (Brasil), no sentido usado por Clara Mattei em "A Ordem do Capital":
 *   participação dos salários = remuneração dos empregados ÷ PIB (ou ÷ renda dos fatores);
 *   taxa de exploração        = excedente operacional bruto ÷ remuneração dos empregados
 *                               (quanto o capital recebe para cada R$ 1 pago em salários).
 *
 * Dados do IBGE (Sistema de Contas Nacionais) via OCDE e, para o longo prazo e a taxa de lucro, Penn World Table via FRED.
 * Os valores são validados: se algo não fizer sentido, o bloco fica indisponível em vez de mostrar número errado.
 */

const OECD_INCOME = "https://sdmx.oecd.org/public/rest/data/OECD.SDD.NAD,DSD_NAMAIN10@DF_TABLE1_INCOME,/A.BRA..........";
/** a API da OCDE devolve erro 500 com "Accept-Language: *", que o fetch do Node envia por padrão */
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; PoliticaBot/1.0)", "Accept-Language": "en" };

export type SharePoint = {
  /** "2015" (ou "2015-T3" numa série trimestral) */
  period: string;
  year: number;
  /** remuneração dos empregados ÷ PIB */
  wageGdp: number | null;
  /** remuneração ÷ (remuneração + excedente operacional e rendimento misto) */
  wageFactor: number | null;
  /** excedente operacional e rendimento misto ÷ remuneração dos empregados */
  exploitation: number;
  /** valores de origem, em reais correntes (memória de cálculo) */
  wages: number;
  /** excedente operacional bruto + rendimento misto bruto (a OCDE publica os dois somados para o Brasil) */
  surplus: number;
  mixed: number | null;
  gdp: number | null;
};

/**
 * Conta de geração da renda do Brasil (IBGE, Sistema de Contas Nacionais), publicada pela OCDE
 * (o SIDRA não traz esta conta): remuneração dos empregados (D1), excedente operacional e rendimento misto (B2A3G) e PIB.
 */
async function nationalAccounts(): Promise<SharePoint[]> {
  const res = await fetch(`${OECD_INCOME}?startPeriod=1990&format=csvfile`, { headers: HEADERS, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`OCDE ${res.status}`);
  const lines = (await res.text()).split(/\r?\n/);
  const head = lines[0]?.split(",") ?? [];
  const ix = (n: string) => head.indexOf(n);
  const [iT, iA, iU, iP, iS, iY, iV, iM] = ["TRANSACTION", "ACTIVITY", "UNIT_MEASURE", "PRICE_BASE", "SECTOR", "TIME_PERIOD", "OBS_VALUE", "UNIT_MULT"].map(ix);
  if ([iT, iA, iU, iY, iV].some((i) => i < 0)) throw new Error("CSV da OCDE sem as colunas esperadas");
  const v: Record<string, Record<number, number>> = {};
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    if (c.length < head.length || c[iV] === "") continue;
    // reais correntes, economia inteira
    if (c[iU] !== "XDC" || (iP >= 0 && c[iP] !== "V") || (iS >= 0 && c[iS] !== "S1") || !["_T", "_Z"].includes(c[iA])) continue;
    const t = c[iT];
    if (!["D1", "B2A3G", "B1GQ"].includes(t)) continue;
    const n = Number(c[iV]) * Math.pow(10, Number(c[iM]) || 0);
    if (Number.isFinite(n)) (v[t] ??= {})[Number(c[iY])] = n;
  }
  const pts: SharePoint[] = [];
  for (const y of Object.keys(v.D1 ?? {}).map(Number).sort((a, b) => a - b)) {
    const wage = v.D1[y], surplus = v.B2A3G?.[y], gdp = v.B1GQ?.[y];
    if (!(wage > 0) || !(surplus > 0)) continue;
    const wageGdp = gdp > 0 ? wage / gdp : null;
    const wageFactor = wage / (wage + surplus);
    const exploitation = surplus / wage;
    // validação: fora destas faixas, os dados não são os esperados
    if ((wageGdp !== null && (wageGdp < 0.2 || wageGdp > 0.8)) || wageFactor < 0.2 || wageFactor > 0.9 || exploitation < 0.1 || exploitation > 4) continue;
    pts.push({ period: String(y), year: y, wageGdp, wageFactor, exploitation, wages: wage, surplus, mixed: null, gdp: gdp > 0 ? gdp : null });
  }
  if (!pts.length) throw new Error("OCDE sem a conta de renda do Brasil");
  return pts;
}

/** Série anual do FRED (CSV público, sem chave): ano → valor. */
async function fred(id: string): Promise<Map<number, number>> {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, { headers: HEADERS, signal: AbortSignal.timeout(30000) });
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
  const [annual, long] = await Promise.all([
    nationalAccounts().catch((err) => {
      errors.push("IBGE/OCDE");
      console.warn("[labor-share] contas nacionais", (err as Error).message);
      return [] as SharePoint[];
    }),
    pwt().catch((err) => {
      errors.push("Penn World Table");
      console.warn("[labor-share] pwt", (err as Error).message);
      return [] as LongPoint[];
    }),
  ]);
  const quarterly: SharePoint[] = [];
  if (!annual.length && !long.length) throw new Error("sem dados"); // mantém o cache anterior
  return {
    annual,
    quarterly,
    annualSource: annual.length ? "IBGE, Sistema de Contas Nacionais (conta de geração da renda), publicado pela OCDE" : null,
    quarterlySource: null,
    longRun: long,
    errors,
    fetchedAt: new Date().toISOString(),
  };
}

/** Dados de salários e lucros do Brasil (cache de 7 dias: as contas nacionais saem uma vez por ano, as trimestrais a cada 3 meses). */
export async function getLaborShare(opts: { force?: boolean } = {}): Promise<LaborShareData | null> {
  return cached("labor-share:v4", 7, buildLaborShare, opts.force);
}
