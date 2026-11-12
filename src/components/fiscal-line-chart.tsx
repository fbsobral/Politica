"use client";

import { useEffect, useRef, useState } from "react";
import { AskButton } from "@/components/agent/ask-button";
import { pib12Label, pibYtdLabel } from "@/lib/pib-pct";

export type FPoint = { year: number; period: number; revenue: number; expense: number; balance: number; primary: number | null; pibPct: number | null; pibPctYtd?: number | null };

type Key = "revenue" | "expense" | "balance" | "primary" | "pibPct";
const LINES: { key: Key; label: string; color: string }[] = [
  { key: "revenue", label: "Receita", color: "#0e8a5f" },
  { key: "expense", label: "Despesa (empenhada)", color: "#d9480f" },
  { key: "balance", label: "Saldo do orçamento", color: "#2563eb" },
  { key: "primary", label: "Resultado primário", color: "#7c3aed" },
  { key: "pibPct", label: "Resultado primário em % do PIB (eixo da direita)", color: "#c026d3" },
];
const RANGES = [1, 2, 5, 10, 20, 30] as const;
const MONTH = ["", "fevereiro", "abril", "junho", "agosto", "outubro", "dezembro"];
const H = 320, PL = 64, PR = 58, PT = 16, PB = 34;

const pctFmt = (v: number) => `${v < 0 ? "−" : v > 0 ? "+" : ""}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;

const brl = (v: number) => {
  const a = Math.abs(v);
  const f = (n: number, u: string) => `${v < 0 ? "−" : ""}R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: n >= 100 ? 0 : n >= 10 ? 1 : 2 })} ${u}`;
  if (a >= 1e12) return f(a / 1e12, "tri");
  if (a >= 1e9) return f(a / 1e9, "bi");
  if (a >= 1e6) return f(a / 1e6, "mi");
  if (a >= 1e3) return f(a / 1e3, "mil");
  return `${v < 0 ? "−" : ""}R$ ${Math.round(a).toLocaleString("pt-BR")}`;
};

/** Gráfico de linhas das quatro caixas: de 1 a 30 anos, com cada linha podendo ser exibida ou ocultada; o % do PIB usa o eixo da direita. */
export function FiscalLineChart({ annual, bimesters, currentYear, currentPeriod, firstYear, entity, pibSource }: { annual: FPoint[]; bimesters: FPoint[]; currentYear: number; currentPeriod: number; firstYear: number | null; entity: string; pibSource: { code: number; perimeter: string } }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(10);
  const [on, setOn] = useState<Set<Key>>(new Set(LINES.map((l) => l.key)));
  const [own, setOwn] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(320, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(320, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const byBim = range <= 2;
  const pts: FPoint[] = byBim ? bimesters.filter((p) => (range === 1 ? p.year === currentYear : true)) : annual.slice(-range);
  const short = byBim ? false : annual.length < range;
  const visible = LINES.filter((l) => on.has(l.key));
  // gráfico bimestral: tudo é "acumulado no ano", então o % do PIB também (se houver); a partir de 5 anos, acumulado em 12 meses
  // gráfico anual: anos fechados usam o acumulado de janeiro a dezembro (igual ao de 12 meses em dezembro) e o ano corrente usa janeiro até o último bimestre
  const ytdPoint = (p: FPoint) => byBim || p.period < 6;
  const val = (p: FPoint, k: Key) => (k === "primary" ? p.primary : k === "pibPct" ? (ytdPoint(p) && p.pibPctYtd != null ? p.pibPctYtd : p.pibPct) : p[k]);
  const toggle = (k: Key) => setOn((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  // escala: valores em R$ (eixo da esquerda) e % do PIB (eixo da direita), ou cada linha na sua própria faixa
  const ext = (k: Key) => {
    const v = pts.map((p) => val(p, k)).filter((x): x is number => x !== null);
    return v.length ? { lo: Math.min(...v), hi: Math.max(...v) } : { lo: 0, hi: 1 };
  };
  const left = visible.filter((l) => l.key !== "pibPct");
  const hasRight = !own && visible.some((l) => l.key === "pibPct");
  const all = left.flatMap((l) => pts.map((p) => val(p, l.key)).filter((x): x is number => x !== null));
  const gLo = Math.min(0, ...(all.length ? all : [0])), gHi = Math.max(0, ...(all.length ? all : [1]));
  const pad = (gHi - gLo || 1) * 0.08;
  const yMin = gLo - (gLo < 0 ? pad : 0), yMax = gHi + pad;
  const n = pts.length;
  const step = n > 1 ? (w - PL - PR) / (n - 1) : 0;
  const x = (i: number) => (n > 1 ? PL + i * step : PL + (w - PL - PR) / 2);

  // eixo da direita: se o da esquerda tem valores positivos e negativos, o zero dos dois fica na mesma altura
  const rv = pts.map((p) => val(p, "pibPct")).filter((x): x is number => x !== null);
  const rLo = Math.min(0, ...(rv.length ? rv : [0])), rHi = Math.max(0, ...(rv.length ? rv : [1]));
  const f0 = yMin < 0 && yMax > 0 ? -yMin / (yMax - yMin) : null;
  let rMin = rLo - (rHi - rLo || 1) * 0.08 * (rLo < 0 ? 1 : 0), rMax = rHi + (rHi - rLo || 1) * 0.08;
  if (f0 !== null) {
    const R = Math.max(rHi > 0 ? (rHi * 1.08) / (1 - f0) : 0, rLo < 0 ? (-rLo * 1.08) / f0 : 0, 0.5);
    rMin = -R * f0;
    rMax = R * (1 - f0);
  }
  const yv = (k: Key, v: number) => {
    if (own) { const { lo, hi } = ext(k); return PT + (H - PT - PB) * (1 - (hi === lo ? 0.5 : (v - lo) / (hi - lo))); }
    if (k === "pibPct") return PT + (H - PT - PB) * (1 - (v - rMin) / (rMax - rMin || 1));
    return PT + (H - PT - PB) * (1 - (v - yMin) / (yMax - yMin || 1));
  };
  const path = (k: Key) => {
    let d = "", pen = false;
    pts.forEach((p, i) => {
      const v = val(p, k);
      // a linha bimestral recomeça em janeiro: não liga dezembro ao 1º bimestre
      const newYear = byBim && i > 0 && pts[i - 1].year !== p.year;
      if (v === null || newYear) pen = false;
      if (v === null) return;
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${yv(k, v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  const label = (p: FPoint) => (byBim ? `${p.period}º bim/${String(p.year).slice(2)}` : p.period < 6 ? `${p.year}*` : String(p.year));
  const ticks = own ? [] : [yMin, (yMin + yMax) / 2, yMax].map((t) => Math.round(t));
  const zeroY = !own && yMin < 0 && yMax > 0 ? PT + (H - PT - PB) * (1 - (0 - yMin) / (yMax - yMin)) : null;
  const hp = hover !== null ? pts[hover] : null;

  const summary = `Evolução de ${entity}: ${pts.length ? `${label(pts[0])} a ${label(pts[pts.length - 1])}` : "sem dados"}. ${visible.map((l) => `${l.label}: ${pts.map((p) => { const v = val(p, l.key); return `${label(p)} ${v === null ? "—" : l.key === "pibPct" ? pctFmt(v) : brl(v)}`; }).join("; ")}`).join(" | ")}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Período" className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-line bg-surface p-1 shadow-card">
          {RANGES.map((r) => (
            <button key={r} type="button" role="tab" aria-selected={range === r} onClick={() => { setRange(r); setHover(null); }} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${range === r ? "bg-ink text-paper" : "text-muted hover:bg-ink/5 hover:text-ink"}`}>
              {r} {r === 1 ? "ano" : "anos"}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Escala" className="inline-flex items-center gap-1 rounded-2xl border border-line bg-surface p-1 text-sm">
          <button type="button" aria-pressed={!own} onClick={() => setOwn(false)} className={`rounded-xl px-3 py-1.5 font-semibold ${!own ? "bg-ink text-paper" : "text-muted hover:bg-ink/5"}`} title="Valores em reais no eixo da esquerda e % do PIB no eixo da direita">Valores em R$</button>
          <button type="button" aria-pressed={own} onClick={() => setOwn(true)} className={`rounded-xl px-3 py-1.5 font-semibold ${own ? "bg-ink text-paper" : "text-muted hover:bg-ink/5"}`} title="Cada linha usa a própria faixa (menor a maior valor): bom para comparar o formato">Formato de cada linha</button>
        </div>
        <AskButton label="Perguntar sobre o gráfico" focus={{ title: `Evolução fiscal · ${entity}`, text: `Gráfico de ${byBim ? "bimestres (acumulado no ano)" : "anos"}: ${summary}. Fonte: RREO do Tesouro Nacional (Siconfi). Receita realizada, despesa empenhada, saldo = receita menos despesa e resultado primário do Anexo 6. O percentual do PIB é o resultado primário acumulado em 12 meses (Banco Central, SGS ${pibSource.code}: ${pibSource.perimeter}). Os pontos com * são do ano corrente até o último bimestre publicado.`, suggestions: ["O que o gráfico mostra?", "Por que o resultado primário mudou nesses anos?", "O saldo negativo é um problema?"] }} />
      </div>

      <div ref={ref} className="relative w-full">
        {n === 0 ? <p className="py-10 text-center text-sm text-muted">Sem dados para este período.</p> : (
          <svg width={w} height={H} role="img" aria-label={summary} onMouseLeave={() => setHover(null)} onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.min(n - 1, Math.max(0, n > 1 ? Math.round((e.clientX - r.left - PL) / step) : 0))); }}>
            {ticks.map((t, i) => (
              <g key={i}>
                <line x1={PL} x2={w - PR} y1={yv("revenue", t)} y2={yv("revenue", t)} stroke="currentColor" strokeOpacity="0.1" />
                <text x={PL - 6} y={yv("revenue", t) + 3} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">{brl(t)}</text>
              </g>
            ))}
            {own && [0, 0.5, 1].map((f) => <line key={f} x1={PL} x2={w - PR} y1={PT + (H - PT - PB) * f} y2={PT + (H - PT - PB) * f} stroke="currentColor" strokeOpacity="0.08" />)}
            {hasRight && [rMin, (rMin + rMax) / 2, rMax].map((t, i) => (
              <text key={`r${i}`} x={w - PR + 6} y={yv("pibPct", t) + 3} textAnchor="start" fontSize="10" fill="#c026d3">{pctFmt(Math.round(t * 10) / 10)}</text>
            ))}
            {zeroY !== null && <line x1={PL} x2={w - PR} y1={zeroY} y2={zeroY} stroke="currentColor" strokeOpacity="0.45" strokeDasharray="4 4" />}
            {zeroY !== null && <text x={w - PR - 4} y={zeroY - 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.6">zero</text>}
            {byBim && pts.map((p, i) => i > 0 && pts[i - 1].year !== p.year && <line key={`d${i}`} x1={(x(i - 1) + x(i)) / 2} x2={(x(i - 1) + x(i)) / 2} y1={PT} y2={H - PB} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="2 4" />)}
            {pts.map((p, i) => (n <= 14 || i % Math.ceil(n / 12) === 0) && <text key={`${p.year}-${p.period}`} x={x(i)} y={H - 12} textAnchor="middle" fontSize="10.5" fill="currentColor" opacity="0.7">{label(p)}</text>)}
            {visible.map((l) => (
              <g key={l.key}>
                <path d={path(l.key)} fill="none" stroke={l.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={l.key === "pibPct" ? "6 4" : undefined} />
                {pts.map((p, i) => { const v = val(p, l.key); if (v === null) return null; const partial = !byBim && p.period < 6; return <circle key={i} cx={x(i)} cy={yv(l.key, v)} r={3.2} fill={partial ? "var(--surface)" : l.color} stroke={l.color} strokeWidth={partial ? 2 : 0} />; })}
              </g>
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="currentColor" strokeOpacity="0.35" />}
          </svg>
        )}
        {hp && (
          <div className="pointer-events-none absolute top-2 z-10 w-72 rounded-xl border border-line bg-surface p-2.5 text-xs shadow-pop" style={{ left: Math.min(Math.max(x(hover!) + 12, 0), w - 296) }}>
            <p className="mb-1 font-semibold">{byBim ? `${hp.period}º bimestre de ${hp.year} (até ${MONTH[hp.period]})` : hp.period < 6 ? `${hp.year} até ${MONTH[hp.period]} (parcial)` : `${hp.year} (ano fechado)`}</p>
            {visible.map((l) => { const v = val(hp, l.key); return (
              <p key={l.key} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.color }} /><span className="truncate">{l.key === "pibPct" ? `${hp.period === 6 || (ytdPoint(hp) && hp.pibPctYtd != null) ? pibYtdLabel(hp.period * 2) : pib12Label(hp.period * 2)} · BC` : l.label}</span></span>
                <b className="shrink-0 tabular-nums">{v === null ? "—" : l.key === "pibPct" ? pctFmt(v) : brl(v)}</b>
              </p>
            ); })}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Linhas exibidas">
        {LINES.map((l) => {
          const active = on.has(l.key);
          return (
            <button key={l.key} type="button" aria-pressed={active} onClick={() => toggle(l.key)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${active ? "border-ink/40 bg-ink/5" : "border-line text-muted hover:bg-ink/5"}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: active ? l.color : "transparent", border: `2px solid ${l.color}` }} />
              {l.label}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-faint">
        {byBim
          ? "Cada ponto é o acumulado do ano até o bimestre (por isso a linha recomeça em janeiro). "
          : `Um ponto por ano: anos fechados (6º bimestre) e, no último ponto, ${currentYear} até ${MONTH[currentPeriod]} (ponto vazado, com *). `}
        {short && firstYear ? `O RREO padronizado no Siconfi só existe desde ${firstYear}, então este período mostra tudo o que há (${annual.length} pontos). ` : ""}
        Fonte: RREO (Tesouro Nacional/Siconfi). Receita é a realizada; despesa, a empenhada; saldo = receita menos despesa; resultado primário em R$ vem do Anexo 6. O percentual do PIB (linha tracejada, eixo da direita) é sempre o acumulado no ano, a mesma janela das linhas em R$: de janeiro até o bimestre nos gráficos de 1 e 2 anos e no ano corrente, e de janeiro a dezembro nos anos fechados (que é igual ao acumulado em 12 meses de dezembro, publicado pelo Banco Central, SGS {pibSource.code}: {pibSource.perimeter}). No ano corrente da União, o cálculo soma o resultado mensal do Governo Federal e Banco Central (SGS 4639) e divide pelo PIB dos mesmos meses (SGS 4380). Positivo = superávit, negativo = déficit. {pibSource.code === 5786 ? "O Banco Central não publica o percentual por estado ou município, então a linha mostra todos juntos." : ""}
      </p>
    </div>
  );
}
