"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Segmented } from "@/components/controls";
import { PRESIDENT_TERMS, presidentAt, presidentSpans } from "@/lib/presidents";
import type { LaborShareData } from "@/lib/labor-share";

type Measure = "share" | "exploit" | "profit";
type Range = 1 | 2 | 5 | 10 | 20 | 30 | 50;
const RANGES: Range[] = [1, 2, 5, 10, 20, 30, 50];

type Line = { id: string; name: string; color: string; dash?: string; values: (number | null)[] };

const pct = (v: number, d = 1) => `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
const rs = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function LaborShareChart({ data }: { data: LaborShareData }) {
  const [measure, setMeasure] = useState<Measure>("share");
  const [range, setRange] = useState<Range>(30);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(860);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 1 e 2 anos: trimestral, se o IBGE publicar; senão, os anos mais recentes
  const quarterly = range <= 2 && data.quarterly.length >= 4 && measure !== "profit";
  const fmt = (v: number) => (measure === "exploit" ? rs(v) : pct(v));

  const { keys, labels, lines } = useMemo(() => {
    if (quarterly) {
      const pts = data.quarterly.slice(-(range * 4));
      const k = pts.map((p) => p.period);
      const ls: Line[] = measure === "share"
        ? [
            { id: "q-gdp", name: "Salários no PIB (IBGE, trimestral)", color: "var(--brand)", values: pts.map((p) => p.wageGdp) },
            { id: "q-fac", name: "Salários na renda dos fatores (IBGE)", color: "var(--estadual)", dash: "6 4", values: pts.map((p) => p.wageFactor) },
          ]
        : [{ id: "q-exp", name: "Excedente operacional por R$ 1 de salário (IBGE)", color: "var(--danger)", values: pts.map((p) => p.exploitation) }];
      return { keys: k.map((p) => `${p.slice(0, 4)}-${String((Number(p.slice(-1)) - 1) * 3 + 2).padStart(2, "0")}`), labels: k.map((p) => p.replace("-T", " T")), lines: ls };
    }
    const ibge = new Map(data.annual.map((p) => [p.year, p]));
    const pwt = new Map(data.longRun.map((p) => [p.year, p]));
    const lastYear = measure === "profit" ? Math.max(...data.longRun.filter((p) => p.profitRate !== null).map((p) => p.year)) : Math.max(...data.annual.map((p) => p.year), ...data.longRun.map((p) => p.year));
    const firstYear = lastYear - range + 1;
    const years: number[] = [];
    for (let y = firstYear; y <= lastYear; y++) if (ibge.has(y) || pwt.has(y)) years.push(y);
    const ls: Line[] = measure === "profit"
      ? [{ id: "profit", name: "Taxa de lucro bruta (Penn World Table)", color: "var(--danger)", values: years.map((y) => pwt.get(y)?.profitRate ?? null) }]
      : measure === "share"
      ? [
          { id: "gdp", name: "Salários no PIB (IBGE)", color: "var(--brand)", values: years.map((y) => ibge.get(y)?.wageGdp ?? null) },
          { id: "fac", name: "Salários na renda dos fatores (IBGE)", color: "var(--estadual)", dash: "6 4", values: years.map((y) => ibge.get(y)?.wageFactor ?? null) },
          { id: "pwt", name: "Trabalho no PIB, com autônomos (Penn World Table)", color: "var(--muted)", dash: "2 4", values: years.map((y) => pwt.get(y)?.share ?? null) },
        ]
      : [
          { id: "exp", name: "Excedente operacional por R$ 1 de salário (IBGE)", color: "var(--danger)", values: years.map((y) => ibge.get(y)?.exploitation ?? null) },
          { id: "pwtx", name: "Renda do capital por R$ 1 do trabalho (Penn World Table)", color: "var(--muted)", dash: "2 4", values: years.map((y) => pwt.get(y)?.exploitation ?? null) },
        ];
    return { keys: years.map((y) => `${y}-07`), labels: years.map(String), lines: ls.filter((l) => l.values.some((v) => v !== null)) };
  }, [data, measure, range, quarterly]);

  const visible = lines.filter((l) => !off[l.id]);
  const all = visible.flatMap((l) => l.values.filter((v): v is number => v !== null));
  const lo = all.length ? Math.min(...all) : 0, hi = all.length ? Math.max(...all) : 1;
  const pad = (hi - lo) * 0.15 || 0.02;
  const yMin = Math.max(0, lo - pad), yMax = hi + pad;

  const H = W < 560 ? 250 : 300;
  const m = { l: W < 560 ? 46 : 56, r: 14, t: 34, b: 28 };
  const n = keys.length;
  const x = (i: number) => m.l + (n > 1 ? (i / (n - 1)) * (W - m.l - m.r) : (W - m.l - m.r) / 2);
  const y = (v: number) => m.t + ((yMax - v) / (yMax - yMin || 1)) * (H - m.t - m.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + t * (yMax - yMin));
  const every = Math.max(1, Math.ceil(n / (W < 560 ? 5 : 11)));
  const spans = presidentSpans(keys);

  // resumo do período: primeira e última observação da série principal
  const main = visible[0];
  const firstI = main ? main.values.findIndex((v) => v !== null) : -1;
  const lastI = main ? main.values.length - 1 - [...main.values].reverse().findIndex((v) => v !== null) : -1;
  const change = main && firstI >= 0 && lastI > firstI ? (main.values[lastI]! - main.values[firstI]!) : null;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
        <Segmented label="Medida" value={measure} onChange={setMeasure} options={[{ v: "share", l: "Participação dos salários" }, { v: "exploit", l: "Taxa de exploração" }, ...(data.longRun.some((p) => p.profitRate !== null) ? [{ v: "profit" as Measure, l: "Taxa de lucro" }] : [])]} />
        <Segmented label="Período" value={String(range)} onChange={(v) => setRange(Number(v) as Range)} options={RANGES.map((r) => ({ v: String(r), l: r === 1 ? "1 ano" : `${r} anos` }))} />
      </div>

      {measure === "profit" && (
        <p className="mb-3 rounded-xl bg-brand-soft/70 px-3 py-2 text-xs leading-relaxed text-muted">A taxa de lucro precisa do estoque de capital, que só a Penn World Table estima para o Brasil (até {Math.max(...data.longRun.filter((p) => p.profitRate !== null).map((p) => p.year))}); por isso a série termina antes das demais.</p>
      )}
      {range <= 2 && !quarterly && measure !== "profit" && (
        <p className="mb-3 rounded-xl bg-brand-soft/70 px-3 py-2 text-xs leading-relaxed text-muted">As contas nacionais anuais saem com cerca de dois anos de atraso e o IBGE não publicou a versão trimestral desta conta; o gráfico mostra os anos mais recentes disponíveis.</p>
      )}

      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Séries no gráfico">
        {lines.map((l) => (
          <button key={l.id} type="button" aria-pressed={!off[l.id]} onClick={() => setOff((o) => ({ ...o, [l.id]: !o[l.id] }))} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${off[l.id] ? "border-line text-faint" : "border-line-strong bg-surface"}`}>
            <svg width="18" height="6" aria-hidden><line x1="0" x2="18" y1="3" y2="3" stroke={l.color} strokeWidth="2.5" strokeDasharray={l.dash} /></svg>
            {l.name}
          </button>
        ))}
      </div>

      <div className="card relative p-3 sm:p-5">
        <div ref={box} className="w-full" />
        {n === 0 || !visible.length ? (
          <p className="py-20 text-center text-sm text-muted">Sem dados para este período.</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={measure === "share" ? "Participação dos salários na renda" : "Taxa de exploração"} onMouseLeave={() => setHover(null)}
            onPointerMove={(e) => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * W;
              setHover(Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (n - 1)))));
            }}>
            {spans.map(({ term, i0, i1 }, k) => {
              const half = n > 1 ? (W - m.l - m.r) / (n - 1) / 2 : 20;
              const xa = Math.max(m.l, x(i0) - half), xb = Math.min(W - m.r, x(i1) + half);
              return (
                <g key={`${term.id}-${i0}`}>
                  <rect x={xa} width={xb - xa} y={m.t} height={H - m.t - m.b} fill={term.color} fillOpacity="0.05" />
                  <rect x={xa + (k ? 1 : 0)} width={Math.max(0, xb - xa - (k ? 1 : 0))} y={m.t - 9} height="4" rx="2" fill={term.color} fillOpacity="0.8" />
                  {xb - xa > term.name.length * 6.2 + 6 && <text x={(xa + xb) / 2} y={m.t - 14} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={term.color}>{term.name}</text>}
                </g>
              );
            })}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="3 4" />
                <text x={m.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--faint)">{measure === "exploit" ? t.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : pct(t, (yMax - yMin) * 100 < 6 ? 1 : 0)}</text>
              </g>
            ))}
            {labels.map((l, i) => (i % every === 0 || i === n - 1) && <text key={l} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="10.5" fill="var(--faint)">{l}</text>)}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={H - m.b} stroke="var(--line-strong)" />}
            {visible.map((l) => {
              // quebra a linha onde não há dado
              const segs: string[][] = [[]];
              l.values.forEach((v, i) => (v === null ? segs.push([]) : segs[segs.length - 1].push(`${x(i)},${y(v)}`)));
              return (
                <g key={l.id}>
                  {segs.filter((s) => s.length).map((s, k) => (s.length > 1 ? <polyline key={k} points={s.join(" ")} fill="none" stroke={l.color} strokeWidth="2.2" strokeDasharray={l.dash} strokeLinejoin="round" /> : <circle key={k} cx={s[0].split(",")[0]} cy={s[0].split(",")[1]} r="3" fill={l.color} />))}
                  {hover !== null && l.values[hover] !== null && <circle cx={x(hover)} cy={y(l.values[hover]!)} r="4" fill={l.color} stroke="var(--surface)" strokeWidth="2" />}
                </g>
              );
            })}
          </svg>
        )}
        {hover !== null && n > 0 && (
          <div className="pointer-events-none absolute left-4 top-3 max-w-[17rem] rounded-xl border border-line bg-surface/95 p-2.5 text-xs shadow-pop backdrop-blur sm:left-20">
            <p className="font-bold">{labels[hover]}{presidentAt(keys[hover]) ? ` · ${presidentAt(keys[hover])!.name}` : ""}</p>
            {visible.map((l) => l.values[hover] !== null && (
              <p key={l.id} className="mt-0.5 flex items-center justify-between gap-3"><span className="truncate text-muted">{l.name.replace(/ \(.*\)$/, "")}</span><b>{fmt(l.values[hover]!)}</b></p>
            ))}
          </div>
        )}
      </div>
      {change !== null && main && (
        <p className="mt-2 text-sm text-muted">
          {main.name.replace(/ \(.*\)$/, "")}: de <b className="text-ink">{fmt(main.values[firstI]!)}</b> ({labels[firstI]}) para <b className="text-ink">{fmt(main.values[lastI]!)}</b> ({labels[lastI]}) —{" "}
          {measure !== "exploit"
            ? <b className="text-ink">{change >= 0 ? "▲" : "▼"} {Math.abs(change * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.</b>
            : <b className="text-ink">{change >= 0 ? "▲" : "▼"} {rs(Math.abs(change))} {change >= 0 ? "a mais" : "a menos"} para o capital por R$ 1 de salário</b>}
        </p>
      )}

      {measure === "profit" && <ProfitDecomposition data={data} fromYear={Number(labels[0]?.slice(0, 4)) || 0} toYear={Number(labels.at(-1)?.slice(0, 4)) || 0} />}
      <ByPresident data={data} measure={measure} fromYear={Number(labels[0]?.slice(0, 4)) || 0} />
    </div>
  );
}

/** Média e variação em cada governo, uma coluna por fonte (os níveis do IBGE e da Penn World Table não são comparáveis entre si). */
function ByPresident({ data, measure, fromYear }: { data: LaborShareData; measure: Measure; fromYear: number }) {
  type Stat = { avg: number; delta: number | null; span: string } | null;
  const stat = (pts: { year: number; v: number }[]): Stat => (pts.length ? { avg: pts.reduce((a, p) => a + p.v, 0) / pts.length, delta: pts.length > 1 ? pts[pts.length - 1].v - pts[0].v : null, span: `${pts[0].year}–${pts[pts.length - 1].year}` } : null);
  const rows = PRESIDENT_TERMS.map((t) => {
    const from = Number(t.from.slice(0, 4)), to = t.to ? Number(t.to.slice(0, 4)) : 9999;
    const inRange = (yr: number) => yr >= Math.max(from, fromYear) && yr <= to && presidentAt(`${yr}-07`)?.id === t.id;
    const ibge = measure === "profit" ? null : stat(data.annual.filter((p) => inRange(p.year)).map((p) => ({ year: p.year, v: measure === "share" ? p.wageGdp ?? p.wageFactor! : p.exploitation })));
    const pwt = stat(data.longRun.filter((p) => inRange(p.year) && (measure !== "profit" || p.profitRate !== null)).map((p) => ({ year: p.year, v: measure === "share" ? p.share : measure === "profit" ? p.profitRate! : p.exploitation })));
    return ibge || pwt ? { t, ibge, pwt } : null;
  }).filter((r): r is NonNullable<typeof r> => !!r);
  if (!rows.length) return null;
  const val = (v: number) => (measure === "exploit" ? rs(v) : pct(v));
  const dl = (d: number | null) => (d === null ? "" : measure !== "exploit" ? ` (${d >= 0 ? "+" : "−"}${Math.abs(d * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.)` : ` (${d >= 0 ? "+" : "−"}${rs(Math.abs(d))})`);
  const cell = (x: Stat) => (x ? <><b className="tabular-nums">{val(x.avg)}</b><span className="text-xs text-muted">{dl(x.delta)}</span><span className="block text-[11px] text-faint">{x.span}</span></> : <span className="text-faint">—</span>);
  const hasPwt = rows.some((r) => r.pwt);
  const hasIbge = rows.some((r) => r.ibge);
  return (
    <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full whitespace-nowrap text-left text-sm">
        <thead className="border-b border-line text-xs uppercase text-faint">
          <tr><th className="p-3">Governo</th>{hasIbge && <th className="p-3 text-right">{measure === "share" ? "Salários no PIB · IBGE" : "Exploração · IBGE"}</th>}{hasPwt && <th className="p-3 text-right">{measure === "share" ? "Trabalho no PIB · PWT" : measure === "profit" ? "Taxa de lucro · PWT" : "Capital/trabalho · PWT"}</th>}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.t.id} className="border-b border-line last:border-0">
              <td className="p-3"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: r.t.color }} />{r.t.name}</td>
              {hasIbge && <td className="p-3 text-right">{cell(r.ibge)}</td>}
              {hasPwt && <td className="p-3 text-right">{cell(r.pwt)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-3 py-2 text-[11px] text-faint">Média dos anos de cada governo com dado e, entre parênteses, a variação do primeiro ao último ano. {hasIbge && hasPwt ? "Compare governos dentro da mesma coluna: as duas fontes medem de jeitos diferentes." : ""}</p>
    </div>
  );
}

/**
 * Decomposição da taxa de lucro: r = (lucros ÷ PIB) × (PIB ÷ capital).
 * A variação entre dois anos é repartida em logaritmos: Δln r = Δln(fatia dos lucros) + Δln(produtividade do capital).
 */
function ProfitDecomposition({ data, fromYear, toYear }: { data: LaborShareData; fromYear: number; toYear: number }) {
  const pts = data.longRun.filter((p) => p.profitRate !== null && p.outputCapital !== null && p.year >= fromYear && p.year <= toYear);
  if (pts.length < 2) return null;
  const a = pts[0], b = pts[pts.length - 1];
  // contrafactuais: o que teria acontecido se só um dos dois componentes mudasse
  const onlyShare = b.profitShare * a.outputCapital!;
  const onlyYK = a.profitShare * b.outputCapital!;
  const yk = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const row = (label: string, va: number, vb: number, hint: string, f: (v: number) => string = pct) => (
    <tr className="border-b border-line last:border-0">
      <td className="p-3"><b className="block text-sm">{label}</b><span className="text-xs text-faint">{hint}</span></td>
      <td className="p-3 text-right tabular-nums">{f(va)}</td>
      <td className="p-3 text-right tabular-nums">{f(vb)}</td>
    </tr>
  );
  return (
    <div className="mt-5 rounded-2xl border border-line bg-surface">
      <div className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">De onde veio a variação ({a.year}–{b.year})</p>
        <p className="mt-1 text-sm leading-relaxed">
          A taxa de lucro {b.profitRate! >= a.profitRate! ? "subiu" : "caiu"} de <b>{pct(a.profitRate!)}</b> para <b>{pct(b.profitRate!)}</b>.{" "}
          Se só a fatia dos lucros na renda tivesse mudado, ela teria ido para <b>{pct(onlyShare)}</b>; se só a produtividade do capital tivesse mudado, para <b>{pct(onlyYK)}</b>.{" "}
          {Math.abs(onlyShare - a.profitRate!) > Math.abs(onlyYK - a.profitRate!) ? "A distribuição entre lucros e salários pesou mais." : "A produtividade do capital pesou mais."}
        </p>
      </div>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full whitespace-nowrap text-left text-sm">
          <thead className="border-b border-line text-xs uppercase text-faint"><tr><th className="p-3">Componente</th><th className="p-3 text-right">{a.year}</th><th className="p-3 text-right">{b.year}</th></tr></thead>
          <tbody>
            {row("Taxa de lucro bruta", a.profitRate!, b.profitRate!, "lucro bruto ÷ estoque de capital")}
            {row("Fatia dos lucros na renda", a.profitShare, b.profitShare, "1 − participação do trabalho")}
            {row("Produtividade do capital", a.outputCapital!, b.outputCapital!, "PIB gerado por R$ 1 de capital", yk)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
