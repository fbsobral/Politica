import { cached, getJson } from "@/lib/indicators/core";

/*
 * Impostos: carga tributária do Brasil por tipo de imposto, comparada com a média dos países desenvolvidos
 * e dos países em desenvolvimento.
 *
 * Fonte: OCDE, Global Revenue Statistics (receita tributária do governo geral: União, estados, municípios e
 * previdência), em % do PIB e em dólares correntes; Banco Mundial para a classificação de renda e a população.
 * Desenvolvidos = países de renda alta; em desenvolvimento = renda baixa e média (classificação atual do Banco Mundial).
 * As médias são simples (cada país pesa igual), como a média oficial da OCDE.
 */

const OECD = "https://sdmx.oecd.org/public/rest/data/OECD.CTP.TPS,DSD_REV_COMP_GLOBAL@DF_RSGLOBAL,";
const START = 1990;

export type Category = { code: string; name: string; desc: string; parent?: string };

/** Categorias de impostos (classificação da OCDE) na ordem de exibição. */
export const CATEGORIES: Category[] = [
  { code: "_T", name: "Carga tributária total", desc: "Todos os impostos e contribuições sociais pagos a União, estados, municípios e previdência." },
  { code: "T_5000", name: "Consumo (bens e serviços)", desc: "Impostos embutidos nos preços: ICMS, ISS, PIS/Cofins, IPI, IOF-câmbio, impostos sobre combustíveis, bebidas, cigarros, importação." },
  { code: "T_5110", parent: "T_5000", name: "Gerais sobre vendas e serviços", desc: "Impostos que incidem sobre quase tudo o que se vende: ICMS, ISS, PIS/Cofins (e o IVA, nos outros países)." },
  { code: "T_5120", parent: "T_5000", name: "Sobre produtos específicos", desc: "Impostos seletivos: combustíveis, bebidas, cigarros, veículos, importação." },
  { code: "T_1000", name: "Renda e lucros", desc: "Imposto de renda das pessoas e das empresas e contribuição sobre o lucro (CSLL)." },
  { code: "T_1100", parent: "T_1000", name: "Renda das pessoas físicas", desc: "Imposto de renda pago por trabalhadores, aposentados e investidores." },
  { code: "T_1200", parent: "T_1000", name: "Lucro das empresas", desc: "IRPJ e CSLL e equivalentes nos outros países." },
  { code: "T_2000", name: "Contribuições previdenciárias", desc: "INSS de empregados e empregadores e contribuições para a previdência dos servidores." },
  { code: "T_3000", name: "Folha de pagamento", desc: "Tributos sobre a folha que não vão para a previdência (no Brasil, por exemplo, salário-educação e Sistema S)." },
  { code: "T_4000", name: "Patrimônio", desc: "Impostos sobre o que se tem ou se transfere: IPTU, ITBI, ITCMD e IOF sobre operações financeiras (o IPVA entra em consumo, na classificação da OCDE)." },
  { code: "T_4100", parent: "T_4000", name: "Imóveis (recorrente)", desc: "IPTU e equivalentes." },
  { code: "T_4300", parent: "T_4000", name: "Heranças e doações", desc: "ITCMD e equivalentes." },
  { code: "T_4400", parent: "T_4000", name: "Transações financeiras e de capital", desc: "ITBI, IOF sobre operações de crédito e outras transações." },
  { code: "T_6000", name: "Outros impostos", desc: "Tributos que não se encaixam nas demais categorias." },
];

type Row = { area: string; cat: string; year: number; value: number };

function parseCsv(text: string, scale: boolean): Row[] {
  const lines = text.split(/\r?\n/);
  const head = lines[0]?.split(",") ?? [];
  const ix = (n: string) => head.indexOf(n);
  const [iA, iC, iY, iV, iM] = [ix("REF_AREA"), ix("STANDARD_REVENUE"), ix("TIME_PERIOD"), ix("OBS_VALUE"), ix("UNIT_MULT")];
  if (iA < 0 || iC < 0 || iY < 0 || iV < 0) throw new Error("CSV da OCDE sem as colunas esperadas");
  const out: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(",");
    if (c.length < head.length || c[iV] === "") continue;
    const v = Number(c[iV]);
    if (!Number.isFinite(v)) continue;
    const mult = scale && iM >= 0 ? Math.pow(10, Number(c[iM]) || 0) : 1;
    out.push({ area: c[iA], cat: c[iC], year: Number(c[iY]), value: v * mult });
  }
  return out;
}

async function oecd(unit: "PT_B1GQ" | "USD"): Promise<Row[]> {
  const cats = CATEGORIES.map((c) => c.code).join("+");
  const res = await fetch(`${OECD}/.TAX_REV.S13.${cats}._T.${unit}.A?startPeriod=${START}&format=csvfile`, {
    // a API da OCDE devolve erro 500 com "Accept-Language: *", que o fetch do Node envia por padrão
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PoliticaBot/1.0)", Accept: "text/csv", "Accept-Language": "en" },
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`OCDE ${res.status}`);
  return parseCsv(await res.text(), unit === "USD");
}

type WbCountry = { id: string; incomeLevel: { id: string } };
type WbPop = { countryiso3code: string; date: string; value: number | null };

export type GroupStat = { pct: number | null; perCapita: number | null; usdAvg: number | null; n: number };
export type CatSeries = {
  code: string;
  brazil: { pct: (number | null)[]; usd: (number | null)[]; perCapita: (number | null)[] };
  developed: GroupStat[];
  developing: GroupStat[];
  /** médias oficiais da OCDE, só em % do PIB */
  oecdAvg: (number | null)[];
  latamAvg: (number | null)[];
};
export type TaxData = { years: number[]; series: CatSeries[]; population: (number | null)[]; source: string; fetchedAt: string };

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

async function build(): Promise<TaxData> {
  const [pct, usd, countries, popResp] = await Promise.all([
    oecd("PT_B1GQ"),
    oecd("USD").catch(() => [] as Row[]),
    getJson<[unknown, WbCountry[]]>("https://api.worldbank.org/v2/country?format=json&per_page=400", 120000),
    getJson<[unknown, WbPop[]]>(`https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&date=${START}:${new Date().getFullYear()}&per_page=20000`, 180000).catch(() => [null, [] as WbPop[]] as [unknown, WbPop[]]),
  ]);
  const income = new Map(countries[1].map((c) => [c.id, c.incomeLevel.id]));
  const group = (a: string) => (income.get(a) === "HIC" ? "dev" : ["UMC", "LMC", "LIC"].includes(income.get(a) ?? "") ? "emg" : null);
  const pop = new Map<string, number>();
  for (const p of popResp[1] ?? []) if (p.value) pop.set(`${p.countryiso3code}|${p.date}`, p.value);

  const key = (a: string, c: string, y: number) => `${a}|${c}|${y}`;
  const pctMap = new Map(pct.map((r) => [key(r.area, r.cat, r.year), r.value]));
  const usdMap = new Map(usd.map((r) => [key(r.area, r.cat, r.year), r.value]));
  const areas = [...new Set(pct.map((r) => r.area))].filter((a) => a.length === 3);
  const years = [...new Set(pct.filter((r) => r.area === "BRA" && r.cat === "_T").map((r) => r.year))].sort((a, b) => a - b);

  // validação: a carga total do Brasil fica entre 15% e 50% do PIB em qualquer ano
  const brTotal = years.map((y) => pctMap.get(key("BRA", "_T", y)) ?? 0);
  if (!years.length || brTotal.some((v) => v < 15 || v > 50)) throw new Error("série do Brasil fora do esperado");

  const stat = (g: "dev" | "emg", c: string, y: number): GroupStat => {
    const members = areas.filter((a) => group(a) === g);
    const p: number[] = [], pc: number[] = [], tot: number[] = [];
    for (const a of members) {
      const v = pctMap.get(key(a, c, y));
      if (v === undefined) continue;
      p.push(v);
      const u = usdMap.get(key(a, c, y));
      if (u !== undefined) {
        tot.push(u);
        const n = pop.get(`${a}|${y}`);
        if (n) pc.push(u / n);
      }
    }
    return { pct: mean(p), perCapita: mean(pc), usdAvg: mean(tot), n: p.length };
  };

  const series: CatSeries[] = CATEGORIES.map((c) => ({
    code: c.code,
    brazil: {
      pct: years.map((y) => pctMap.get(key("BRA", c.code, y)) ?? null),
      usd: years.map((y) => usdMap.get(key("BRA", c.code, y)) ?? null),
      perCapita: years.map((y) => {
        const u = usdMap.get(key("BRA", c.code, y)), n = pop.get(`BRA|${y}`);
        return u !== undefined && n ? u / n : null;
      }),
    },
    developed: years.map((y) => stat("dev", c.code, y)),
    developing: years.map((y) => stat("emg", c.code, y)),
    oecdAvg: years.map((y) => pctMap.get(key("OECD_REP", c.code, y)) ?? null),
    latamAvg: years.map((y) => pctMap.get(key("A9", c.code, y)) ?? null),
  }));

  return {
    years,
    series,
    population: years.map((y) => pop.get(`BRA|${y}`) ?? null),
    source: "OCDE, Global Revenue Statistics (governo geral); Banco Mundial (classificação de renda e população)",
    fetchedAt: new Date().toISOString(),
  };
}

/** Carga tributária comparada (cache de 30 dias: a OCDE atualiza a base uma vez por ano). */
export async function getTaxes(opts: { force?: boolean } = {}): Promise<TaxData | null> {
  return cached("taxes:v1", 30, build, opts.force);
}

export { build as buildTaxes };
