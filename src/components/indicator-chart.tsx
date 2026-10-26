"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatChange, formatValue, type Unit } from "@/lib/indicators/format";

export type ChartSeries = { name: string; color: string; values: Record<number, number> };

const H = 165;
const M = { l: 28, r: 28, t: 40, b: 22 };

/** Linha(s) por ano, sem eixos pesados: bom para cartões; passa o mouse (ou toca) para ver o valor de cada ano. */
export function IndicatorChart({ series, unit, decimals = 1, height = H, better, changeLabels, changeNote }: { series: ChartSeries[]; unit: Unit; decimals?: number; height?: number; better?: "up" | "down"; changeLabels?: Record<number, number>; changeNote?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  // a largura do desenho acompanha a do cartão, então o texto não encolhe e a altura fica fixa e baixa
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, Math.round(el.clientWidth))));
    ro.observe(el);
    setW(Math.max(260, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);
  // eixo com todos os anos do intervalo, mesmo os sem dado (a linha só liga os pontos que existem)
  const years = useMemo(() => {
    const ys = series.flatMap((s) => Object.keys(s.values).map(Number));
    if (!ys.length) return [] as number[];
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }, [series]);
  const all = series.flatMap((s) => Object.values(s.values));
  if (years.length < 2 || !all.length) return <p className="py-8 text-center text-sm text-muted">Sem série suficiente para desenhar.</p>;
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.12;
  min -= pad;
  max += pad;
  if (min < 0 && Math.min(...all) >= 0) min = 0;
  const x = (y: number) => M.l + ((y - years[0]) / (years[years.length - 1] - years[0])) * (W - M.l - M.r);
  const yv = (v: number) => M.t + (1 - (v - min) / (max - min)) * (height - M.t - M.b);
  const hy = hover !== null ? years[hover] : null;
  return (
    <div ref={box} className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} className="block w-full" role="img" aria-label="Evolução ao longo dos anos" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((t) => <line key={t} x1={M.l} x2={W - M.r} y1={M.t + t * (height - M.t - M.b)} y2={M.t + t * (height - M.t - M.b)} stroke="var(--line)" strokeDasharray={t === 1 ? undefined : "3 4"} />)}
        {years.map((yr) => (
          <text key={yr} x={x(yr)} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--faint)">{W < 420 ? `’${String(yr).slice(2)}` : yr}</text>
        ))}
        {hy !== null && <line x1={x(hy)} x2={x(hy)} y1={M.t} y2={height - M.b} stroke="var(--line-strong)" />}
        {series.map((s) => {
          const pts = years.filter((yr) => s.values[yr] !== undefined).map((yr) => `${x(yr)},${yv(s.values[yr])}`);
          return (
            <g key={s.name}>
              <polyline points={pts.join(" ")} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              {years.filter((yr) => s.values[yr] !== undefined).map((yr) => <circle key={yr} cx={x(yr)} cy={yv(s.values[yr])} r={hy === yr ? 4.5 : 2.4} fill="var(--surface)" stroke={s.color} strokeWidth="1.8" />)}
              {series.length === 1 && years.filter((yr) => s.values[yr] !== undefined).map((yr, i, arr) => (
                <g key={`l${yr}`}>
                  <text x={x(yr)} y={yv(s.values[yr]) - 8} textAnchor={i === 0 ? "start" : i === arr.length - 1 ? "end" : "middle"} fontSize="10" fontWeight="600" fill="var(--ink)" stroke="var(--surface)" strokeWidth="3" paintOrder="stroke">{formatValue(s.values[yr], unit, decimals)}</text>
                  {(i > 0 || changeLabels) && (() => {
                    const cur = s.values[yr];
                    const prev = i > 0 ? s.values[arr[i - 1]] : cur;
                    // quando há um indicador oficial de variação (ex.: crescimento real do PIB), ele substitui a conta simples entre os dois valores
                    const official = changeLabels?.[yr];
                    if (changeLabels && official === undefined) return null;
                    const txt = official !== undefined ? `${official > 0 ? "+" : official < 0 ? "−" : ""}${Math.abs(official).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : periodChange(prev, cur, unit);
                    if (!txt) return null;
                    const ref = official !== undefined ? official : cur - prev;
                    const color = !better || ref === 0 ? "var(--muted)" : (ref > 0) === (better === "up") ? "var(--ok)" : "var(--danger)";
                    return <text x={x(yr)} y={yv(s.values[yr]) - 20} textAnchor={i === arr.length - 1 ? "end" : "middle"} fontSize="9.5" fontWeight="700" fill={color} stroke="var(--surface)" strokeWidth="3" paintOrder="stroke">{txt}</text>;
                  })()}
                </g>
              ))}
            </g>
          );
        })}
        {years.map((yr, i) => <rect key={yr} x={x(yr) - (W - M.l - M.r) / (years.length - 1) / 2} y={0} width={(W - M.l - M.r) / (years.length - 1)} height={height} fill="transparent" onMouseEnter={() => setHover(i)} onMouseMove={() => setHover(i)} onClick={() => setHover(i)} />)}
      </svg>
      {changeNote && <p className="mt-1 text-[11px] text-faint">{changeNote}</p>}
      {!changeNote && series.length === 1 && (unit === "brl" || unit === "usd") && (
        <p className="mt-1 text-[11px] text-faint">As variações acima de cada valor são em valores correntes do ano, ou seja, incluem a inflação. Elas não são o crescimento real.</p>
      )}
      {hy !== null && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-line bg-surface/95 px-2.5 py-1.5 text-xs shadow-pop"
          style={(() => {
            // o balão acompanha o ponto: fica logo acima dele (e dos rótulos), sem sair das bordas do gráfico
            const px = x(hy);
            const ys = series.filter((s) => s.values[hy] !== undefined).map((s) => yv(s.values[hy]));
            const top = Math.max(0, (ys.length ? Math.min(...ys) : M.t) - 58 - series.length * 16);
            const tx = px < 80 ? "0%" : px > W - 80 ? "-100%" : "-50%";
            return { left: px, top, transform: `translateX(${tx})` };
          })()}
        >
          <b>{hy}</b>
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{series.length > 1 && <span className="text-muted">{s.name}:</span>}<b>{s.values[hy] !== undefined ? formatValue(s.values[hy], unit, decimals) : "—"}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Variação em relação ao período anterior: pontos percentuais para taxas em %, percentual relativo para o resto. */
function periodChange(prev: number, cur: number, unit: Unit): string | null {
  const nf = (n: number, d: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  if (unit === "pct") {
    const d = cur - prev;
    return `${d > 0 ? "+" : d < 0 ? "−" : ""}${nf(Math.abs(d), 1)} p.p.`;
  }
  if (!prev) return null;
  const r = (cur / prev - 1) * 100;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${nf(Math.abs(r), Math.abs(r) < 10 ? 1 : 0)}%`;
}

export function delta(values: Record<number, number>, unit: Unit): { from: number; to: number; text: string } | null {
  const ys = Object.keys(values).map(Number).sort((a, b) => a - b);
  if (ys.length < 2) return null;
  const text = formatChange(values[ys[0]], values[ys[ys.length - 1]], unit);
  return text ? { from: ys[0], to: ys[ys.length - 1], text } : null;
}
