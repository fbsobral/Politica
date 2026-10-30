import { INDICATORS, getSeries, type Indicator } from "./catalog";
import { lastClosedYear, type Geo, type Scope, type YearSeries } from "./core";
import type { Unit } from "./format";

export type Side = "economia" | "social";

const SIDE_OF_GROUP: Record<string, Side> = { economia: "economia", financas: "economia", familias: "economia", seguranca: "social", social: "social", servicos: "social" };

/** Indicadores que podem entrar no score: têm sentido de "melhor" e dado na esfera. Valores em R$ só entram se a própria fonte já os publica em termos reais (senão crescem com a inflação). */
export function candidates(scope: Scope): { ind: Indicator; side: Side }[] {
  return INDICATORS.filter((i) => i.better && (i.unit !== "brl" || i.real) && i.unit !== "count" && i.fetch[scope] && SIDE_OF_GROUP[i.group]).map((ind) => ({ ind, side: SIDE_OF_GROUP[ind.group] }));
}

/** Conjunto padrão: no Brasil, os 10 indicadores principais; em estado e município, os indicadores principais que existem (as sub-métricas ficam como opção). */
const FEDERAL_DEFAULT = ["pib-cresc", "desemprego", "ipca", "divida-bruta", "deficit-primario", "homicidios", "pobreza", "gini", "analfabetismo", "mortalidade-infantil", "renda-trabalho", "subutilizacao"];
export const defaultSelection = (scope: Scope): string[] => candidates(scope).filter((c) => (scope === "FEDERAL" ? FEDERAL_DEFAULT.includes(c.ind.id) : !c.ind.parent)).map((c) => c.ind.id);

export type Term = { id: string; name: string | null; role: string; from: number; to: number; color: string };

/** Quem exercia a Presidência ao fim de cada ano (Temer assumiu em 31/08/2016, então 2016 fica com ele). */
export const PRESIDENTS: Term[] = [
  { id: "lula2", name: "Lula", role: "Presidente (2º mandato)", from: 2006, to: 2010, color: "#d9480f" },
  { id: "dilma", name: "Dilma Rousseff", role: "Presidente", from: 2011, to: 2015, color: "#c2255c" },
  { id: "temer", name: "Michel Temer", role: "Presidente", from: 2016, to: 2018, color: "#7048e8" },
  { id: "bolsonaro", name: "Jair Bolsonaro", role: "Presidente", from: 2019, to: 2022, color: "#0e8a5f" },
  { id: "lula3", name: "Lula", role: "Presidente (3º mandato)", from: 2023, to: 2099, color: "#e8590c" },
];

const PALETTE = ["#17407f", "#0e8a5f", "#d9480f", "#7048e8", "#e0a800", "#d6336c"];

/** Mandatos fixos por esfera quando não há nomes: governadores e prefeitos têm ciclos de 4 anos. */
export function cycleTerms(scope: Scope, names: { from: number; to: number; name: string }[] = []): Term[] {
  const start = scope === "ESTADUAL" ? 2007 : 2005; // governador toma posse em janeiro do ano seguinte à eleição; prefeito idem, 2 anos antes
  const role = scope === "ESTADUAL" ? "Governador" : "Prefeito";
  const out: Term[] = [];
  for (let from = start, i = 0; from <= lastClosedYear(); from += 4, i++) {
    const to = from + 3;
    const nm = names.filter((n) => n.from === from).map((n) => n.name).join(" / ") || null;
    out.push({ id: `${scope}-${from}`, name: nm, role, from, to, color: PALETTE[i % PALETTE.length] });
  }
  return out;
}

export type ScoreItem = { id: string; name: string; unit: Unit; decimals?: number; better: "up" | "down"; side: Side; values: YearSeries; notes: Record<number, number> };
export type ScoreYear = { year: number; economia: number | null; social: number | null; total: number | null };
export type ScoreResult = { items: ScoreItem[]; years: ScoreYear[]; terms: (Term & { avg: number | null; years: number[] })[]; sides: Record<Side, number> };

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Nota de cada indicador em cada ano = quanto o ano MELHOROU em relação ao anterior, comparado com a melhora de todos os outros anos
 * da mesma série (posição percentual: 100 = a maior melhora, 0 = a maior piora, 50 = mediana). A régua é a mesma para todos os anos
 * e governos; como a nota mede a variação e não o nível, tendências de longo prazo não favorecem quem vem depois.
 * Só compara anos consecutivos que a fonte publicou (nada é preenchido).
 */
function improvementNotes(values: YearSeries, better: "up" | "down"): Record<number, number> {
  const deltas: { y: number; d: number }[] = [];
  for (const [ys, v] of Object.entries(values)) {
    const y = Number(ys);
    if (values[y - 1] != null) deltas.push({ y, d: (better === "up" ? 1 : -1) * (v - values[y - 1]) });
  }
  const out: Record<number, number> = {};
  for (const { y, d } of deltas) {
    const less = deltas.filter((x) => x.d < d).length;
    const equal = deltas.filter((x) => x.d === d).length;
    out[y] = (100 * (less + equal / 2)) / deltas.length;
  }
  return out;
}

export async function computeScore(scope: Scope, geo: Geo, selected: string[], from: number, terms: Term[]): Promise<ScoreResult> {
  const items: ScoreItem[] = [];
  for (const { ind, side } of candidates(scope)) {
    if (!selected.includes(ind.id)) continue;
    const values = await getSeries(ind, scope, geo);
    if (!values) continue;
    const notes = improvementNotes(values, ind.better!);
    if (!Object.keys(notes).length) continue;
    items.push({ id: ind.id, name: ind.name, unit: ind.unit, decimals: ind.decimals, better: ind.better!, side, values, notes });
  }
  const to = lastClosedYear();
  const years: ScoreYear[] = [];
  for (let y = from; y <= to; y++) {
    const side = (s: Side) => avg(items.filter((i) => i.side === s && i.notes[y] != null).map((i) => i.notes[y]));
    const economia = side("economia"), social = side("social");
    years.push({ year: y, economia, social, total: economia != null && social != null ? (economia + social) / 2 : null });
  }
  const outTerms = terms
    .filter((t) => t.to >= from && t.from <= to)
    .map((t) => {
      const ys = years.filter((y) => y.year >= t.from && y.year <= t.to && y.total != null);
      return { ...t, avg: avg(ys.map((y) => y.total!)), years: ys.map((y) => y.year) };
    });
  return { items, years, terms: outTerms, sides: { economia: items.filter((i) => i.side === "economia").length, social: items.filter((i) => i.side === "social").length } };
}
