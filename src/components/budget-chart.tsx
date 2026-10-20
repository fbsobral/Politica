"use client";

import { useMemo, useState } from "react";

type Series = { code: string; name: string; parent?: string; values: Record<number, number> };
export type HistoryProps = {
  scope: "MUNICIPAL" | "ESTADUAL" | "FEDERAL";
  entity: string;
  years: number[];
  expense: Series[];
  revenue: Series[];
  totals: { expense: Record<number, number>; revenue: Record<number, number> };
  population: Record<number, number>;
  deflator: Record<number, number>;
};

type Metric = "expense" | "revenue";
type Mode = "real" | "nominal";
type Unit = "brl" | "percap" | "share";

const COLORS = ["#17407f", "#e0a800", "#0e8a5f", "#d9480f", "#7048e8", "#d6336c", "#0c8599", "#6b7280", "#2b8a3e", "#a61e4d"];
const TOTAL = "__total";
const BRAZIL_POP = 212_600_000;

const short = (v: number, unit: Unit) => {
  if (unit === "share") return `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: v < 0.1 ? 1 : 0 })}%`;
  const a = Math.abs(v);
  const f = (n: number, u: string) => `${unit === "percap" ? "R$ " : "R$ "}${n.toLocaleString("pt-BR", { maximumFractionDigits: n >= 100 ? 0 : n >= 10 ? 1 : 2 })} ${u}`.trim();
  if (a >= 1e12) return f(v / 1e12, "tri");
  if (a >= 1e9) return f(v / 1e9, "bi");
  if (a >= 1e6) return f(v / 1e6, "mi");
  if (a >= 1e3) return f(v / 1e3, "mil");
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
};

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Evolução de 10 anos: linhas por categoria, com filtros de período, categoria, métrica, valores reais/nominais e unidade. */
export function BudgetChart(props: HistoryProps) {
  const { years, scope } = props;
  const [metric, setMetric] = useState<Metric>("expense");
  const [mode, setMode] = useState<Mode>(Object.keys(props.deflator).length ? "real" : "nominal");
  const [unit, setUnit] = useState<Unit>("brl");
  const [from, setFrom] = useState(years[0]);
  const [to, setTo] = useState(years[years.length - 1]);
  const [hover, setHover] = useState<number | null>(null);

  const all = metric === "expense" ? props.expense : props.revenue;
  // "detalhar": mostra as subcategorias de uma categoria (ex.: as subfunções de Saúde, ou os tributos de uma origem)
  const [drillBy, setDrillBy] = useState<Record<Metric, string | null>>({ expense: null, revenue: null });
  const drillCode = drillBy[metric];
  const parentSeries = drillCode ? (all.find((s) => s.code === drillCode) ?? null) : null;
  const list = parentSeries ? all.filter((s) => s.parent === parentSeries.code) : all.filter((s) => !s.parent);
  const withKids = all.filter((s) => all.some((c) => c.parent === s.code));
  const totalLabel = parentSeries ? `${parentSeries.name} (total)` : metric === "expense" ? "Despesa total" : "Receita total";
  const totals = parentSeries ? parentSeries.values : metric === "expense" ? props.totals.expense : props.totals.revenue;
  const metricYears = useMemo(() => years.filter((y) => totals[y] !== undefined), [years, totals]);

  const latest = metricYears[metricYears.length - 1];
  const defaultSel = useMemo(() => [TOTAL, ...list.slice(0, 4).map((s) => s.code)], [list]);
  const selKey = `${metric}:${drillCode ?? ""}`;
  const [selByKey, setSelByKey] = useState<Record<string, string[]>>({});
  const selected = selByKey[selKey] ?? defaultSel;
  const setSelected = (v: string[]) => setSelByKey((st) => ({ ...st, [selKey]: v }));
  const drill = (code: string | null) => setDrillBy((d) => ({ ...d, [metric]: code }));

  const yrs = metricYears.filter((y) => y >= from && y <= to);

  const adjust = (y: number, v: number) => (mode === "real" && props.deflator[y] ? v * props.deflator[y] : v);
  const pop = (y: number) => (scope === "FEDERAL" ? BRAZIL_POP : props.population[y]);

  const lines = useMemo(() => {
    const all: { code: string; name: string; color: string; values: Record<number, number | null> }[] = [];
    const defs = [{ code: TOTAL, name: totalLabel, get: (y: number) => totals[y] }, ...list.map((s) => ({ code: s.code, name: s.name, get: (y: number) => s.values[y] }))];
    for (const d of defs) {
      const values: Record<number, number | null> = {};
      for (const y of yrs) {
        const raw = d.get(y);
        if (raw === undefined) {
          values[y] = null;
          continue;
        }
        if (unit === "share") values[y] = d.code === TOTAL ? null : totals[y] ? raw / totals[y] : null;
        else if (unit === "percap") values[y] = pop(y) ? adjust(y, raw) / pop(y) : null;
        else values[y] = adjust(y, raw);
      }
      all.push({ code: d.code, name: d.name, color: "", values });
    }
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, mode, unit, from, to, list, totals, totalLabel]);

  const visible = lines.filter((l) => selected.includes(l.code) && !(unit === "share" && l.code === TOTAL)).map((l, i) => ({ ...l, color: COLORS[i % COLORS.length] }));
  const maxVal = niceMax(Math.max(...visible.flatMap((l) => yrs.map((y) => l.values[y] ?? 0)), 0));

  const W = 860;
  const H = 360;
  const m = { l: 74, r: 18, t: 16, b: 34 };
  const x = (y: number) => m.l + (yrs.length > 1 ? ((y - yrs[0]) / (yrs[yrs.length - 1] - yrs[0])) * (W - m.l - m.r) : (W - m.l - m.r) / 2);
  const yv = (v: number) => m.t + (1 - v / maxVal) * (H - m.t - m.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxVal);

  function toggle(code: string) {
    setSelected(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  }
  const selectOne = (code: string) => setSelected([code]);

  const seg = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${on ? "bg-ink text-paper" : "text-muted hover:bg-ink/5 hover:text-ink"}`;
  const hoverYear = hover !== null ? yrs[hover] : null;

  const summary = visible.map((l) => {
    const a = l.values[yrs[0]];
    const b = l.values[yrs[yrs.length - 1]];
    return { ...l, a, b, change: a && b && unit !== "share" ? b / a - 1 : null };
  });

  return (
    <div>
      {/* filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex gap-0.5 rounded-xl border border-line bg-surface p-0.5" role="group" aria-label="O que mostrar">
          <button type="button" onClick={() => setMetric("expense")} className={seg(metric === "expense")}>Para onde vai</button>
          <button type="button" onClick={() => setMetric("revenue")} className={seg(metric === "revenue")}>De onde vem</button>
        </div>
        <div className="flex gap-0.5 rounded-xl border border-line bg-surface p-0.5" role="group" aria-label="Unidade">
          <button type="button" onClick={() => setUnit("brl")} className={seg(unit === "brl")}>R$</button>
          <button type="button" onClick={() => setUnit("percap")} className={seg(unit === "percap")}>Por habitante</button>
          <button type="button" onClick={() => setUnit("share")} className={seg(unit === "share")}>% do total</button>
        </div>
        <div className="flex gap-0.5 rounded-xl border border-line bg-surface p-0.5" role="group" aria-label="Valores">
          <button type="button" onClick={() => setMode("real")} disabled={!Object.keys(props.deflator).length} className={seg(mode === "real")} title="Corrigidos pela inflação (IPCA) para os preços de hoje">Corrigidos (IPCA)</button>
          <button type="button" onClick={() => setMode("nominal")} className={seg(mode === "nominal")}>Nominais</button>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          De
          <select value={from} onChange={(e) => { const v = Number(e.target.value); setFrom(v); if (v >= to) setTo(Math.min(latest, v + 1)); }} className="input !w-24 !py-1.5">
            {metricYears.slice(0, -1).map((y) => <option key={y}>{y}</option>)}
          </select>
          até
          <select value={to} onChange={(e) => { const v = Number(e.target.value); setTo(v); if (v <= from) setFrom(Math.max(metricYears[0], v - 1)); }} className="input !w-24 !py-1.5">
            {metricYears.slice(1).map((y) => <option key={y}>{y}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          Detalhar
          <select value={drillCode ?? ""} onChange={(e) => drill(e.target.value || null)} className="input !w-56 !py-1.5" aria-label="Ver as subcategorias de uma categoria">
            <option value="">Categorias principais</option>
            {withKids.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          Categoria
          <select
            value={selected.length === 1 ? selected[0] : ""}
            onChange={(e) => (e.target.value ? selectOne(e.target.value) : setSelected(defaultSel))}
            className="input !w-56 !py-1.5"
            aria-label="Mostrar só uma categoria"
          >
            <option value="">Principais (padrão)</option>
            <option value={TOTAL}>{totalLabel}</option>
            {list.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </label>
      </div>

      {parentSeries && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-brand-soft/70 px-3 py-2 text-sm">
          <span>Mostrando as subcategorias de <b>{parentSeries.name}</b>.</span>
          <button type="button" onClick={() => drill(null)} className="font-semibold text-brand underline-offset-4 hover:underline">← Voltar às categorias principais</button>
        </div>
      )}

      {/* gráfico */}
      <div className="card relative p-3 sm:p-5">
        {visible.length === 0 ? (
          <p className="py-24 text-center text-sm text-muted">Selecione ao menos uma categoria na legenda abaixo.</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Gráfico de linhas da evolução do orçamento" onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={W - m.r} y1={yv(t)} y2={yv(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "3 4"} />
                <text x={m.l - 8} y={yv(t) + 4} textAnchor="end" fontSize="11" fill="var(--faint)">{short(t, unit)}</text>
              </g>
            ))}
            {yrs.map((y) => (
              <text key={y} x={x(y)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--faint)">{y}</text>
            ))}
            {hoverYear !== null && <line x1={x(hoverYear)} x2={x(hoverYear)} y1={m.t} y2={H - m.b} stroke="var(--line-strong)" />}
            {visible.map((l) => {
              const pts = yrs.filter((y) => l.values[y] != null).map((y) => `${x(y)},${yv(l.values[y] as number)}`);
              return (
                <g key={l.code}>
                  <polyline points={pts.join(" ")} fill="none" stroke={l.color} strokeWidth={l.code === TOTAL ? 3 : 2.2} strokeLinejoin="round" strokeLinecap="round" />
                  {yrs.filter((y) => l.values[y] != null).map((y) => (
                    <circle key={y} cx={x(y)} cy={yv(l.values[y] as number)} r={hoverYear === y ? 5 : 3} fill="var(--surface)" stroke={l.color} strokeWidth="2" />
                  ))}
                </g>
              );
            })}
            {/* faixas de hover por ano */}
            {yrs.map((y, i) => (
              <rect key={y} x={x(y) - (W - m.l - m.r) / Math.max(1, yrs.length - 1) / 2} y={m.t} width={(W - m.l - m.r) / Math.max(1, yrs.length - 1)} height={H - m.t - m.b} fill="transparent" onMouseEnter={() => setHover(i)} onMouseMove={() => setHover(i)} onClick={() => setHover(i)} />
            ))}
          </svg>
        )}

        {hoverYear !== null && visible.length > 0 && (
          <div className="pointer-events-none absolute right-4 top-4 max-w-[16rem] rounded-xl border border-line bg-surface/95 p-3 text-xs shadow-pop backdrop-blur">
            <p className="mb-1.5 font-bold">{hoverYear}</p>
            <ul className="space-y-1">
              {[...visible].sort((a, b) => (b.values[hoverYear] ?? 0) - (a.values[hoverYear] ?? 0)).map((l) => (
                <li key={l.code} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 flex-none rounded-full" style={{ background: l.color }} /><span className="truncate">{l.name}</span></span>
                  <b>{l.values[hoverYear] != null ? short(l.values[hoverYear] as number, unit) : "—"}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* legenda: clique liga/desliga; “só” isola */}
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Categorias no gráfico">
        {[{ code: TOTAL, name: totalLabel }, ...list].map((s) => {
          const idx = visible.findIndex((v) => v.code === s.code);
          const on = selected.includes(s.code);
          const disabled = unit === "share" && s.code === TOTAL;
          return (
            <span key={s.code} className={`inline-flex items-center overflow-hidden rounded-full border text-xs ${on && !disabled ? "border-line-strong bg-surface" : "border-line bg-surface-2 text-faint"} ${disabled ? "opacity-40" : ""}`}>
              <button type="button" disabled={disabled} onClick={() => toggle(s.code)} className="flex items-center gap-1.5 px-2.5 py-1 font-medium" aria-pressed={on}>
                <span className="h-2.5 w-2.5 rounded-full border" style={{ background: on && idx >= 0 ? visible[idx].color : "transparent", borderColor: on && idx >= 0 ? visible[idx].color : "var(--line-strong)" }} />
                {s.name}
              </button>
              <button type="button" disabled={disabled} onClick={() => selectOne(s.code)} className="border-l border-line px-2 py-1 text-faint hover:text-ink" title="Mostrar só esta categoria">só</button>
            </span>
          );
        })}
      </div>

      {/* resumo do período */}
      {summary.length > 0 && yrs.length > 1 && (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-faint">
              <tr><th className="p-3">Categoria</th><th className="p-3 text-right">{yrs[0]}</th><th className="p-3 text-right">{yrs[yrs.length - 1]}</th><th className="p-3 text-right">Variação</th></tr>
            </thead>
            <tbody>
              {summary.map((l) => (
                <tr key={l.code} className="border-b border-line last:border-0">
                  <td className="p-3"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: l.color }} />{l.name}</td>
                  <td className="p-3 text-right tabular-nums">{l.a != null ? short(l.a, unit) : "—"}</td>
                  <td className="p-3 text-right tabular-nums">{l.b != null ? short(l.b, unit) : "—"}</td>
                  <td className={`p-3 text-right font-semibold tabular-nums ${l.change === null ? "text-faint" : l.change >= 0 ? "text-ok" : "text-danger"}`}>{l.change === null ? "—" : `${l.change >= 0 ? "+" : ""}${(l.change * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-faint">
        {mode === "real" ? `Valores corrigidos pela inflação (IPCA médio anual) para os preços de ${years[years.length - 1]}.` : "Valores nominais, sem correção pela inflação — o crescimento aparente inclui a alta de preços."}{" "}
        {unit === "percap" && scope === "FEDERAL" ? "Por habitante usa a população estimada do Brasil. " : ""}{unit === "share" && parentSeries ? `A porcentagem é calculada sobre ${parentSeries.name}. ` : ""}Fonte: Tesouro Nacional (Siconfi/DCA) e IBGE (IPCA).
      </p>
    </div>
  );
}
