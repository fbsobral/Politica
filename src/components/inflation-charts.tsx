"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Band, FocusYear, Pillar } from "@/lib/inflation";
import { ControlBar, Segmented } from "@/components/controls";
import { presidentAt, presidentSpans } from "@/lib/presidents";

const MES = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const p2 = (v: number, d = 2) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
const pp = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`;

type St = "dentro" | "acima" | "abaixo";
const statusOf = (v: number, b: Band): St => (v > b.center + b.tol ? "acima" : v < b.center - b.tol ? "abaixo" : "dentro");

export function StatusChip({ v, band, compact }: { v: number | null; band: Band; compact?: boolean }) {
  if (v === null) return <span className="text-xs text-faint">—</span>;
  const s = statusOf(v, band);
  const cls = s === "dentro" ? "text-ok" : "text-danger";
  const icon = s === "dentro" ? "✓" : s === "acima" ? "▲" : "▼";
  const text = s === "dentro" ? "Dentro da meta" : s === "acima" ? "Acima da meta" : "Abaixo da meta";
  return <span className={`whitespace-nowrap text-[11px] font-bold ${cls}`}>{icon} {compact ? s : text}</span>;
}

/* ───────── Tendência: IPCA em 12 meses, banda da meta e expectativas do Focus ───────── */

export function InflationTrend({ series, bands, focus, selic }: { series: { year: number; month: number; v: number }[]; bands: Record<number, Band>; focus: FocusYear[]; selic: { year: number; month: number; v: number }[] }) {
  const [years, setYears] = useState(5);
  const [show, setShow] = useState<Set<"ipca" | "selic" | "real">>(new Set(["ipca", "selic"]));
  const flip = (k: "ipca" | "selic" | "real") => setShow((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const [hover, setHover] = useState<number | null>(null);
  // o SVG acompanha a largura real, para os textos não encolherem no celular
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(860);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const last = series[series.length - 1];
  const pts = useMemo(() => (last ? series.filter((p) => (last.year - p.year) * 12 + (last.month - p.month) < years * 12) : []), [series, years, last]);
  if (!last || !pts.length) return <p className="py-16 text-center text-sm text-muted">Série do IPCA indisponível agora.</p>;

  // Selic e juro real alinhados aos meses do gráfico; juro real = (1 + Selic) ÷ (1 + IPCA em 12 meses) − 1, ex-post
  const selicBy = new Map(selic.map((s) => [`${s.year}-${s.month}`, s.v]));
  const selicPts = pts.map((p) => selicBy.get(`${p.year}-${p.month}`) ?? null);
  const realPts = pts.map((p, i) => (selicPts[i] === null ? null : ((1 + selicPts[i]! / 100) / (1 + p.v / 100) - 1) * 100));
  const hasSelic = selicPts.some((v) => v !== null);
  const fut = focus.filter((f) => f.year >= last.year && f.year <= last.year + 2);
  const idx = (y: number, m: number) => (y - pts[0].year) * 12 + (m - pts[0].month);
  const endIdx = Math.max(idx(last.year, last.month), ...fut.map((f) => idx(f.year, 12)));
  const allYears = [...new Set([...pts.map((p) => p.year), ...fut.map((f) => f.year)])].sort();
  const vals = [...(show.has("ipca") ? pts.map((p) => p.v) : []), ...(show.has("selic") ? selicPts.filter((v): v is number => v !== null) : []), ...(show.has("real") ? realPts.filter((v): v is number => v !== null) : []), ...fut.flatMap((f) => [f.median, f.max ?? f.median, f.min ?? f.median]), ...allYears.map((y) => (bands[y]?.center ?? 3) + (bands[y]?.tol ?? 1.5))];
  const top = Math.ceil(Math.max(...vals) + 0.5);
  const bot = Math.min(0, Math.floor(Math.min(...vals)));

  const H = W < 560 ? 260 : 320;
  const m = { l: 44, r: 16, t: 34, b: 30 };
  // meses do eixo (inclui os futuros das expectativas), para as faixas de presidente
  const presSpans = presidentSpans(Array.from({ length: endIdx + 1 }, (_, i) => {
    const t = pts[0].year * 12 + pts[0].month - 1 + i;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
  }));
  const x = (i: number) => m.l + (i / Math.max(1, endIdx)) * (W - m.l - m.r);
  const y = (v: number) => m.t + ((top - v) / (top - bot)) * (H - m.t - m.b);
  const step = top - bot > 10 ? 2 : 1;
  // largura de um ano no gráfico: com pouco espaço, os rótulos das expectativas ficam só na tabela
  const yearPx = (12 / Math.max(1, endIdx)) * (W - m.l - m.r);
  // rótulos de ano: no máximo ~11 no computador e ~5 no celular
  const yearEvery = Math.max(1, Math.ceil(allYears.length / (W < 560 ? 5 : 11)));
  // trechos contínuos (a linha quebra onde não há dado)
  const seg = (arr: (number | null)[]) => {
    const out: string[] = [];
    let cur: string[] = [];
    arr.forEach((v, i) => { if (v === null) { if (cur.length > 1) out.push(cur.join(" ")); cur = []; } else cur.push(`${x(i)},${y(v)}`); });
    if (cur.length > 1) out.push(cur.join(" "));
    return out;
  };
  const ticks: number[] = [];
  for (let t = bot; t <= top; t += step) ticks.push(t);
  const h = hover !== null ? pts[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
          {show.has("ipca") && <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 bg-brand" />IPCA em 12 meses</span>}
          {show.has("selic") && <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5" style={{ background: "#d9480f" }} />Selic (meta, % ao ano)</span>}
          {show.has("real") && <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 border-t-2 border-dashed" style={{ borderColor: "#7c3aed" }} />Juro real (Selic descontado o IPCA)</span>}
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-ok/15" style={{ boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--ok) 40%, transparent)" }} />Intervalo da meta</span>
          {fut.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-brand bg-surface" />Expectativa do mercado (Focus) para dezembro</span>}
        </div>
        <Segmented label="Período" value={String(years)} onChange={(v) => setYears(Number(v))} options={[{ v: "1", l: "1 ano" }, { v: "2", l: "2 anos" }, { v: "5", l: "5 anos" }, { v: "10", l: "10 anos" }, { v: "20", l: "20 anos" }, { v: "30", l: "30 anos" }]} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Linhas exibidas">
        {([["ipca", "IPCA em 12 meses", "var(--brand)", true], ["selic", "Selic (meta)", "#d9480f", hasSelic], ["real", "Juro real (cálculo do Política)", "#7c3aed", hasSelic]] as const).map(([k, label, color, ok]) => ok && (
          <button key={k} type="button" aria-pressed={show.has(k)} onClick={() => flip(k)} title={k === "real" ? "(1 + Selic) ÷ (1 + IPCA em 12 meses) − 1: quanto o juro rende acima da inflação. É um cálculo do Política, não um dado oficial." : undefined} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${show.has(k) ? "border-ink/40 bg-ink/5" : "border-line text-muted hover:bg-ink/5"}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: show.has(k) ? color : "transparent", border: `2px solid ${color}` }} />
            {label}
          </button>
        ))}
      </div>
      <div className="card relative p-3 sm:p-5">
        <div ref={box} className="w-full" />
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Inflação em 12 meses, intervalo da meta e expectativas" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--faint)">{t}%</text>
            </g>
          ))}
          {/* quem era o presidente: faixa no topo e fundo suave */}
          {presSpans.map(({ term, i0, i1 }, k) => {
            const xa = Math.max(m.l, x(i0 - 0.5)), xb = Math.min(W - m.r, x(i1 + 0.5));
            if (xb - xa < 1) return null;
            return (
              <g key={`${term.id}-${i0}`}>
                <rect x={xa} width={xb - xa} y={m.t} height={H - m.t - m.b} fill={term.color} fillOpacity="0.05" />
                <rect x={xa + (k ? 1 : 0)} width={Math.max(0, xb - xa - (k ? 1 : 0))} y={m.t - 9} height="4" rx="2" fill={term.color} fillOpacity="0.8" />
                {xb - xa > term.name.length * 6.2 + 6 && <text x={(xa + xb) / 2} y={m.t - 14} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={term.color}>{term.name}</text>}
              </g>
            );
          })}
          {/* banda da meta, ano a ano */}
          {allYears.map((yr) => {
            const b = bands[yr];
            if (!b) return null;
            const x0 = x(Math.max(0, idx(yr, 1) - 0.5));
            const x1 = x(Math.min(endIdx, idx(yr, 12) + 0.5));
            if (x1 <= x0) return null;
            return (
              <g key={yr}>
                <rect x={x0} width={x1 - x0} y={y(b.center + b.tol)} height={y(b.center - b.tol) - y(b.center + b.tol)} fill="var(--ok)" fillOpacity="0.1" />
                <line x1={x0} x2={x1} y1={y(b.center)} y2={y(b.center)} stroke="var(--ok)" strokeOpacity="0.5" strokeDasharray="4 4" />
                {(yr - allYears[0]) % yearEvery === 0 && <text x={Math.max(x0, m.l) + (x1 - Math.max(x0, m.l)) / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--faint)">{yr}</text>}
              </g>
            );
          })}
          {show.has("ipca") && (
            <>
              <polyline points={pts.map((p, i) => `${x(i)},${y(p.v)}`).join(" ")} fill="none" stroke="var(--brand)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(pts.length - 1)} cy={y(last.v)} r="4.5" fill="var(--brand)" stroke="var(--surface)" strokeWidth="2" />
              <text x={x(pts.length - 1) - 8} y={y(last.v) - 10} textAnchor="end" fontSize="12" fontWeight="700" fill="var(--ink)">{p2(last.v)}</text>
            </>
          )}
          {show.has("selic") && seg(selicPts).map((pl, k) => <polyline key={`s${k}`} points={pl} fill="none" stroke="#d9480f" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />)}
          {show.has("real") && seg(realPts).map((pl, k) => <polyline key={`r${k}`} points={pl} fill="none" stroke="#7c3aed" strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" strokeLinecap="round" />)}
          {/* expectativas */}
          {fut.map((f) => {
            const cx = x(idx(f.year, 12));
            return (
              <g key={f.year}>
                {f.min !== null && f.max !== null && <line x1={cx} x2={cx} y1={y(f.max)} y2={y(f.min)} stroke="var(--brand)" strokeOpacity="0.45" strokeWidth="2" />}
                <circle cx={cx} cy={y(f.median)} r="5" fill="var(--surface)" stroke="var(--brand)" strokeWidth="2.2" />
                {yearPx >= 36 && <text x={cx} y={y(f.min ?? f.median) + 15} textAnchor={cx > W - 40 ? "end" : "middle"} fontSize="11" fontWeight="600" fill="var(--muted)">{p2(f.median, 1)}</text>}
              </g>
            );
          })}
          {h && <line x1={x(hover!)} x2={x(hover!)} y1={m.t} y2={H - m.b} stroke="var(--line-strong)" />}
          {h && <circle cx={x(hover!)} cy={y(h.v)} r="4.5" fill="var(--brand)" stroke="var(--surface)" strokeWidth="2" />}
          {pts.map((p, i) => (
            <rect key={i} x={x(i) - (W - m.l - m.r) / endIdx / 2} width={(W - m.l - m.r) / endIdx} y={m.t} height={H - m.t - m.b} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
          ))}
        </svg>
        {h && (
          <div className="pointer-events-none absolute left-16 top-4 rounded-xl border border-line bg-surface/95 p-3 text-xs shadow-pop backdrop-blur">
            <p className="font-bold">{MES[h.month]}/{h.year}</p>
            {presidentAt(`${h.year}-${String(h.month).padStart(2, "0")}`) && <p className="text-muted">Presidente: {presidentAt(`${h.year}-${String(h.month).padStart(2, "0")}`)!.name}</p>}
            <p className="mt-1">IPCA em 12 meses: <b>{p2(h.v)}</b></p>
            {selicPts[hover!] !== null && <p>Selic (meta): <b>{p2(selicPts[hover!]!)}</b> ao ano</p>}
            {realPts[hover!] !== null && <p className="text-muted">Juro real: <b>{p2(realPts[hover!]!)}</b></p>}
            {bands[h.year] && <p className="text-muted">Meta: {p2(bands[h.year].center - bands[h.year].tol, 1)} a {p2(bands[h.year].center + bands[h.year].tol, 1)}</p>}
            {bands[h.year] && <p className="mt-0.5"><StatusChip v={h.v} band={bands[h.year]} /></p>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── Pilares ───────── */

type View = "groups" | "bc" | "cores";
const VIEW_LABEL: Record<View, string> = { groups: "Grupos do IPCA", bc: "Tipos de preço", cores: "Núcleos" };

function Spark({ h }: { h?: number[] }) {
  if (!h || h.length < 2) return null;
  const lo = Math.min(...h), hi = Math.max(...h);
  const pts = h.map((v, i) => `${(i / (h.length - 1)) * 56 + 2},${16 - ((v - lo) / (hi - lo || 1)) * 12}`).join(" ");
  return <svg viewBox="0 0 60 18" className="h-[18px] w-[60px] flex-none" aria-hidden="true"><polyline points={pts} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}

export function InflationPillars({ groups, bc, cores, intl, br, headline }: { groups: Pillar[]; bc: Pillar[]; cores: Pillar[]; intl: Band; br: Band; headline: number | null }) {
  const views = (["groups", "bc", "cores"] as View[]).filter((v) => ({ groups, bc, cores })[v].length);
  const [view, setView] = useState<View>(views[0] ?? "groups");
  const [ref, setRef] = useState<"intl" | "br">("intl");
  const [path, setPath] = useState<string[]>([]);
  const [sort, setSort] = useState<"weight" | "high" | "low">("weight");
  const band = ref === "intl" ? intl : br;

  const root = ({ groups, bc, cores })[view];
  const trail: Pillar[] = [];
  let items = root;
  for (const code of path) {
    const p = items.find((i) => i.code === code);
    if (!p?.children) break;
    trail.push(p);
    items = p.children;
  }
  const hasWeight = items.some((i) => i.weight != null);
  const rows = [...items].filter((i) => i.y12 !== null).sort((a, b) => (sort === "weight" && hasWeight ? (b.weight ?? 0) - (a.weight ?? 0) : sort === "low" ? (a.y12 ?? 0) - (b.y12 ?? 0) : (b.y12 ?? 0) - (a.y12 ?? 0)));
  const vals = rows.map((r) => r.y12 as number);
  const lo = Math.min(0, ...vals, band.center - band.tol);
  const hi = Math.max(...vals, band.center + band.tol, headline ?? 0) * 1.05;
  const X = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const counts = rows.reduce((a, r) => ({ ...a, [statusOf(r.y12!, band)]: (a[statusOf(r.y12!, band)] ?? 0) + 1 }), {} as Record<St, number>);
  const level = view === "groups" ? ["grupo", "subgrupo", "item"][trail.length] ?? "item" : "indicador";

  return (
    <div>
      <ControlBar
        summary={`Comparando com ${ref === "intl" ? "o padrão internacional (2%)" : `a meta do Brasil (${br.center.toLocaleString("pt-BR")}%)`} · ${sort === "weight" && hasWeight ? "maior peso" : sort === "low" ? "menor inflação" : "maior inflação"}`}
        primary={<Segmented label="Como dividir" value={view} onChange={(v) => { setView(v); setPath([]); }} options={views.map((v) => ({ v, l: VIEW_LABEL[v] }))} />}
      >
        <Segmented label="Comparar com" value={ref} onChange={setRef} options={[
          { v: "intl", l: "Padrão internacional (2%)", title: intl.source },
          { v: "br", l: `Meta do Brasil (${br.center.toLocaleString("pt-BR")}%)`, title: br.source },
        ]} />
        <label className="flex items-center gap-2 text-sm text-muted">
          Ordenar
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input !w-40 !py-1.5">
            {hasWeight && <option value="weight">Maior peso</option>}
            <option value="high">Maior inflação</option>
            <option value="low">Menor inflação</option>
          </select>
        </label>
      </ControlBar>

      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {trail.length ? (
          <>
            <button type="button" onClick={() => setPath([])} className="font-semibold text-brand underline-offset-4 hover:underline">← {VIEW_LABEL[view]}</button>
            {trail.map((t, i) => (
              <span key={t.code} className="flex items-center gap-2">
                <span className="text-faint">›</span>
                {i < trail.length - 1 ? <button type="button" onClick={() => setPath(path.slice(0, i + 1))} className="font-semibold text-brand hover:underline">{t.name}</button> : <b>{t.name}</b>}
              </span>
            ))}
            {trail[trail.length - 1].y12 !== null && <span className="text-xs text-muted">· {p2(trail[trail.length - 1].y12!)} em 12 meses</span>}
          </>
        ) : (
          <span className="text-xs text-muted">{view === "groups" ? "Toque num grupo para ver os subgrupos e os itens que o compõem." : view === "cores" ? "Núcleos tiram ou suavizam os preços mais voláteis para mostrar a tendência de fundo." : "O mesmo IPCA dividido pelo tipo de preço."}</span>
        )}
      </div>

      <p className="mb-3 text-xs text-muted">
        Comparando com <b className="text-ink">{band.label}</b>: <span className="text-ok">✓ {counts.dentro ?? 0} dentro</span> · <span className="text-danger">▲ {counts.acima ?? 0} acima</span> · <span className="text-danger">▼ {counts.abaixo ?? 0} abaixo</span>
      </p>

      <div className="card p-4 sm:p-5">
        <div className="relative">
          {/* faixa da meta e o zero, atrás das barras */}
          <div className="pointer-events-none absolute inset-y-0 left-[0.375rem] right-[0.375rem] sm:left-[14.625rem] sm:right-[10.125rem]" aria-hidden="true">
            <div className="absolute inset-y-0 bg-ok/10" style={{ left: `${X(band.center - band.tol)}%`, width: `${X(band.center + band.tol) - X(band.center - band.tol)}%`, boxShadow: "inset 1px 0 0 color-mix(in srgb, var(--ok) 35%, transparent), inset -1px 0 0 color-mix(in srgb, var(--ok) 35%, transparent)" }} />
            {lo < 0 && <div className="absolute inset-y-0 w-px bg-line-strong" style={{ left: `${X(0)}%` }} />}
            {headline !== null && <div className="absolute inset-y-0 w-0 border-l border-dashed border-ink/50" style={{ left: `${X(headline)}%` }} title="IPCA geral" />}
          </div>
          <ul className="relative space-y-1">
            {rows.map((r) => {
              const v = r.y12!;
              const kids = r.children?.length ?? 0;
              const Row = kids ? "button" : "div";
              const diff = r.prevY12 != null ? v - r.prevY12 : null;
              const f = r.focus?.[0];
              return (
                <li key={r.code}>
                  <Row
                    {...(kids ? { type: "button" as const, onClick: () => setPath([...path, r.code]), "aria-label": `${r.name}: ver ${kids} itens` } : {})}
                    className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg px-1.5 py-2 text-left sm:grid-cols-[13.5rem_1fr_9rem] ${kids ? "cursor-pointer hover:bg-ink/5" : ""}`}
                  >
                    <span className="order-1 min-w-0">
                      <span className="block truncate text-sm font-medium">{kids > 0 && <span className="mr-1 text-brand">▸</span>}{r.name}</span>
                      <span className="block truncate text-[11px] text-faint">
                        {r.weight != null ? `peso ${p2(r.weight, 1)}` : r.source}
                        {r.m != null ? ` · mês ${p2(r.m)}` : ""}
                        {f ? ` · Focus ${f.year}: ${p2(f.median)}` : ""}
                      </span>
                    </span>
                    <span className="relative order-3 col-span-2 block h-4 sm:order-2 sm:col-span-1">
                      <span className="absolute top-1 h-2.5 rounded-[4px] bg-brand" style={{ left: `${Math.min(X(0), X(v))}%`, width: `${Math.max(0.6, Math.abs(X(v) - X(0)))}%` }} />
                    </span>
                    <span className="order-2 flex items-center justify-end gap-2 sm:order-3">
                      <span className="hidden sm:block"><Spark h={r.history} /></span>
                      <span className="text-right">
                        <b className="block text-sm tabular-nums">{p2(v)}</b>
                        <StatusChip v={v} band={band} compact />
                      </span>
                    </span>
                  </Row>
                  {(r.desc || diff !== null) && !trail.length && (
                    <p className="-mt-1 px-1.5 pb-1 text-[11px] leading-relaxed text-muted sm:pl-[1.5rem]">
                      {r.desc}
                      {diff !== null && <span className="text-faint"> {r.desc ? "· " : ""}{Math.abs(diff) < 0.05 ? "estável" : diff > 0 ? "acelerando" : "desacelerando"} ({pp(diff)} no mês)</span>}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-[11px] text-faint" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm bg-ok/15" />Faixa da meta ({p2(band.center - band.tol, 1)} a {p2(band.center + band.tol, 1)})</span>
          {headline !== null && <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0 border-l border-dashed border-ink/60" />IPCA geral ({p2(headline)})</span>}
          <span>Barras: acumulado em 12 meses.</span>
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-brand">Ver em tabela</summary>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-faint">
              <tr><th className="p-3 capitalize">{level}</th>{hasWeight && <th className="p-3 text-right">Peso</th>}<th className="p-3 text-right">No mês</th><th className="p-3 text-right">12 meses</th><th className="p-3 text-right">Situação</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-b border-line last:border-0">
                  <td className="p-3">{r.name}</td>
                  {hasWeight && <td className="p-3 text-right tabular-nums">{r.weight != null ? p2(r.weight, 1) : "—"}</td>}
                  <td className="p-3 text-right tabular-nums">{r.m != null ? p2(r.m) : "—"}</td>
                  <td className="p-3 text-right font-semibold tabular-nums">{p2(r.y12!)}</td>
                  <td className="p-3 text-right"><StatusChip v={r.y12} band={band} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="mt-3 text-xs leading-relaxed text-faint">
        O governo só fixa meta para o IPCA geral ({br.center.toLocaleString("pt-BR")}% ± {br.tol.toLocaleString("pt-BR")} p.p., definida pelo {br.source}). Para os pilares, que não têm meta oficial, a comparação padrão usa a meta de 2% ao ano adotada pelos principais bancos centrais do mundo, com faixa de ± 1 p.p.; você pode trocar para a meta brasileira.
      </p>
    </div>
  );
}
