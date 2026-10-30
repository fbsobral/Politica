"use client";

import { useEffect, useRef, useState } from "react";

export type LineSeries = { id: string; label: string; color: string; kind: "total" | "economia" | "social" | "item"; values: Record<number, number | null> };
export type BandTerm = { id: string; name: string; from: number; to: number; color: string };

const H = 300, PL = 34, PR = 14, PT = 16, PB = 28;

/** Gráfico de linhas do score: linha do score, uma do econômico, uma do social e, se quiser, uma por indicador escolhido. */
export function ScoreLineChart({ years, lines, terms }: { years: number[]; lines: LineSeries[]; terms: BandTerm[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [on, setOn] = useState<Set<string>>(new Set(["total"]));
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => setW(Math.max(320, ref.current?.clientWidth ?? 720)));
    ro.observe(ref.current);
    setW(Math.max(320, ref.current.clientWidth));
    return () => ro.disconnect();
  }, []);

  const n = years.length;
  const step = n > 1 ? (w - PL - PR) / (n - 1) : 0;
  const x = (i: number) => PL + i * step;
  const y = (v: number) => PT + (H - PT - PB) * (1 - v / 100);
  const visible = lines.filter((l) => on.has(l.id));
  const toggle = (id: string) => setOn((s) => { const t = new Set(s); if (t.has(id)) t.delete(id); else t.add(id); return t; });

  const path = (l: LineSeries) => {
    let d = "";
    let pen = false;
    years.forEach((yr, i) => {
      const v = l.values[yr];
      if (v == null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  const termOf = (yr: number) => terms.find((t) => yr >= t.from && yr <= t.to);
  const hoverYear = hover != null ? years[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Linhas exibidas">
        {lines.map((l) => {
          const active = on.has(l.id);
          return (
            <button key={l.id} type="button" aria-pressed={active} onClick={() => toggle(l.id)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${active ? "border-ink/40 bg-ink/5" : "border-line text-muted hover:bg-ink/5"} ${l.kind === "item" ? "" : "text-[13px]"}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: active ? l.color : "transparent", border: `2px solid ${l.color}` }} />
              {l.label}
            </button>
          );
        })}
      </div>
      <div ref={ref} className="relative w-full">
        <svg width={w} height={H} role="img" aria-label="Gráfico de linhas do score ao longo dos anos" onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.round((e.clientX - r.left - PL) / (step || 1)); setHover(Math.min(n - 1, Math.max(0, i))); }}>
          {terms.map((t) => {
            const idx = years.map((yr, i) => (yr >= t.from && yr <= t.to ? i : -1)).filter((i) => i >= 0);
            if (!idx.length) return null;
            const x1 = Math.max(PL, x(idx[0]) - step / 2), x2 = Math.min(w - PR, x(idx[idx.length - 1]) + step / 2);
            return (
              <g key={t.id}>
                <rect x={x1} y={PT} width={x2 - x1} height={H - PT - PB} fill={t.color} opacity="0.07" />
                {x2 - x1 > 50 && <text x={(x1 + x2) / 2} y={PT + 11} textAnchor="middle" fontSize="10" fontWeight="600" fill={t.color}>{t.name.split(" ").slice(-1)[0]}</text>}
              </g>
            );
          })}
          {[0, 25, 50, 75, 100].map((g) => (
            <g key={g}>
              <line x1={PL} x2={w - PR} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={g === 50 ? 0.4 : 0.1} strokeDasharray={g === 50 ? "4 4" : undefined} />
              <text x={PL - 5} y={y(g) + 3} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.55">{g}</text>
            </g>
          ))}
          {years.map((yr, i) => (i % Math.ceil(n / 12) === 0 || n <= 12) && <text key={yr} x={x(i)} y={H - 9} textAnchor="middle" fontSize="10.5" fill="currentColor" opacity="0.7">{yr}</text>)}
          {visible.map((l) => (
            <g key={l.id}>
              <path d={path(l)} fill="none" stroke={l.color} strokeWidth={l.kind === "item" ? 1.5 : l.kind === "total" ? 3.2 : 2.4} strokeLinejoin="round" strokeLinecap="round" opacity={l.kind === "item" ? 0.85 : 1} strokeDasharray={l.kind === "item" ? "5 3" : undefined} />
              {years.map((yr, i) => l.values[yr] != null && <circle key={yr} cx={x(i)} cy={y(l.values[yr]!)} r={l.kind === "item" ? 2.5 : l.kind === "total" ? 4 : 3.2} fill={l.color} />)}
            </g>
          ))}
          {visible.find((l) => l.kind === "total") && n <= 12 && years.map((yr, i) => { const v = visible.find((l) => l.kind === "total")!.values[yr]; return v != null && <text key={yr} x={x(i)} y={y(v) - 9} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="currentColor">{Math.round(v)}</text>; })}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="currentColor" strokeOpacity="0.35" />}
        </svg>
        {hover != null && hoverYear != null && (
          <div className="pointer-events-none absolute top-2 z-10 w-56 rounded-xl border border-line bg-surface p-2.5 text-xs shadow-card" style={{ left: Math.min(Math.max(x(hover) + 12, 0), w - 230) }}>
            <p className="mb-1 font-semibold">{hoverYear}{termOf(hoverYear) ? ` · ${termOf(hoverYear)!.name}` : ""}</p>
            {visible.map((l) => (
              <p key={l.id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.color }} /><span className="truncate">{l.label}</span></span>
                <b className="tabular-nums">{l.values[hoverYear] == null ? "—" : Math.round(l.values[hoverYear]!)}</b>
              </p>
            ))}
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-faint">Notas de 0 a 100. A linha tracejada em 50 é a melhora típica; as faixas coloridas são os governos. Lacunas na linha são anos sem nota. Por padrão só o score aparece: toque nos botões acima para mostrar o lado econômico, o social ou cada indicador.</p>
    </div>
  );
}
