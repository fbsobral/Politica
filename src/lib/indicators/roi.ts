import type { YearSeries } from "./core";

export type RoiWindow = {
  from: number;
  to: number;
  /** gasto real somado nos anos depois do início até o fim da janela (o que foi investido durante o período) */
  invested: number;
  spendFrom: number;
  spendTo: number;
  spendChange: number | null;
  indFrom: number;
  indTo: number;
  delta: number;
  /** melhora do indicador no sentido "melhor" (positivo = melhorou) */
  improvement: number;
  /** R$ investidos por unidade de melhora; nulo se o indicador não melhorou */
  costPerUnit: number | null;
  kind: "gasto-sobe-melhora" | "gasto-sobe-piora" | "gasto-cai-melhora" | "gasto-cai-piora" | "estavel";
};

export const KIND_LABEL: Record<RoiWindow["kind"], string> = {
  "gasto-sobe-melhora": "Gastou mais e melhorou",
  "gasto-sobe-piora": "Gastou mais e não melhorou",
  "gasto-cai-melhora": "Gastou menos e melhorou",
  "gasto-cai-piora": "Gastou menos e piorou",
  estavel: "Sem mudança",
};

/**
 * Janelas de `h` anos: compara o ano de início com o ano final.
 * Gasto = despesa em valores reais (corrigidos pelo IPCA); investido = soma do gasto real dos `h` anos seguintes ao início.
 * Só usa anos em que a fonte publicou gasto e indicador. É uma conta do Política, não prova causa e efeito.
 */
export function roiWindows(spend: Record<number, number>, ind: YearSeries, better: "up" | "down", h: number): RoiWindow[] {
  const out: RoiWindow[] = [];
  for (const a of Object.keys(ind).map(Number).sort((x, y) => x - y)) {
    const b = a + h;
    if (ind[b] == null || spend[a] == null || spend[b] == null) continue;
    let invested = 0;
    let ok = true;
    for (let y = a + 1; y <= b; y++) {
      if (spend[y] == null) { ok = false; break; }
      invested += spend[y];
    }
    if (!ok) continue;
    const delta = ind[b] - ind[a];
    const improvement = better === "up" ? delta : -delta;
    const spendChange = spend[a] ? (spend[b] - spend[a]) / spend[a] : null;
    const spendUp = spend[b] > spend[a];
    const kind: RoiWindow["kind"] = improvement === 0 || spend[b] === spend[a] ? "estavel" : spendUp ? (improvement > 0 ? "gasto-sobe-melhora" : "gasto-sobe-piora") : improvement > 0 ? "gasto-cai-melhora" : "gasto-cai-piora";
    out.push({ from: a, to: b, invested, spendFrom: spend[a], spendTo: spend[b], spendChange, indFrom: ind[a], indTo: ind[b], delta, improvement, costPerUnit: improvement > 0 ? invested / improvement : null, kind });
  }
  return out;
}

export function summarize(ws: RoiWindow[]) {
  const counts: Record<RoiWindow["kind"], number> = { "gasto-sobe-melhora": 0, "gasto-sobe-piora": 0, "gasto-cai-melhora": 0, "gasto-cai-piora": 0, estavel: 0 };
  for (const w of ws) counts[w.kind]++;
  const improved = ws.filter((w) => w.improvement > 0).length;
  return { n: ws.length, counts, improved };
}
