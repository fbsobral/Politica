"use client";

import Link from "next/link";
import { useState } from "react";

type Detail = { desc: string; source: string; sourceUrl: string | null; series: Record<string, number> };

/** Botão que abre, sob demanda, a explicação e o gráfico do indicador — sem sair da página nem pesar o carregamento inicial. */
export function ScoreItemPeek({ id, scope, name, targetText, valueLabels, cols }: { id: string; scope: string; name: string; targetText: string; valueLabels: Record<number, string>; cols: number }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [d, setD] = useState<Detail | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && state === "idle") {
      setState("loading");
      try {
        const res = await fetch(`/api/indicador/${id}?scope=${scope}`);
        if (!res.ok) throw new Error(String(res.status));
        setD((await res.json()) as Detail);
        setState("ok");
      } catch {
        setState("error");
      }
    }
  };

  return (
    <>
      <button type="button" aria-expanded={open} onClick={toggle} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
        <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        {open ? "Ocultar detalhes" : "Ver detalhes do indicador"}
        {state === "loading" && <span className="ml-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-label="Carregando" />}
      </button>
      {open && (
        <div data-peek-cols={cols} className="peek-panel mt-2 rounded-xl border border-line bg-paper p-3 text-xs leading-relaxed" role="region" aria-label={`Detalhes de ${name}`}>
          {state === "loading" && <p className="text-muted">Carregando…</p>}
          {state === "error" && <p className="text-muted">Não foi possível carregar agora. Tente de novo em instantes.</p>}
          {state === "ok" && d && (
            <div className="space-y-2">
              <p>{d.desc}</p>
              <p className="text-muted">Fonte: {d.sourceUrl ? <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="underline">{d.source}</a> : d.source}</p>
              <p>{targetText}</p>
              <MiniChart series={d.series} labels={valueLabels} />
              <Link href={`/indicadores?esfera=${scope.toLowerCase()}`} className="inline-block font-semibold text-brand hover:underline">Abrir na aba Indicadores →</Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function MiniChart({ series, labels }: { series: Record<string, number>; labels: Record<number, string> }) {
  const pts = Object.entries(series).map(([y, v]) => ({ y: Number(y), v })).sort((a, b) => a.y - b.y);
  if (pts.length < 2) return <p className="text-muted">Sem série suficiente para o gráfico.</p>;
  const W = 520, H = 120, pad = 14;
  const lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  const sx = (i: number) => pad + (i / (pts.length - 1)) * (W - 2 * pad);
  const sy = (v: number) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - 2 * pad);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)} ${sy(p.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full" role="img" aria-label="Evolução do indicador">
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={p.y} cx={sx(i)} cy={sy(p.v)} r="2.5" fill="var(--brand)"><title>{p.y}: {labels[p.y] ?? p.v}</title></circle>)}
      <text x={pad} y={H + 11} fontSize="9" fill="currentColor" opacity="0.6">{pts[0].y}</text>
      <text x={W - pad} y={H + 11} fontSize="9" textAnchor="end" fill="currentColor" opacity="0.6">{pts[pts.length - 1].y} · {labels[pts[pts.length - 1].y] ?? ""}</text>
    </svg>
  );
}
