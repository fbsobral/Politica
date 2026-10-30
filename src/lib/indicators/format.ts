export type Unit = "pct" | "brl" | "usd" | "count" | "rate" | "index" | "years" | "num";

const nf = (n: number, d: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Número grande abreviado (mil, mi, bi, tri). */
function short(n: number, d = 1): string {
  const a = Math.abs(n);
  if (a >= 1e12) return `${nf(n / 1e12, d)} tri`;
  if (a >= 1e9) return `${nf(n / 1e9, d)} bi`;
  if (a >= 1e6) return `${nf(n / 1e6, d)} mi`;
  if (a >= 1e4) return `${nf(n / 1e3, 0)} mil`;
  return nf(n, a < 100 ? d : 0);
}

export function formatValue(v: number, unit: Unit, decimals = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  switch (unit) {
    case "pct": return `${nf(v, decimals)}%`;
    case "brl": return `R$ ${short(v)}`;
    case "usd": return `US$ ${short(v)}`;
    case "rate": return nf(v, decimals);
    case "index": return nf(v, decimals === 1 ? 3 : decimals);
    case "years": return `${nf(v, decimals)} anos`;
    case "count": return short(v, 0);
    default: return nf(v, decimals);
  }
}

/** Variação entre dois valores: em pontos percentuais para taxas (%), senão percentual relativo. */
export function formatChange(a: number, b: number, unit: Unit): string | null {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (unit === "pct" || unit === "rate" || unit === "index" || unit === "years") {
    const d = b - a;
    const abs = Math.abs(d);
    const txt = nf(abs, unit === "index" ? 3 : 1);
    return `${d >= 0 ? "+" : "−"}${txt}${unit === "pct" ? " p.p." : ""}`;
  }
  if (a === 0) return null;
  const r = (b / a - 1) * 100;
  return `${r >= 0 ? "+" : "−"}${nf(Math.abs(r), 0)}%`;
}
