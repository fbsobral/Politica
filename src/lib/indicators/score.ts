import { INDICATORS, getSeries, type Indicator } from "./catalog";
import { lastClosedYear, YEARS_BACK, type Geo, type Scope, type YearSeries } from "./core";
import type { Unit } from "./format";
import { TARGETS, fixedTargetFor } from "./targets";

export type Side = "economia" | "social";

const SIDE_OF_GROUP: Record<string, Side> = { economia: "economia", financas: "economia", familias: "economia", seguranca: "social", social: "social", servicos: "social" };

/** Indicadores que podem entrar no score: têm sentido de "melhor" e dado na esfera. Valores em R$ só entram se a própria fonte já os publica em termos reais. */
export function candidates(scope: Scope): { ind: Indicator; side: Side }[] {
  return INDICATORS.filter((i) => i.better && (i.unit !== "brl" || i.real) && i.unit !== "count" && i.fetch[scope] && SIDE_OF_GROUP[i.group]).map((ind) => ({ ind, side: SIDE_OF_GROUP[ind.group] }));
}

/** Conjunto padrão: os indicadores principais que têm meta de referência (as sub-métricas ficam como opção). */
export const defaultSelection = (scope: Scope): string[] => candidates(scope).filter((c) => !c.ind.parent && TARGETS[c.ind.id] && (TARGETS[c.ind.id].value != null || TARGETS[c.ind.id].base || TARGETS[c.ind.id].byScope?.[scope] != null)).map((c) => c.ind.id);

export type Term = { id: string; name: string | null; role: string; from: number; to: number; color: string };

/** Quem exercia a Presidência ao fim de cada ano (Temer assumiu em 31/08/2016, então 2016 fica com ele; Itamar Franco, 1993–1994, fica fora da janela de 30 anos). */
export const PRESIDENTS: Term[] = [
  { id: "fhc1", name: "Fernando Henrique Cardoso", role: "Presidente (1º mandato)", from: 1995, to: 1998, color: "#2b8a3e" },
  { id: "fhc2", name: "Fernando Henrique Cardoso", role: "Presidente (2º mandato)", from: 1999, to: 2002, color: "#5c940d" },
  { id: "lula1", name: "Lula", role: "Presidente (1º mandato)", from: 2003, to: 2006, color: "#e03131" },
  { id: "lula2", name: "Lula", role: "Presidente (2º mandato)", from: 2007, to: 2010, color: "#d9480f" },
  { id: "dilma", name: "Dilma Rousseff", role: "Presidente", from: 2011, to: 2015, color: "#c2255c" },
  { id: "temer", name: "Michel Temer", role: "Presidente", from: 2016, to: 2018, color: "#7048e8" },
  { id: "bolsonaro", name: "Jair Bolsonaro", role: "Presidente", from: 2019, to: 2022, color: "#0e8a5f" },
  { id: "lula3", name: "Lula", role: "Presidente (3º mandato)", from: 2023, to: 2099, color: "#e8590c" },
];

const PALETTE = ["#17407f", "#0e8a5f", "#d9480f", "#7048e8", "#e0a800", "#d6336c"];

/** Mandatos fixos por esfera, com os nomes dos eleitos quando já foram carregados. */
export function cycleTerms(scope: Scope, names: { from: number; to: number; name: string }[] = []): Term[] {
  const start = scope === "ESTADUAL" ? 1995 : 1997; // posse em janeiro do ano seguinte à eleição (1994 e 1996)
  const role = scope === "ESTADUAL" ? "Governador" : "Prefeito";
  const out: Term[] = [];
  for (let from = start, i = 0; from <= lastClosedYear(); from += 4, i++) {
    const to = from + 3;
    const nm = names.filter((n) => n.from === from).map((n) => n.name).join(" / ") || null;
    out.push({ id: `${scope}-${from}`, name: nm, role, from, to, color: PALETTE[i % PALETTE.length] });
  }
  return out;
}

/** "nivel": nota = proximidade da meta. "nivel-avanco": média entre proximidade e avanço em relação ao ano anterior. */
export type ScoreMethod = "nivel" | "nivel-avanco";
export type TargetMode = "fixa" | "personalizada";
export type ScoreItem = {
  id: string; name: string; unit: Unit; decimals?: number; better: "up" | "down"; side: Side;
  values: YearSeries;
  /** nota final do ano (0 a 100) = média de nível e avanço */
  notes: Record<number, number>;
  level: Record<number, number>;
  advance: Record<number, number>;
  /** meta em uso (nula = sem meta definida: o indicador aparece, mas não entra na conta) */
  target: number | null;
  targetMode: TargetMode | null;
  fixedTarget: number | null;
  targetRef: string | null;
  targetApprox: boolean;
  hasData: boolean;
  considered: boolean;
};
export type ScoreYear = { year: number; economia: number | null; social: number | null; total: number | null };
export type ScoreResult = { items: ScoreItem[]; years: ScoreYear[]; terms: (Term & { avg: number | null; years: number[] })[]; sides: Record<Side, number> };

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Distância até a meta no sentido "pior" (0 = meta atingida ou superada). */
const gapOf = (v: number, target: number, better: "up" | "down") => Math.max(0, better === "down" ? v - target : target - v);

/**
 * Nível (0 a 100): proximidade da meta. Meta atingida ou superada = 100 (teto).
 * - "menos é melhor", meta > 0: 100 × meta ÷ valor;  "mais é melhor", meta > 0: 100 × valor ÷ meta.
 * - meta ≤ 0 (ex.: déficit zero): 100 ÷ (1 + distância).
 */
export function levelScore(v: number, target: number, better: "up" | "down"): number {
  const gap = gapOf(v, target, better);
  if (gap === 0) return 100;
  if (target <= 0) return 100 / (1 + gap);
  return Math.max(0, Math.min(100, better === "down" ? (100 * target) / v : (100 * v) / target));
}

/**
 * Avanço (0 a 100): quanto da distância até a meta foi fechada em relação ao ano anterior.
 * 100 = fechou toda a distância (ou segue na meta); 50 = ficou parado; 0 = a distância dobrou ou mais.
 */
export function advanceScore(prev: number, now: number, target: number, better: "up" | "down"): number {
  const gp = gapOf(prev, target, better), gn = gapOf(now, target, better);
  if (gn === 0) return 100;
  const c = gp > 0 ? (gp - gn) / gp : -gn / (Math.abs(target) || 1);
  return 50 + 50 * Math.max(-1, Math.min(1, c));
}

export async function computeScore(scope: Scope, geo: Geo, selected: string[], from: number, terms: Term[], custom: Record<string, number> = {}, method: ScoreMethod = "nivel"): Promise<ScoreResult> {
  const items: ScoreItem[] = [];
  for (const { ind, side } of candidates(scope)) {
    const values = (await getSeries(ind, scope, geo, { lazy: true })) ?? {};
    const fixed = fixedTargetFor(ind.id, scope, values);
    const own = custom[ind.id];
    const target = own != null && Number.isFinite(own) ? own : fixed;
    const targetMode: TargetMode | null = own != null && Number.isFinite(own) ? "personalizada" : fixed != null ? "fixa" : null;
    const notes: Record<number, number> = {}, level: Record<number, number> = {}, advance: Record<number, number> = {};
    if (target != null) {
      for (const [ys, v] of Object.entries(values)) {
        const y = Number(ys);
        if (method === "nivel-avanco" && values[y - 1] == null) continue;
        level[y] = levelScore(v, target, ind.better!);
        if (values[y - 1] != null) advance[y] = advanceScore(values[y - 1], v, target, ind.better!);
        notes[y] = method === "nivel" ? level[y] : (level[y] + advance[y]) / 2;
      }
    }
    items.push({ id: ind.id, name: ind.name, unit: ind.unit, decimals: ind.decimals, better: ind.better!, side, values, notes, level, advance, target, targetMode, fixedTarget: fixed, targetRef: TARGETS[ind.id]?.ref ?? null, targetApprox: Boolean(TARGETS[ind.id]?.approx), hasData: Object.keys(notes).length > 0, considered: selected.includes(ind.id) });
  }
  items.sort((a, b) => Number(b.considered) - Number(a.considered));
  const to = lastClosedYear();
  // o score é calculado sobre todos os anos guardados; a janela (5/10/20/30 anos) só limita o que a tela mostra
  const first = Math.min(from, to - YEARS_BACK + 1);
  const years: ScoreYear[] = [];
  for (let y = first; y <= to; y++) {
    const side = (s: Side) => avg(items.filter((i) => i.considered && i.side === s && i.notes[y] != null).map((i) => i.notes[y]));
    const economia = side("economia"), social = side("social");
    years.push({ year: y, economia, social, total: economia != null && social != null ? (economia + social) / 2 : null });
  }
  const outTerms = terms
    .filter((t) => t.from <= to)
    .map((t) => {
      const ys = years.filter((y) => y.year >= t.from && y.year <= t.to && y.total != null);
      return { ...t, avg: avg(ys.map((y) => y.total!)), years: ys.map((y) => y.year) };
    });
  return { items, years, terms: outTerms, sides: { economia: items.filter((i) => i.considered && i.side === "economia" && i.hasData).length, social: items.filter((i) => i.considered && i.side === "social" && i.hasData).length } };
}
