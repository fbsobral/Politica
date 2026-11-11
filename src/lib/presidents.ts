/* Mandatos presidenciais por mês (para gráficos mensais e diários). Só dados: pode ser usado no navegador. */

export type PresidentTerm = { id: string; name: string; from: string; to: string | null; color: string };

/** Mesmas cores do Score. Dilma foi afastada em 12/05/2016; Temer governou a partir daí (interino até 31/08/2016). */
export const PRESIDENT_TERMS: PresidentTerm[] = [
  { id: "fhc", name: "FHC", from: "1995-01", to: "2002-12", color: "#2b8a3e" },
  { id: "lula12", name: "Lula", from: "2003-01", to: "2010-12", color: "#e03131" },
  { id: "dilma", name: "Dilma", from: "2011-01", to: "2016-04", color: "#c2255c" },
  { id: "temer", name: "Temer", from: "2016-05", to: "2018-12", color: "#7048e8" },
  { id: "bolsonaro", name: "Bolsonaro", from: "2019-01", to: "2022-12", color: "#0e8a5f" },
  { id: "lula3", name: "Lula", from: "2023-01", to: null, color: "#e8590c" },
];

/** Presidente no mês ("AAAA-MM" ou data "AAAA-MM-DD"). */
export function presidentAt(ym: string): PresidentTerm | null {
  const k = ym.slice(0, 7);
  return PRESIDENT_TERMS.find((t) => k >= t.from && (t.to === null || k <= t.to)) ?? null;
}

/** Trechos contínuos de cada presidente numa sequência de pontos (índices inicial e final). */
export function presidentSpans(keys: string[]): { term: PresidentTerm; i0: number; i1: number }[] {
  const out: { term: PresidentTerm; i0: number; i1: number }[] = [];
  keys.forEach((k, i) => {
    const t = presidentAt(k);
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.term.id === t.id && last.i1 === i - 1) last.i1 = i;
    else out.push({ term: t, i0: i, i1: i });
  });
  return out;
}
