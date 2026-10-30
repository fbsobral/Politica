/** Gasto (barras, em R$ reais) e indicador (linha) no mesmo gráfico, para ver os dois ao longo dos anos. Sem estado: renderiza no servidor. */
export type RoiPoint = { year: number; spend: number | null; spendLabel: string; ind: number | null; indLabel: string };

export function RoiChart({ points, indName, color }: { points: RoiPoint[]; indName: string; color: string }) {
  const n = points.length;
  const maxSpend = Math.max(...points.map((p) => p.spend ?? 0), 1);
  const iv = points.map((p) => p.ind).filter((v): v is number => v != null);
  const lo = Math.min(...iv), hi = Math.max(...iv);
  const pad = (hi - lo || 1) * 0.15;
  const yInd = (v: number) => 100 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100;
  const xc = (i: number) => ((i + 0.5) / n) * 100;
  const path = points.reduce((d, p, i) => (p.ind == null ? d + "|" : d + `${d.endsWith("|") || d === "" ? "M" : "L"}${xc(i).toFixed(2)} ${yInd(p.ind).toFixed(2)} `), "").split("|").filter(Boolean).join(" ");
  return (
    <div>
      <div className="relative h-56 sm:h-64">
        <div className="absolute inset-0 flex items-end gap-1 sm:gap-2">
          {points.map((p) => (
            <div key={p.year} className="flex h-full flex-1 items-end justify-center" title={`${p.year}: gasto ${p.spendLabel}`}>
              {p.spend != null && <div className="w-full max-w-14 rounded-t-md bg-ink/15" style={{ height: `${(p.spend / maxSpend) * 100}%` }} />}
            </div>
          ))}
        </div>
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path d={path} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {points.map((p, i) => p.ind != null && (
          <div key={p.year} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${xc(i)}%`, top: `${yInd(p.ind)}%` }}>
            <span className="block h-2.5 w-2.5 rounded-full border-2 border-surface" style={{ background: color }} />
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums">{p.indLabel}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 sm:gap-2">
        {points.map((p) => <div key={p.year} className="flex-1 text-center text-[11px] text-muted tabular-nums">{p.year}</div>)}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-ink/15" /> Gasto real (barras, valores do último ano)</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: color }} /> {indName} (linha, valor publicado)</span>
      </div>
    </div>
  );
}
