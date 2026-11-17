"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ControlBar, Segmented } from "@/components/controls";
import { presidentAt, presidentSpans } from "@/lib/presidents";
import type { CatSeries, Category, TaxData } from "@/lib/taxes";

type Unit = "pct" | "pc" | "usd";
type Range = 1 | 2 | 5 | 10 | 20 | 30;
const RANGES: Range[] = [1, 2, 5, 10, 20, 30];
const UNIT_LABEL: Record<Unit, string> = { pct: "% do PIB", pc: "US$ por habitante", usd: "US$ total" };

const COLORS = { br: "var(--brand)", dev: "var(--estadual)", emg: "var(--municipal)", oecd: "var(--muted)", latam: "var(--federal)" };

const num = (v: number, d = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const usdBig = (v: number) => {
  const a = Math.abs(v);
  const f = (n: number, u: string) => `US$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: n >= 100 ? 0 : n >= 10 ? 1 : 2 })} ${u}`;
  return a >= 1e12 ? f(v / 1e12, "tri") : a >= 1e9 ? f(v / 1e9, "bi") : a >= 1e6 ? f(v / 1e6, "mi") : `US$ ${Math.round(v).toLocaleString("pt-BR")}`;
};
const fmtUnit = (u: Unit, v: number) => (u === "pct" ? `${num(v)}%` : u === "pc" ? `US$ ${Math.round(v).toLocaleString("pt-BR")}` : usdBig(v));
const axisUnit = (u: Unit, v: number) => (u === "pct" ? `${num(v, v < 10 ? 1 : 0)}%` : u === "pc" ? `${v >= 1000 ? `${num(v / 1000, 1)} mil` : Math.round(v)}` : usdBig(v).replace("US$ ", ""));

type Line = { id: string; name: string; color: string; dash?: string; width?: number; values: (number | null)[]; note?: (string | null)[] };

/** Linhas de uma categoria na unidade escolhida. */
function linesOf(s: CatSeries, unit: Unit, idx: number[], extras: { oecd: boolean; latam: boolean }): Line[] {
  const pick = <T,>(a: T[]) => idx.map((i) => a[i]);
  const br = unit === "pct" ? s.brazil.pct : unit === "pc" ? s.brazil.perCapita : s.brazil.usd;
  const g = (arr: CatSeries["developed"]) => pick(arr).map((x) => (unit === "pct" ? x.pct : unit === "pc" ? x.perCapita : x.usdAvg));
  const memoBr = idx.map((i) => {
    const parts = [s.brazil.pct[i] != null ? `${num(s.brazil.pct[i]!)}% do PIB` : null, s.brazil.usd[i] != null ? usdBig(s.brazil.usd[i]!) : null, s.brazil.perCapita[i] != null ? `US$ ${Math.round(s.brazil.perCapita[i]!).toLocaleString("pt-BR")} por habitante` : null].filter(Boolean);
    return parts.join(" · ");
  });
  const nNote = (arr: CatSeries["developed"]) => pick(arr).map((x) => (x.n ? `média de ${x.n} países` : null));
  const out: Line[] = [
    { id: "br", name: "Brasil", color: COLORS.br, width: 3, values: pick(br), note: memoBr },
    { id: "dev", name: unit === "usd" ? "Desenvolvidos (média por país)" : "Países desenvolvidos", color: COLORS.dev, dash: "7 4", values: g(s.developed), note: nNote(s.developed) },
    { id: "emg", name: unit === "usd" ? "Em desenvolvimento (média por país)" : "Países em desenvolvimento", color: COLORS.emg, dash: "2 4", values: g(s.developing), note: nNote(s.developing) },
  ];
  if (unit === "pct" && extras.oecd) out.push({ id: "oecd", name: "Média OCDE (oficial)", color: COLORS.oecd, dash: "1 3", values: pick(s.oecdAvg) });
  if (unit === "pct" && extras.latam) out.push({ id: "latam", name: "América Latina (OCDE)", color: COLORS.latam, dash: "5 2 1 2", values: pick(s.latamAvg) });
  return out.filter((l) => l.values.some((v) => v != null));
}

function Chart({ title, desc, s, unit, years, idx, extras, small }: { title: string; desc?: string; s: CatSeries; unit: Unit; years: number[]; idx: number[]; extras: { oecd: boolean; latam: boolean }; small?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const lines = linesOf(s, unit, idx, extras);
  const ys = idx.map((i) => years[i]);
  const n = ys.length;
  const all = lines.flatMap((l) => l.values.filter((v): v is number => v != null));
  const hi = all.length ? Math.max(...all) : 1;
  // eixo com marcas redondas (0, 10, 20, 30… ou 0, 2,5, 5…)
  const step = (() => {
    const raw = (hi * 1.08) / 4 || 1;
    const p10 = Math.pow(10, Math.floor(Math.log10(raw)));
    return [1, 2, 2.5, 5, 10].map((k) => k * p10).find((v) => v >= raw) ?? raw;
  })();
  const yMax = Math.max(step, Math.ceil((hi * 1.04) / step) * step), yMin = 0;
  const bars = n <= 2; // 1 ou 2 anos: barras agrupadas
  const H = small ? 190 : W < 560 ? 230 : 260;
  const m = { l: unit === "pct" ? 40 : 54, r: 12, t: 30, b: 24 };
  const x = (i: number) => (bars ? m.l + ((i + 0.5) / n) * (W - m.l - m.r) : m.l + (n > 1 ? (i / (n - 1)) * (W - m.l - m.r) : (W - m.l - m.r) / 2));
  const y = (v: number) => m.t + ((yMax - v) / (yMax - yMin)) * (H - m.t - m.b);
  const ticks: number[] = [];
  for (let t = 0; t <= yMax + 1e-9; t += step) ticks.push(t);
  const every = Math.max(1, Math.ceil(n / (W < 560 || small ? 5 : 10)));
  const spans = presidentSpans(ys.map((yr) => `${yr}-07`));
  const half = bars ? (W - m.l - m.r) / n / 2 : n > 1 ? (W - m.l - m.r) / (n - 1) / 2 : 30;

  // resumo do período: Brasil e grupos, primeira e última observação
  const delta = (l?: Line) => {
    if (!l) return null;
    const a = l.values.findIndex((v) => v != null), b = l.values.length - 1 - [...l.values].reverse().findIndex((v) => v != null);
    return a >= 0 && b > a ? { from: l.values[a]!, to: l.values[b]!, ya: ys[a], yb: ys[b] } : null;
  };
  const br = delta(lines.find((l) => l.id === "br"));
  const last = (id: string) => {
    const l = lines.find((x) => x.id === id);
    if (!l) return null;
    for (let i = l.values.length - 1; i >= 0; i--) if (l.values[i] != null) return { v: l.values[i]!, y: ys[i] };
    return null;
  };
  const lb = last("br"), ld = last("dev"), le = last("emg");

  return (
    <div className={small ? "rounded-2xl border border-line bg-surface p-3" : ""}>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className={small ? "text-sm font-semibold" : "display text-xl font-semibold"}>{title}</h3>
        {lb && <p className="text-xs text-muted">{lb.y}: Brasil <b className="text-ink">{fmtUnit(unit, lb.v)}</b>{ld ? <> · desenv. {fmtUnit(unit, ld.v)}</> : null}{le ? <> · em desenv. {fmtUnit(unit, le.v)}</> : null}</p>}
      </div>
      {desc && <p className="mb-2 text-xs leading-relaxed text-muted">{desc}</p>}
      <div className={`relative ${small ? "" : "rounded-2xl border border-line bg-surface p-3 sm:p-4"}`}>
        <div ref={box} className="w-full" />
        {!n || !lines.length ? <p className="py-10 text-center text-sm text-muted">Sem dados para este período.</p> : (
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${title}: Brasil e médias de países`} onMouseLeave={() => setHover(null)}
            onPointerMove={(e) => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * W;
              const f = (px - m.l) / (W - m.l - m.r);
              setHover(bars ? Math.max(0, Math.min(n - 1, Math.floor(f * n))) : n > 1 ? Math.max(0, Math.min(n - 1, Math.round(f * (n - 1)))) : 0);
            }}>
            {spans.map(({ term, i0, i1 }, k) => {
              const xa = Math.max(m.l, x(i0) - half), xb = Math.min(W - m.r, x(i1) + half);
              return (
                <g key={`${term.id}-${i0}`}>
                  <rect x={xa} width={xb - xa} y={m.t} height={H - m.t - m.b} fill={term.color} fillOpacity="0.045" />
                  <rect x={xa + (k ? 1 : 0)} width={Math.max(0, xb - xa - (k ? 1 : 0))} y={m.t - 8} height="3" rx="1.5" fill={term.color} fillOpacity="0.75" />
                  {xb - xa > term.name.length * 6 + 6 && <text x={(xa + xb) / 2} y={m.t - 12} textAnchor="middle" fontSize="10" fontWeight="600" fill={term.color}>{term.name}</text>}
                </g>
              );
            })}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--line-strong)" : "var(--line)"} strokeDasharray={t === 0 ? undefined : "3 4"} />
                <text x={m.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--faint)">{axisUnit(unit, t)}</text>
              </g>
            ))}
            {ys.map((yr, i) => (i % every === 0 || i === n - 1) && <text key={yr} x={x(i)} y={H - 6} textAnchor={bars || n === 1 ? "middle" : i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="10" fill="var(--faint)">{yr}</text>)}
            {hover !== null && !bars && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={H - m.b} stroke="var(--line-strong)" />}
            {bars && ys.map((yr, i) => {
              // barras lado a lado, com o valor em cima
              const k = lines.length, gw = Math.min(half * 1.5, k * 46), bw = gw / k - 4;
              return lines.map((l, j) => {
                const v = l.values[i];
                if (v == null) return null;
                const bx = x(i) - gw / 2 + j * (gw / k) + 2;
                return (
                  <g key={`${yr}-${l.id}`}>
                    <rect x={bx} y={y(v)} width={bw} height={Math.max(1, y(0) - y(v))} rx="4" fill={l.color} fillOpacity={l.id === "br" ? 1 : 0.75} />
                    <text x={bx + bw / 2} y={y(v) - 5} textAnchor="middle" fontSize={bw < 40 ? 9 : 10.5} fontWeight="600" fill="var(--ink)">{fmtUnit(unit, v).replace("US$ ", "")}</text>
                  </g>
                );
              });
            })}
            {!bars && lines.map((l) => {
              const segs: string[][] = [[]];
              l.values.forEach((v, i) => (v == null ? segs.push([]) : segs[segs.length - 1].push(`${x(i)},${y(v)}`)));
              return (
                <g key={l.id}>
                  {segs.filter((sg) => sg.length > 1).map((sg, k) => <polyline key={k} points={sg.join(" ")} fill="none" stroke={l.color} strokeWidth={l.width ?? 2} strokeDasharray={l.dash} strokeLinejoin="round" />)}
                  {/* pontos isolados (1 ou 2 anos) */}
                  {l.values.map((v, i) => v != null && hover === i && <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={l.color} stroke="var(--surface)" strokeWidth="1.5" />)}
                </g>
              );
            })}
          </svg>
        )}
        {hover !== null && n > 0 && (
          <div className="pointer-events-none absolute left-2 right-2 top-2 z-10 rounded-xl border border-line bg-surface/95 p-2.5 text-xs shadow-pop backdrop-blur sm:left-14 sm:right-auto sm:max-w-[22rem]">
            <p className="font-bold">{ys[hover]}{presidentAt(`${ys[hover]}-07`) ? ` · ${presidentAt(`${ys[hover]}-07`)!.name}` : ""}</p>
            {lines.map((l) => l.values[hover] != null && (
              <div key={l.id} className="mt-1">
                <p className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-1.5 text-muted"><svg width="14" height="4" aria-hidden><line x1="0" x2="14" y1="2" y2="2" stroke={l.color} strokeWidth="2.5" strokeDasharray={l.dash} /></svg><span className="truncate">{l.name}</span></span><b>{fmtUnit(unit, l.values[hover]!)}</b></p>
                {l.note?.[hover] && <p className="pl-5 text-[11px] text-faint">{l.note[hover]}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      {br && !small && (
        <p className="mt-1.5 text-xs text-muted">
          Brasil de {br.ya} a {br.yb}: {fmtUnit(unit, br.from)} → <b className="text-ink">{fmtUnit(unit, br.to)}</b>
          {unit === "pct" ? ` (${br.to - br.from >= 0 ? "+" : "−"}${num(Math.abs(br.to - br.from))} p.p.)` : ` (${br.to >= br.from ? "+" : "−"}${num(Math.abs((br.to / br.from - 1) * 100), 0)}%)`}
        </p>
      )}
    </div>
  );
}

/** Estrutura: quanto cada tipo de imposto representa do total (último ano do período). */
function Composition({ data, yearIdx }: { data: TaxData; yearIdx: number }) {
  const top = ["T_5000", "T_1000", "T_2000", "T_3000", "T_4000", "T_6000"];
  const names: Record<string, string> = { T_5000: "Consumo", T_1000: "Renda e lucros", T_2000: "Previdência", T_3000: "Folha", T_4000: "Patrimônio", T_6000: "Outros" };
  const palette = ["var(--brand)", "var(--estadual)", "var(--municipal)", "var(--federal)", "var(--gold)", "var(--muted)"];
  const get = (code: string) => data.series.find((s) => s.code === code)!;
  const rows = [
    { name: "Brasil", vals: top.map((c) => get(c).brazil.pct[yearIdx]), total: get("_T").brazil.pct[yearIdx] },
    { name: "Países desenvolvidos", vals: top.map((c) => get(c).developed[yearIdx].pct), total: get("_T").developed[yearIdx].pct },
    { name: "Países em desenvolvimento", vals: top.map((c) => get(c).developing[yearIdx].pct), total: get("_T").developing[yearIdx].pct },
  ];
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted" aria-hidden>
        {top.map((c, i) => <span key={c} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: palette[i] }} />{names[c]}</span>)}
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const sum = r.vals.reduce<number>((a, v) => a + (v ?? 0), 0) || 1;
          return (
            <div key={r.name}>
              <p className="mb-1 flex justify-between text-sm"><span className="font-medium">{r.name}</span><span className="text-xs text-muted">carga total {r.total != null ? `${num(r.total)}% do PIB` : "—"}</span></p>
              <div className="flex h-6 overflow-hidden rounded-[6px]">
                {r.vals.map((v, i) => v ? (
                  <div key={i} title={`${names[top[i]]}: ${num(v)}% do PIB (${num((v / sum) * 100, 0)}% do total)`} className="flex items-center justify-center text-[10px] font-semibold text-white" style={{ width: `${(v / sum) * 100}%`, background: palette[i], borderRight: "2px solid var(--surface)" }}>
                    {v / sum > 0.08 ? `${num((v / sum) * 100, 0)}%` : ""}
                  </div>
                ) : null)}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-faint">Fatia de cada tipo de imposto no total arrecadado em {data.years[yearIdx]}. Passe o mouse ou toque numa faixa para ver o % do PIB.</p>
    </div>
  );
}

function downloadCsv(data: TaxData, cats: Category[], idx: number[], unit: Unit) {
  const head = ["Ano", "Categoria", "Brasil", "Desenvolvidos (média)", "Em desenvolvimento (média)", "Países desenvolvidos (n)", "Países em desenvolvimento (n)", "Unidade"];
  const rows: (string | number | null)[][] = [];
  for (const c of cats) {
    const s = data.series.find((x) => x.code === c.code)!;
    const val = (g: CatSeries["developed"][number]) => (unit === "pct" ? g.pct : unit === "pc" ? g.perCapita : g.usdAvg);
    for (const i of idx) rows.push([data.years[i], c.name, (unit === "pct" ? s.brazil.pct : unit === "pc" ? s.brazil.perCapita : s.brazil.usd)[i], val(s.developed[i]), val(s.developing[i]), s.developed[i].n, s.developing[i].n, unit === "pct" ? "% do PIB" : unit === "pc" ? "US$ por habitante" : "US$ (Brasil: total; grupos: média por país)"]);
  }
  const cell = (x: string | number | null) => (x == null ? "" : typeof x === "number" ? String(x).replace(".", ",") : `"${x}"`);
  const csv = "﻿" + [head.map(cell).join(";"), ...rows.map((r) => r.map(cell).join(";"))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `impostos-${unit}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TaxDashboard({ data, categories }: { data: TaxData; categories: Category[] }) {
  const [range, setRange] = useState<Range>(30);
  const [unit, setUnit] = useState<Unit>("pct");
  const [oecd, setOecd] = useState(false);
  const [latam, setLatam] = useState(false);
  const idx = useMemo(() => {
    const last = data.years[data.years.length - 1];
    return data.years.map((y, i) => (y > last - range ? i : -1)).filter((i) => i >= 0);
  }, [data.years, range]);
  const extras = { oecd, latam };
  const top = categories.filter((c) => !c.parent);
  const kids = (code: string) => categories.filter((c) => c.parent === code);
  const seriesOf = (code: string) => data.series.find((s) => s.code === code)!;
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${on ? "border-ink bg-ink text-paper" : "border-line-strong text-muted hover:text-ink"}`;

  return (
    <div className="space-y-8">
      <div className="sm:sticky sm:top-16 sm:z-10 sm:rounded-2xl sm:border sm:border-line sm:bg-paper/90 sm:px-4 sm:pt-3 sm:backdrop-blur">
        <ControlBar
          summary={`${range === 1 ? "1 ano" : `${range} anos`} · ${UNIT_LABEL[unit]}`}
          primary={<Segmented label="Unidade" value={unit} onChange={setUnit} options={(Object.keys(UNIT_LABEL) as Unit[]).map((u) => ({ v: u, l: UNIT_LABEL[u] }))} />}
        >
          <Segmented label="Período" value={String(range)} onChange={(v) => setRange(Number(v) as Range)} options={RANGES.map((r) => ({ v: String(r), l: r === 1 ? "1 ano" : `${r} anos` }))} />
          {unit === "pct" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">Comparar também:</span>
              <button type="button" aria-pressed={oecd} onClick={() => setOecd(!oecd)} className={chip(oecd)}>Média OCDE</button>
              <button type="button" aria-pressed={latam} onClick={() => setLatam(!latam)} className={chip(latam)}>América Latina</button>
            </div>
          )}
          <button type="button" onClick={() => downloadCsv(data, categories, idx, unit)} className="text-xs font-semibold text-brand hover:underline">⇩ Baixar CSV</button>
        </ControlBar>
        <div className="-mt-1 mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden>
          <span className="inline-flex items-center gap-1.5"><svg width="18" height="5"><line x1="0" x2="18" y1="2.5" y2="2.5" stroke={COLORS.br} strokeWidth="3" /></svg>Brasil</span>
          <span className="inline-flex items-center gap-1.5"><svg width="18" height="5"><line x1="0" x2="18" y1="2.5" y2="2.5" stroke={COLORS.dev} strokeWidth="2" strokeDasharray="7 4" /></svg>Desenvolvidos</span>
          <span className="inline-flex items-center gap-1.5"><svg width="18" height="5"><line x1="0" x2="18" y1="2.5" y2="2.5" stroke={COLORS.emg} strokeWidth="2" strokeDasharray="2 4" /></svg>Em desenvolvimento</span>
        </div>
      </div>

      {unit === "usd" && <p className="rounded-xl bg-brand-soft/70 px-3 py-2 text-xs leading-relaxed text-muted">Em US$ total, a linha do Brasil é o valor arrecadado no país; as dos grupos são a média do que arrecada cada país do grupo. Para comparar o peso real de cada país, use US$ por habitante.</p>}
      {range <= 2 && <p className="rounded-xl bg-brand-soft/70 px-3 py-2 text-xs leading-relaxed text-muted">Os dados são anuais e a OCDE publica com cerca de um ano de atraso: o período mostra os {range === 1 ? "o último ano" : "dois últimos anos"} disponíveis ({data.years.at(-1)}).</p>}

      <section className="card p-5 sm:p-6" aria-label="Estrutura dos impostos">
        <h2 className="display text-xl font-semibold">De onde vem a arrecadação</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Como o total se divide entre os tipos de imposto no Brasil e nas médias de países.</p>
        <Composition data={data} yearIdx={idx[idx.length - 1]} />
      </section>

      {top.map((c) => (
        <section key={c.code} className="card p-5 sm:p-6" aria-label={c.name}>
          <Chart title={c.name} desc={c.desc} s={seriesOf(c.code)} unit={unit} years={data.years} idx={idx} extras={extras} />
          {kids(c.code).length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {kids(c.code).map((k) => <Chart key={k.code} small title={k.name} desc={k.desc} s={seriesOf(k.code)} unit={unit} years={data.years} idx={idx} extras={extras} />)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
