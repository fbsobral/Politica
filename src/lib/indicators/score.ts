import { INDICATORS, getSeries } from "./catalog";
import { yearRange, type YearSeries } from "./core";
import type { Unit } from "./format";

export type Side = "economia" | "social";

/** Indicadores do score (todos nacionais, com série oficial na aba Indicadores). Peso igual dentro de cada lado; cada lado vale 50%. */
export const SCORE_SET: Record<Side, string[]> = {
  economia: ["pib-cresc", "desemprego", "ipca", "divida-bruta", "deficit-primario"],
  social: ["homicidios", "pobreza", "gini", "analfabetismo", "mortalidade-infantil"],
};

/** Quem exercia a Presidência ao fim de cada ano (Temer assumiu em 31/08/2016; a faixa de 2016 é dele). */
export const GOVERNMENTS = [
  { id: "temer", name: "Temer", from: 2016, to: 2018, color: "#7048e8" },
  { id: "bolsonaro", name: "Bolsonaro", from: 2019, to: 2022, color: "#0e8a5f" },
  { id: "lula", name: "Lula", from: 2023, to: 2099, color: "#d9480f" },
];
export const governmentOf = (year: number) => GOVERNMENTS.find((g) => year >= g.from && year <= g.to);

export type ScoreItem = { id: string; name: string; unit: Unit; decimals?: number; better: "up" | "down"; side: Side; values: YearSeries; notes: Record<number, number>; best: number; worst: number };
export type ScoreYear = { year: number; economia: number | null; social: number | null; total: number | null };
export type ScoreResult = { items: ScoreItem[]; years: ScoreYear[]; terms: { id: string; name: string; color: string; years: number[]; avg: number | null }[] };

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Nota de cada indicador em cada ano: 0 = pior valor da janela de 10 anos, 100 = melhor (segundo o sentido "melhor" do indicador).
 * Nota do lado = média das notas disponíveis no ano; score do ano = média simples dos dois lados (50/50), só quando os dois existem.
 */
export async function computeScore(): Promise<ScoreResult> {
  const { from, to } = yearRange();
  const geo = { uf: "", ufCode: 0, ibge: "", municipalityKey: "" };
  const items: ScoreItem[] = [];
  for (const side of ["economia", "social"] as Side[]) {
    for (const id of SCORE_SET[side]) {
      const ind = INDICATORS.find((i) => i.id === id);
      if (!ind || !ind.better) continue;
      const raw = await getSeries(ind, "FEDERAL", geo);
      if (!raw) continue;
      const values: YearSeries = {};
      for (const [y, v] of Object.entries(raw)) if (Number(y) >= from && Number(y) <= to) values[Number(y)] = v;
      const vs = Object.values(values);
      if (vs.length < 2) continue;
      const lo = Math.min(...vs), hi = Math.max(...vs);
      const best = ind.better === "up" ? hi : lo, worst = ind.better === "up" ? lo : hi;
      const notes: Record<number, number> = {};
      for (const [y, v] of Object.entries(values)) notes[Number(y)] = hi === lo ? 50 : (100 * (ind.better === "up" ? v - lo : hi - v)) / (hi - lo);
      items.push({ id, name: ind.name, unit: ind.unit, decimals: ind.decimals, better: ind.better, side, values, notes, best, worst });
    }
  }
  const years: ScoreYear[] = [];
  for (let y = from; y <= to; y++) {
    const side = (s: Side) => avg(items.filter((i) => i.side === s && i.notes[y] != null).map((i) => i.notes[y]));
    const economia = side("economia"), social = side("social");
    years.push({ year: y, economia, social, total: economia != null && social != null ? (economia + social) / 2 : null });
  }
  const terms = GOVERNMENTS.map((g) => {
    const ys = years.filter((y) => y.year >= g.from && y.year <= g.to && y.total != null);
    return { id: g.id, name: g.name, color: g.color, years: ys.map((y) => y.year), avg: avg(ys.map((y) => y.total!)) };
  });
  return { items, years, terms };
}
