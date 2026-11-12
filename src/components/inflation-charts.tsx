"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Band, FocusYear, Pillar } from "@/lib/inflation";
import { AskButton } from "@/components/agent/ask-button";
import { ControlBar, Segmented } from "@/components/controls";
import { InfoTip } from "@/components/info-tip";
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
        <AskButton label="Perguntar sobre o gráfico" focus={{ title: "Inflação e juros ao longo do tempo", text: `Gráfico dos últimos ${years} ${years === 1 ? "ano" : "anos"}: IPCA em 12 meses ${last ? `(mais recente: ${p2(last.v)} em ${MES[last.month]}/${last.year})` : ""}${selicPts[selicPts.length - 1] !== null && selicPts.length ? `, Selic meta ${p2(selicPts[selicPts.length - 1]!)} ao ano` : ""}${realPts[realPts.length - 1] !== null && realPts.length ? `, juro real ${p2(realPts[realPts.length - 1]!)}` : ""}. Faixa verde = intervalo de tolerância da meta de inflação de cada ano. Linhas exibidas: ${[...show].join(", ")}. Juro real é um cálculo: (1+Selic)/(1+IPCA 12m)-1.`, suggestions: ["O que o gráfico mostra?", "Por que a Selic sobe quando a inflação sobe?", "O juro real está alto?"] }} />
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
      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Linhas exibidas">
        {([["ipca", "IPCA em 12 meses", "var(--brand)", true], ["selic", "Selic (meta)", "#d9480f", hasSelic], ["real", "Juro real (cálculo do Política)", "#7c3aed", hasSelic]] as const).map(([k, label, color, ok]) => ok && (
          <button key={k} type="button" aria-pressed={show.has(k)} onClick={() => flip(k)} title={k === "real" ? "(1 + Selic) ÷ (1 + IPCA em 12 meses) − 1: quanto o juro rende acima da inflação. É um cálculo do Política, não um dado oficial." : undefined} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${show.has(k) ? "border-ink/40 bg-ink/5" : "border-line text-muted hover:bg-ink/5"}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: show.has(k) ? color : "transparent", border: `2px solid ${color}` }} />
            {label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-faint">
        IPCA em 12 meses: IBGE, via Banco Central (SGS 433, acumulado de 12 meses). Selic: meta definida pelo Copom no fim de cada mês (Banco Central, SGS 432; a meta existe desde março de 1999). Juro real: (1 + Selic) ÷ (1 + IPCA em 12 meses) − 1, cálculo do Política com dados oficiais, olhando para trás. Os pontos vazados à direita são as expectativas do Focus para dezembro de cada ano.
      </p>
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

type PCol = "name" | "weight" | "m" | "y12" | "trend";

export function InflationPillars({ groups, bc, cores, intl, br, headline }: { groups: Pillar[]; bc: Pillar[]; cores: Pillar[]; intl: Band; br: Band; headline: number | null }) {
  const views = (["groups", "bc", "cores"] as View[]).filter((v) => ({ groups, bc, cores })[v].length);
  const [view, setView] = useState<View>(views[0] ?? "groups");
  const [ref, setRef] = useState<"intl" | "br">("intl");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [col, setCol] = useState<{ key: PCol; dir: 1 | -1 } | null>(null);
  const band = ref === "intl" ? intl : br;
  const root = ({ groups, bc, cores })[view];
  const hasWeight = root.some((i) => i.weight != null);
  const trendOf = (p: Pillar) => (p.prevY12 != null && p.y12 != null ? p.y12 - p.prevY12 : null);

  const value = (p: Pillar, key: PCol): number | string | null => (key === "name" ? p.name : key === "weight" ? p.weight ?? null : key === "m" ? p.m : key === "y12" ? p.y12 : trendOf(p));
  const order = (list: Pillar[], top: boolean) => {
    const l = list.filter((i) => i.y12 !== null);
    // sem escolha no cabeçalho: maior peso (ou maior inflação, quando não há pesos)
    const c = col ?? { key: (top && hasWeight ? "weight" : "y12") as PCol, dir: -1 as const };
    return [...l].sort((a, b) => {
      const x = value(a, c.key), y = value(b, c.key);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (typeof x === "string" ? x.localeCompare(y as string, "pt-BR") : x - (y as number)) * c.dir;
    });
  };
  const rows = order(root, true);
  const counts = rows.reduce((a, r) => ({ ...a, [statusOf(r.y12!, band)]: (a[statusOf(r.y12!, band)] ?? 0) + 1 }), {} as Record<St, number>);
  const toggle = (code: string) => setOpen((o) => { const n = new Set(o); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  const levelName = view === "groups" ? "Grupo" : view === "bc" ? "Tipo de preço" : "Núcleo";

  const line = (r: Pillar, depth: number, parent?: Pillar) => {
    const v = r.y12!;
    const kids = r.children?.length ? order(r.children, false) : [];
    const isOpen = open.has(`${view}:${r.code}`);
    const d = trendOf(r);
    const f = r.focus?.[0];
    return (
      <Fragment key={`${view}:${depth}:${r.code}`}>
        <tr className={`border-t border-line ${depth ? "bg-ink/[0.02]" : ""}`}>
          <td className={`w-[38%] max-w-0 px-2.5 py-2 ${depth ? "text-muted" : "font-medium"}`} style={depth ? { paddingLeft: `${0.625 + depth * 1.25}rem` } : undefined}>
            <div className="flex min-w-0 items-center gap-1.5" title={r.name}>
              {kids.length > 0 ? (
                <button type="button" aria-expanded={isOpen} onClick={() => toggle(`${view}:${r.code}`)} className="flex min-w-0 items-center gap-1.5 text-left hover:underline">
                  <span className={`inline-block shrink-0 text-brand transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                  <span className="truncate">{r.name}</span>
                  <span className="shrink-0 text-[11px] font-semibold text-brand">{kids.length} {depth ? "itens" : "sub"}</span>
                </button>
              ) : (
                <span className="truncate">{r.name}</span>
              )}
              <InfoTip label={`Explicação: ${r.name}`}>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-faint">O que é</span>
                <span className="mt-0.5 block">{r.desc ?? `${r.name}${parent ? `, dentro de "${parent.name}"` : ""}: parte do IPCA, a inflação oficial medida pelo IBGE.`}</span>
                <span className="mt-1.5 block text-muted">Fonte: {r.source}.{r.weight != null ? ` Pesa ${p2(r.weight, 1)} do IPCA.` : ""}{f ? ` O Focus projeta ${p2(f.median)} para ${f.year}.` : ""}</span>
                <span className="mt-2 block">
                  <AskButton label="Pergunte" focus={{
                    title: `${r.name} · inflação`,
                    text: `${r.name}${parent ? ` (dentro de "${parent.name}")` : ""} no IPCA: ${p2(v)} em 12 meses${r.m != null ? `, ${p2(r.m)} no último mês` : ""}${r.weight != null ? `, peso ${p2(r.weight, 1)}` : ""}. Comparado com ${band.label}: ${statusOf(v, band)}. ${d !== null ? `${Math.abs(d) < 0.05 ? "Estável" : d > 0 ? "Acelerando" : "Desacelerando"} (${pp(d)} no mês).` : ""}${f ? ` Focus ${f.year}: ${p2(f.median)}.` : ""}`,
                    suggestions: ["O que é isto, em linguagem simples?", "Por que está nesse nível?", "Isso pesa muito no bolso?"],
                  }} />
                </span>
              </InfoTip>
            </div>
          </td>
          {hasWeight && <td className="px-2.5 py-2 text-right tabular-nums">{r.weight != null ? p2(r.weight, 1) : "—"}</td>}
          <td className="px-2.5 py-2 text-right tabular-nums">{r.m != null ? p2(r.m) : "—"}</td>
          <td className="px-2.5 py-2 text-right font-semibold tabular-nums">{p2(v)}</td>
          <td className="px-2.5 py-2 text-right"><StatusChip v={v} band={band} compact /></td>
          <td className="px-2.5 py-2">
            <div className="flex items-center justify-end gap-2">
              <Spark h={r.history} />
              <span className={`whitespace-nowrap text-xs ${d === null || Math.abs(d) < 0.05 ? "text-muted" : d > 0 ? "text-danger" : "text-ok"}`}>{d === null ? "—" : Math.abs(d) < 0.05 ? "estável" : `${d > 0 ? "▲" : "▼"} ${pp(d)}`}</span>
            </div>
          </td>
        </tr>
        {isOpen && kids.map((k) => line(k, depth + 1, r))}
      </Fragment>
    );
  };

  const heads: [PCol | null, string, "left" | "right", string?][] = [
    ["name", levelName, "left"],
    ...(hasWeight ? [["weight", "Peso", "right", "Quanto este grupo pesa no IPCA geral"] as [PCol, string, "left" | "right", string]] : []),
    ["m", "No mês", "right"],
    ["y12", "12 meses", "right"],
    [null, "Situação", "right", "Dentro, acima ou abaixo da referência escolhida"],
    ["trend", "Tendência", "right", "Mudança do acumulado em 12 meses em relação ao mês anterior"],
  ];

  return (
    <div>
      <ControlBar
        summary={`Comparando com ${ref === "intl" ? "o padrão internacional (2%)" : `a meta do Brasil (${br.center.toLocaleString("pt-BR")}%)`}`}
        primary={<Segmented label="Como dividir" value={view} onChange={(v) => { setView(v); setOpen(new Set()); setCol(null); }} options={views.map((v) => ({ v, l: VIEW_LABEL[v] }))} />}
      >
        <Segmented label="Comparar com" value={ref} onChange={setRef} options={[
          { v: "intl", l: "Padrão internacional (2%)", title: intl.source },
          { v: "br", l: `Meta do Brasil (${br.center.toLocaleString("pt-BR")}%)`, title: br.source },
        ]} />
      </ControlBar>

      <p className="mb-3 text-xs text-muted">
        Comparando com <b className="text-ink">{band.label}</b>: <span className="text-ok">✓ {counts.dentro ?? 0} dentro</span> · <span className="text-danger">▲ {counts.acima ?? 0} acima</span> · <span className="text-danger">▼ {counts.abaixo ?? 0} abaixo</span>
        {headline !== null && <> · IPCA geral: <b className="text-ink">{p2(headline)}</b></>}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-xs text-muted">
              {heads.map(([key, label, align, tip]) => {
                const on = key !== null && col?.key === key;
                return (
                  <th key={label} scope="col" aria-sort={on ? (col!.dir === 1 ? "ascending" : "descending") : "none"} className={`px-2.5 py-2 font-medium ${align === "left" ? "text-left" : "text-right"}`}>
                    {key === null ? <span title={tip}>{label}</span> : (
                      <button type="button" title={tip ?? `Ordenar por ${label.toLowerCase()}`} onClick={() => setCol(on ? { key, dir: (col!.dir * -1) as 1 | -1 } : { key, dir: 1 })} className={`inline-flex items-center gap-1 hover:text-ink ${on ? "font-bold text-ink" : ""}`}>
                        {label}
                        <span aria-hidden className={`text-[10px] ${on ? "" : "opacity-30"}`}>{on ? (col!.dir === 1 ? "▲" : "▼") : "↕"}</span>
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>{rows.map((r) => line(r, 0))}</tbody>
        </table>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-faint">
        O governo só fixa meta para o IPCA geral ({br.center.toLocaleString("pt-BR")}% ± {br.tol.toLocaleString("pt-BR")} p.p., definida pelo {br.source}). Para os pilares, que não têm meta oficial, a comparação padrão usa a meta de 2% ao ano adotada pelos principais bancos centrais do mundo, com faixa de ± 1 p.p.; você pode trocar para a meta brasileira.
      </p>
    </div>
  );
}
