import { cached, sidra } from "@/lib/indicators/core";

/*
 * PIB por setor e por componente da demanda (Contas Nacionais Trimestrais do IBGE):
 * crescimento real (volume) de cada setor e subsetor por trimestre, acumulado no ano contra o mesmo período do ano
 * anterior, em 4 trimestres e no ano fechado; e o peso de cada um no valor adicionado (valores correntes).
 * Só existe para o Brasil (o IBGE não publica PIB trimestral por estado ou cidade).
 */

export type GdpView = "oferta" | "demanda";

type Def = { code: number; name: string; desc: string; parent?: number };

/** Setores (ótica da produção), na ordem e com a hierarquia do IBGE. */
const SUPPLY: Def[] = [
  { code: 90687, name: "Agropecuária", desc: "Lavouras, pecuária, produção florestal, pesca e aquicultura. O IBGE não abre a agropecuária no PIB trimestral; o resultado oscila muito com a safra (soja, milho, café, cana) e o clima." },
  { code: 90691, name: "Indústria", desc: "Indústrias extrativas, de transformação, construção e serviços de eletricidade, gás, água e esgoto." },
  { code: 90692, name: "Indústrias extrativas", parent: 90691, desc: "Petróleo, gás natural e minérios (sobretudo minério de ferro)." },
  { code: 90693, name: "Indústrias de transformação", parent: 90691, desc: "Fábricas: alimentos, veículos, máquinas, química, metalurgia, têxtil e outras." },
  { code: 90695, name: "Eletricidade, gás, água, esgoto e resíduos", parent: 90691, desc: "Geração e distribuição de energia e gás, saneamento e gestão de resíduos." },
  { code: 90694, name: "Construção", parent: 90691, desc: "Obras de edificação e infraestrutura." },
  { code: 90696, name: "Serviços", desc: "Comércio, transporte, informação, finanças, imóveis, administração pública e outros serviços: cerca de 70% da economia." },
  { code: 90697, name: "Comércio", parent: 90696, desc: "Comércio e reparação de veículos, atacado e varejo." },
  { code: 90698, name: "Transporte, armazenagem e correio", parent: 90696, desc: "Transporte de cargas e passageiros, armazéns e correio." },
  { code: 90699, name: "Informação e comunicação", parent: 90696, desc: "Telecomunicações, tecnologia da informação, edição e audiovisual." },
  { code: 90700, name: "Atividades financeiras e seguros", parent: 90696, desc: "Bancos, crédito, seguros e previdência complementar." },
  { code: 90702, name: "Atividades imobiliárias", parent: 90696, desc: "Aluguéis, compra e venda de imóveis (inclui o aluguel que o dono 'paga a si mesmo', estimado pelo IBGE)." },
  { code: 90701, name: "Outras atividades de serviços", parent: 90696, desc: "Alimentação e alojamento, serviços às empresas e às famílias, educação e saúde privadas e outros." },
  { code: 90703, name: "Administração, saúde e educação públicas", parent: 90696, desc: "Serviços públicos: administração, defesa, saúde e educação públicas e seguridade social." },
  { code: 90706, name: "Impostos sobre produtos", desc: "Impostos líquidos de subsídios que, somados ao valor adicionado dos setores, formam o PIB." },
];
/** Componentes da demanda (ótica da despesa). */
const DEMAND: Def[] = [
  { code: 93404, name: "Consumo das famílias", desc: "Tudo o que as famílias compram de bens e serviços: o maior componente do PIB, cerca de 60%." },
  { code: 93405, name: "Consumo do governo", desc: "Gasto do governo com serviços prestados à população (saúde, educação, segurança…), sem investimentos nem transferências." },
  { code: 93406, name: "Investimento (formação bruta de capital fixo)", desc: "Máquinas, equipamentos, construções e infraestrutura: o que amplia a capacidade de produzir no futuro." },
  { code: 93407, name: "Exportações", desc: "Bens e serviços vendidos ao exterior." },
  { code: 93408, name: "Importações", desc: "Bens e serviços comprados do exterior (entram no PIB com sinal negativo)." },
];
const PIB = 90707, VA = 90705;

export type GdpRow = {
  code: number;
  name: string;
  desc: string;
  parent?: number;
  /** taxa acumulada no ano contra o mesmo período do ano anterior, no trimestre mais recente */
  acc: number | null;
  /** último trimestre contra o mesmo trimestre do ano anterior */
  yoy: number | null;
  /** últimos 4 trimestres contra os 4 anteriores */
  last4: number | null;
  /** crescimento de cada ano fechado (taxa acumulada no 4º trimestre) */
  annual: Record<number, number>;
  /** últimos 12 trimestres, contra o mesmo trimestre do ano anterior (para o minigráfico) */
  quarters: { q: string; v: number }[];
  /** peso no valor adicionado (setores) ou no PIB (demanda), nos últimos 4 trimestres, em valores correntes */
  share: number | null;
};

export type GdpData = {
  /** trimestre mais recente publicado, ex.: { year: 2026, q: 2 } */
  latest: { year: number; q: number };
  pib: GdpRow;
  supply: GdpRow[];
  demand: GdpRow[];
  fetchedAt: string;
};

export const quarterLabel = (q: number) => (q === 1 ? "1º tri" : `1º–${q}º tri`);

async function build(): Promise<GdpData> {
  const codes = [...SUPPLY, ...DEMAND].map((d) => d.code).concat([PIB, VA]);
  const [rates, nominal] = await Promise.all([
    sidra(`t/5932/n1/all/v/6561,6562,6563/p/all/c11255/${codes.join(",")}`),
    sidra(`t/1846/n1/all/v/585/p/last%204/c11255/${codes.join(",")}`),
  ]);
  if (!rates.length) throw new Error("Contas Trimestrais sem dados");
  // por variável → categoria → período (AAAAT)
  const by = new Map<string, Map<number, Map<string, number>>>();
  for (const r of rates) {
    if (r.v === null) continue;
    const v = String(r.D2C), c = Number(r.D4C), p = String(r.D3C);
    if (!by.has(v)) by.set(v, new Map());
    const m = by.get(v)!;
    if (!m.has(c)) m.set(c, new Map());
    m.get(c)!.set(p, r.v);
  }
  const periods = [...new Set(rates.map((r) => String(r.D3C)))].sort();
  const last = periods.at(-1)!;
  const latest = { year: Number(last.slice(0, 4)), q: Number(last.slice(4)) };
  const sum4 = new Map<number, number>();
  for (const r of nominal) if (r.v !== null) sum4.set(Number(r.D4C), (sum4.get(Number(r.D4C)) ?? 0) + r.v);
  const get = (v: string, c: number, p: string) => by.get(v)?.get(c)?.get(p) ?? null;

  const row = (d: Def, base: number): GdpRow => {
    const annual: Record<number, number> = {};
    for (const p of periods) if (p.endsWith("04")) { const x = get("6563", d.code, p); if (x !== null) annual[Number(p.slice(0, 4))] = x; }
    const quarters = periods.slice(-12).map((p) => ({ q: `${Number(p.slice(4))}º/${p.slice(2, 4)}`, v: get("6561", d.code, p) })).filter((x): x is { q: string; v: number } => x.v !== null);
    const s = sum4.get(d.code), b = sum4.get(base);
    return { ...d, acc: get("6563", d.code, last), yoy: get("6561", d.code, last), last4: get("6562", d.code, last), annual, quarters, share: s && b ? s / b : null };
  };
  return {
    latest,
    pib: row({ code: PIB, name: "PIB", desc: "Produto Interno Bruto a preços de mercado: tudo o que se produz no país." }, PIB),
    supply: SUPPLY.map((d) => row(d, d.code === 90706 ? PIB : VA)),
    demand: DEMAND.map((d) => row(d, PIB)),
    fetchedAt: new Date().toISOString(),
  };
}

export async function getGdp(opts: { force?: boolean } = {}): Promise<GdpData | null> {
  return cached("gdp:v1", 30, build, opts.force);
}
