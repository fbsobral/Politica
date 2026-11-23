import { db } from "@/lib/db";
import { INDICATORS, type Indicator } from "@/lib/indicators/catalog";
import { lastClosedYear, PARTIAL_KEY } from "@/lib/indicators/core";

/*
 * Gestão da atualização dos dados: o inventário de todas as bases que o app guarda, com que frequência a fonte
 * publica, em quanto tempo a gente precisa atualizar, e a situação de cada uma (em dia, atrasada, sem dado).
 * Tudo é atualizado uma vez por mês, pelo job "dataMonthly" (dia 2); entre uma atualização e outra, as páginas
 * usam o que está guardado (só buscam na hora o que ainda não existe). A página Admin → Dados mostra esta situação.
 */

export type Cadence = "diária" | "mensal" | "trimestral" | "anual" | "decenal";

export type Dataset = {
  id: string;
  name: string;
  /** página do app que usa a base */
  href: string;
  source: string;
  cadence: Cadence;
  /** idade máxima aceitável do que está guardado, em dias (acima disso, "atrasada") */
  maxAgeDays: number;
  /** prefixos das chaves no banco (tabela BudgetCache) */
  prefixes: string[];
  /** job que atualiza a base (rodar do admin) */
  job: string;
};

export const DATASETS: Dataset[] = [
  { id: "indicadores", name: "Indicadores (séries anuais)", href: "/indicadores", source: "IBGE, Banco Central, Tesouro, Banco Mundial", cadence: "mensal", maxAgeDays: 35, prefixes: ["ind:v8:"], job: "indicators" },
  { id: "ipea", name: "Atlas da Violência e PNAD (via IPEA)", href: "/pilares", source: "IPEA (Ipeadata)", cadence: "anual", maxAgeDays: 35, prefixes: ["ind:v1:"], job: "indicators" },
  { id: "orcamento", name: "Orçamento e execução (Siconfi)", href: "/orcamento", source: "Tesouro Nacional (Siconfi: DCA, RREO, RGF)", cadence: "mensal", maxAgeDays: 35, prefixes: ["budget:"], job: "budget" },
  { id: "inflacao", name: "Inflação, juros e Focus", href: "/inflacao", source: "IBGE (IPCA) e Banco Central (Focus, Selic)", cadence: "mensal", maxAgeDays: 35, prefixes: ["inflation:"], job: "marketData" },
  { id: "ibovespa", name: "Ibovespa", href: "/ibovespa", source: "B3 (via Yahoo Finance) e Banco Central", cadence: "diária", maxAgeDays: 35, prefixes: ["ibovespa:"], job: "marketData" },
  { id: "impostos", name: "Impostos (Brasil × OCDE)", href: "/impostos", source: "OCDE (Global Revenue Statistics) e Banco Mundial", cadence: "anual", maxAgeDays: 35, prefixes: ["taxes:"], job: "studies" },
  { id: "salarios", name: "Salários e lucros", href: "/salarios", source: "OCDE (contas nacionais) e Penn World Table", cadence: "anual", maxAgeDays: 35, prefixes: ["labor-share:"], job: "studies" },
];

export type DatasetHealth = Dataset & { count: number; newest: Date | null; oldest: Date | null; stale: number; status: "ok" | "atrasada" | "sem-dado" };

/** Situação de cada base: quantas chaves, a mais nova e a mais velha, e quantas passaram da idade máxima. */
export async function datasetHealth(): Promise<DatasetHealth[]> {
  const now = Date.now();
  return Promise.all(DATASETS.map(async (d) => {
    const rows = await db.budgetCache.findMany({ where: { OR: d.prefixes.map((p) => ({ key: { startsWith: p } })) }, select: { fetchedAt: true } }).catch(() => []);
    const times = rows.map((r) => r.fetchedAt.getTime());
    const stale = times.filter((t) => now - t > d.maxAgeDays * 86400000).length;
    const newest = times.length ? new Date(Math.max(...times)) : null;
    const oldest = times.length ? new Date(Math.min(...times)) : null;
    const status = !times.length ? "sem-dado" : newest && now - newest.getTime() > d.maxAgeDays * 86400000 ? "atrasada" : "ok";
    return { ...d, count: times.length, newest, oldest, stale, status };
  }));
}

/* ───────── indicador por indicador ───────── */

/** Frequência com que a fonte publica cada indicador, pela origem do dado. */
export function cadenceOf(ind: Indicator): Cadence {
  const s = `${ind.source} ${ind.desc}`;
  if (/Censo 2022/.test(s) && !/PNAD/.test(s)) return "decenal";
  if (/Banco Central|SGS|BCB/.test(s)) return "mensal";
  if (/trimestre|4099/.test(`${ind.name} ${s}`)) return "trimestral";
  return "anual";
}

/** Último ano que deveria estar disponível, dada a frequência (e o atraso típico de cada fonte). */
export function expectedYear(c: Cadence): number {
  const last = lastClosedYear();
  if (c === "mensal" || c === "trimestral") return last + 1; // já deve haver dado parcial do ano corrente
  if (c === "decenal") return 2022;
  return last - 1; // anual: a maioria das fontes publica o ano com 1 a 2 anos de atraso
}

export type IndicatorHealth = { id: string; name: string; source: string; cadence: Cadence; scopes: string[]; lastYear: number | null; partial: string | null; fetchedAt: Date | null; expected: number; status: "ok" | "atrasado" | "sem-dado" };

/** Para cada indicador: o último ano guardado (no Brasil), se é parcial, quando foi buscado e se está em dia. */
export async function indicatorHealth(): Promise<IndicatorHealth[]> {
  const keys = INDICATORS.map((i) => (i.fed ? `ind:v1:${i.id}:FEDERAL:br` : `ind:v8:${i.id}:FEDERAL:br`));
  // sem dado do Brasil: olha os estados (ou, se só existe por cidade, os municípios)
  const stateKeys = INDICATORS.filter((i) => !i.fetch.FEDERAL).map((i) => `${i.fed ? "ind:v1" : "ind:v8"}:${i.id}:${i.fetch.ESTADUAL ? "ESTADUAL" : "MUNICIPAL"}:`);
  const rows = await db.budgetCache.findMany({ where: { OR: [{ key: { in: keys } }, ...stateKeys.map((k) => ({ key: { startsWith: k } }))] }, select: { key: true, data: true, fetchedAt: true } }).catch(() => []);
  return INDICATORS.map((ind) => {
    const mine = rows.filter((r) => r.key.split(":")[2] === ind.id);
    let lastYear: number | null = null;
    let partial: string | null = null;
    let fetchedAt: Date | null = null;
    for (const r of mine) {
      const data = r.data as Record<string, unknown>;
      const ys = Object.keys(data).filter((k) => k !== PARTIAL_KEY).map(Number).filter(Number.isFinite);
      const y = ys.length ? Math.max(...ys) : null;
      if (y !== null && (lastYear === null || y > lastYear)) {
        lastYear = y;
        const p = data[PARTIAL_KEY] as { year: number; label: string } | undefined;
        partial = p && p.year === y ? p.label : null;
      }
      if (!fetchedAt || r.fetchedAt > fetchedAt) fetchedAt = r.fetchedAt;
    }
    const cadence = cadenceOf(ind);
    const expected = expectedYear(cadence);
    const status = lastYear === null ? "sem-dado" : lastYear >= expected ? "ok" : "atrasado";
    return { id: ind.id, name: ind.name, source: ind.source, cadence, scopes: Object.keys(ind.fetch), lastYear, partial, fetchedAt, expected, status };
  });
}
