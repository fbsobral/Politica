"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ControlBar, Segmented } from "@/components/controls";
import type { Part, PrimaryHistory, PrimaryYear } from "@/lib/primary";

type Unit = "real" | "nominal" | "pctrev" | "percap";
type By = "nature" | "function";
const UNIT_LABEL: Record<Unit, string> = { real: "R$ corrigidos (IPCA)", nominal: "R$ nominais", pctrev: "% da receita primária", percap: "Por habitante" };

const brl = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? "−" : "";
  const f = (n: number, u: string) => `${s}R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: n >= 100 ? 0 : n >= 10 ? 1 : 2 })} ${u}`;
  if (a >= 1e12) return f(a / 1e12, "tri");
  if (a >= 1e9) return f(a / 1e9, "bi");
  if (a >= 1e6) return f(a / 1e6, "mi");
  if (a >= 1e3) return f(a / 1e3, "mil");
  return `${s}R$ ${Math.round(a).toLocaleString("pt-BR")}`;
};
const pc = (v: number, d = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;

export function PrimaryChart({ data }: { data: PrimaryHistory }) {
  const fed = data.scope === "FEDERAL" && data.bcb.length > 0;
  const [src, setSrc] = useState<"dca" | "bcb">(data.years.length ? "dca" : "bcb");
  const [unit, setUnit] = useState<Unit>(Object.keys(data.deflator).length ? "real" : "nominal");
  const [by, setBy] = useState<By>("nature");
  const [sel, setSel] = useState<number | null>(data.years.at(-1)?.year ?? null);
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

  /** valor de um ano na unidade escolhida */
  const conv = (y: number, v: number, rev: number) => {
    if (unit === "pctrev") return rev ? (v / rev) * 100 : 0;
    const real = unit === "nominal" ? v : v * (data.deflator[y] ?? 1);
    if (unit === "percap") return data.population[y] ? real / data.population[y] : 0;
    return real;
  };
  const fmt = (v: number) => (unit === "pctrev" ? pc(v) : unit === "percap" ? `${v < 0 ? "−" : ""}R$ ${Math.abs(Math.round(v)).toLocaleString("pt-BR")}` : brl(v));

  const bars = useMemo(
    () => (src === "bcb" ? data.bcb.map((b) => ({ year: b.year, v: b.pct })) : data.years.map((y) => ({ year: y.year, v: conv(y.year, y.result, y.revenueTotal) }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src, unit, data],
  );
  const fmtBar = (v: number) => (src === "bcb" ? `${pc(v, 2)} do PIB` : fmt(v));

  /* ── gráfico de barras divergentes ── */
  const H = W < 560 ? 220 : 260;
  const m = { l: W < 560 ? 48 : 60, r: 10, t: 14, b: 26 };
  // eixo com valores redondos (ex.: 250 mi, 500 mi)
  const maxAbs = (() => {
    const raw = Math.max(1e-9, ...bars.map((b) => Math.abs(b.v))) / 1.1;
    const p10 = Math.pow(10, Math.floor(Math.log10(raw)));
    return ([1, 2, 2.5, 5, 10].map((k) => k * p10).find((v) => v >= raw) ?? raw) / 1.1;
  })();
  const hasNeg = bars.some((b) => b.v < 0), hasPos = bars.some((b) => b.v > 0);
  const top = hasPos ? maxAbs * 1.1 : maxAbs * 0.1, bot = hasNeg ? -maxAbs * 1.1 : -maxAbs * 0.1;
  const y = (v: number) => m.t + ((top - v) / (top - bot)) * (H - m.t - m.b);
  const band = (W - m.l - m.r) / Math.max(1, bars.length);
  const bw = Math.max(4, Math.min(38, band * 0.62));
  const x = (i: number) => m.l + band * i + band / 2;
  const every = Math.max(1, Math.ceil(bars.length / (W < 560 ? 6 : 14)));

  const cur = src === "dca" ? data.years.find((d) => d.year === sel) ?? data.years.at(-1) ?? null : null;
  const prev = cur ? data.years.find((d) => d.year === cur.year - 1) ?? null : null;
  const results = data.years.map((d) => d.result);
  const surplusYears = data.years.filter((d) => d.result > 0).length;

  return (
    <div>
      <ControlBar
        summary={src === "bcb" ? "Banco Central · % do PIB" : `${UNIT_LABEL[unit]} · despesa por ${by === "nature" ? "tipo de gasto" : "área"}`}
        primary={fed ? <Segmented label="Fonte" value={src} onChange={setSrc} options={[...(data.years.length ? [{ v: "dca" as const, l: `Balanço da União (${data.years[0].year}+)` }] : []), { v: "bcb" as const, l: `Setor público, ${data.bcb[0].year}+ (BC)`, title: "Resultado primário do setor público consolidado (União, estados, municípios e estatais), Banco Central" }]} /> : undefined}
      >
        {src === "dca" && <Segmented label="Unidade" value={unit} onChange={setUnit} options={(["real", "nominal", "pctrev", "percap"] as Unit[]).map((u) => ({ v: u, l: UNIT_LABEL[u], disabled: u === "real" && !Object.keys(data.deflator).length }))} />}
        {src === "dca" && <Segmented label="Despesa por" value={by} onChange={setBy} options={[{ v: "nature", l: "Tipo de gasto" }, { v: "function", l: "Área (função)" }]} />}
      </ControlBar>

      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-ok" />Superávit (sobrou dinheiro)</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-danger" />Déficit (faltou dinheiro)</span>
        {src === "dca" && <span>Toque num ano para ver o que compõe o resultado.</span>}
      </div>
      <div className="card relative p-3 sm:p-5">
        <div ref={box} className="w-full" />
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Resultado primário por ano" onMouseLeave={() => setHover(null)}>
          {[top, top / 2, 0, bot / 2, bot].filter((t, i, a) => a.indexOf(t) === i && (hasNeg || t >= 0) && (hasPos || t <= 0)).map((t) => (
            <g key={t}>
              <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--line-strong)" : "var(--line)"} strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={m.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--faint)">{fmtBar(t).replace(" do PIB", "").replace("R$ ", "")}</text>
            </g>
          ))}
          {bars.map((b, i) => {
            const on = src === "dca" && cur?.year === b.year;
            return (
              <g key={b.year} onMouseEnter={() => setHover(i)} onClick={() => src === "dca" && setSel(b.year)} className={src === "dca" ? "cursor-pointer" : undefined}>
                <rect x={x(i) - band / 2} y={m.t} width={band} height={H - m.t - m.b} fill="transparent" />
                <rect x={x(i) - bw / 2} y={b.v >= 0 ? y(b.v) : y(0)} width={bw} height={Math.max(1, Math.abs(y(b.v) - y(0)))} rx="3" fill={b.v >= 0 ? "var(--ok)" : "var(--danger)"} fillOpacity={on || hover === i ? 1 : 0.78} stroke={on ? "var(--ink)" : "none"} strokeWidth="1.5" />
                {(i % every === 0 || i === bars.length - 1) && <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--faint)">{b.year}</text>}
              </g>
            );
          })}
        </svg>
        {hover !== null && bars[hover] && (
          <div className="pointer-events-none absolute right-4 top-3 rounded-xl border border-line bg-surface/95 p-2.5 text-xs shadow-pop backdrop-blur">
            <p className="font-bold">{bars[hover].year}</p>
            <p className={bars[hover].v >= 0 ? "text-ok" : "text-danger"}><b>{bars[hover].v >= 0 ? "Superávit" : "Déficit"}</b> de {fmtBar(Math.abs(bars[hover].v))}</p>
          </div>
        )}
      </div>
      {src === "dca" && data.years.length > 1 && (
        <p className="mt-2 text-xs text-muted">
          Superávit em <b className="text-ink">{surplusYears}</b> de {data.years.length} anos · melhor ano: <b className="text-ink">{data.years[results.indexOf(Math.max(...results))].year}</b> · pior: <b className="text-ink">{data.years[results.indexOf(Math.min(...results))].year}</b>
        </p>
      )}

      {cur && <YearDetail cur={cur} prev={prev} by={by} conv={conv} fmt={fmt} />}

      {src === "dca" && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-brand">Ver todos os anos em tabela</summary>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-faint">
                <tr><th className="p-3">Ano</th><th className="p-3 text-right">Receita primária</th><th className="p-3 text-right">Despesa primária</th><th className="p-3 text-right">Resultado primário</th><th className="p-3 text-right">Juros pagos</th></tr>
              </thead>
              <tbody>
                {[...data.years].reverse().map((d) => (
                  <tr key={d.year} className="border-b border-line last:border-0">
                    <td className="p-3 font-medium">{d.year}</td>
                    <td className="p-3 text-right tabular-nums">{fmt(conv(d.year, d.revenueTotal, d.revenueTotal))}</td>
                    <td className="p-3 text-right tabular-nums">{fmt(conv(d.year, d.expenseTotal, d.revenueTotal))}</td>
                    <td className={`p-3 text-right font-semibold tabular-nums ${d.result >= 0 ? "text-ok" : "text-danger"}`}>{fmt(conv(d.year, d.result, d.revenueTotal))}</td>
                    <td className="p-3 text-right tabular-nums">{fmt(conv(d.year, d.interest, d.revenueTotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <p className="mt-3 text-xs leading-relaxed text-faint">
        {src === "bcb"
          ? "Banco Central: resultado primário do setor público consolidado (União, estados, municípios e estatais), acumulado em 12 meses até dezembro, em % do PIB. Não separa o governo federal."
          : `Cálculo do Política a partir dos balanços anuais enviados ao Tesouro (Siconfi), disponíveis desde ${data.firstAvailable ?? 2013}. Resultado primário = receita primária (líquida de deduções, sem empréstimos tomados, venda de bens e rendimentos financeiros) − despesa primária (empenhada, sem juros e amortização da dívida). Pode diferir um pouco do resultado oficial do relatório fiscal (RREO).`}
      </p>
    </div>
  );
}

function YearDetail({ cur, prev, by, conv, fmt }: { cur: PrimaryYear; prev: PrimaryYear | null; by: By; conv: (y: number, v: number, rev: number) => number; fmt: (v: number) => string }) {
  const exp = by === "nature" ? cur.expenseNature : cur.expenseFunction;
  const expPrev = prev ? (by === "nature" ? prev.expenseNature : prev.expenseFunction) : [];
  const c = (v: number) => conv(cur.year, v, cur.revenueTotal);
  const p = (v: number) => (prev ? conv(prev.year, v, prev.revenueTotal) : 0);
  const max = Math.max(cur.revenueTotal, cur.expenseTotal);
  const prevOf = (list: Part[], code: string) => list.find((x) => x.code === code)?.value;

  // o que explica a variação do resultado: Δ receita (+) e Δ despesa (−) de cada subcategoria
  const drivers = prev
    ? [
        ...cur.revenue.map((r) => ({ name: r.name, kind: "receita" as const, d: c(r.value) - p(prevOf(prev.revenue, r.code) ?? 0) })),
        ...prev.revenue.filter((r) => !cur.revenue.some((x) => x.code === r.code)).map((r) => ({ name: r.name, kind: "receita" as const, d: -p(r.value) })),
        ...exp.map((e) => ({ name: e.name, kind: "despesa" as const, d: -(c(e.value) - p(prevOf(expPrev, e.code) ?? 0)) })),
      ].filter((x) => Math.abs(x.d) > 0).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 6)
    : [];
  const dResult = prev ? c(cur.result) - p(prev.result) : null;

  const Col = ({ title, items, tone, prevItems, total }: { title: string; items: Part[]; tone: string; prevItems: Part[]; total: number }) => (
    <div>
      <p className="mb-2 flex items-baseline justify-between text-sm font-semibold"><span>{title}</span><span className="tabular-nums">{fmt(c(total))}</span></p>
      <ul className="space-y-2">
        {items.map((it) => {
          const pv = prevItems.find((x) => x.code === it.code)?.value;
          const ch = pv ? (c(it.value) / p(pv) - 1) * 100 : null;
          return (
            <li key={it.code}>
              <div className="mb-0.5 flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate">{it.name}</span>
                <span className="flex-none tabular-nums text-muted"><b className="text-ink">{fmt(c(it.value))}</b>{ch !== null && Number.isFinite(ch) && <span className="text-faint"> · {pc(ch, 0)}</span>}</span>
              </div>
              <div className="h-2 rounded-[4px] bg-line"><div className="h-2 rounded-[4px]" style={{ width: `${Math.max(1, (Math.abs(it.value) / max) * 100)}%`, background: tone }} /></div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <section className="card mt-5 p-5 sm:p-6" aria-label={`Resultado de ${cur.year}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="display text-xl font-semibold">{cur.year}: {cur.result >= 0 ? "superávit" : "déficit"} de {fmt(Math.abs(c(cur.result)))}</h3>
        {dResult !== null && <p className="text-sm text-muted">vs {prev!.year}: <b className={dResult >= 0 ? "text-ok" : "text-danger"}>{dResult >= 0 ? "▲ melhorou" : "▼ piorou"} {fmt(Math.abs(dResult))}</b></p>}
      </div>
      <p className="mt-1 text-xs text-muted">Receita primária {fmt(c(cur.revenueTotal))} − despesa primária {fmt(c(cur.expenseTotal))}. Juros da dívida, fora da conta: {fmt(c(cur.interest))}{cur.financialIncome ? `; rendimentos financeiros: ${fmt(c(cur.financialIncome))}` : ""}. Resultado com juros (nominal, aproximado): <b className="text-ink">{fmt(c(cur.result - cur.interest + cur.financialIncome))}</b>.</p>

      {drivers.length > 0 && (
        <div className="mt-4 rounded-xl bg-surface-2 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">O que mais mudou o resultado em relação a {prev!.year}</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {drivers.map((x) => (
              <li key={`${x.kind}-${x.name}`} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <span className={x.d >= 0 ? "text-ok" : "text-danger"}>{x.d >= 0 ? "▲" : "▼"}</span> {x.name}
                  <span className="text-xs text-faint"> · {x.kind === "receita" ? (x.d >= 0 ? "arrecadou mais" : "arrecadou menos") : x.d >= 0 ? "gastou menos" : "gastou mais"}</span>
                </span>
                <b className={`flex-none tabular-nums ${x.d >= 0 ? "text-ok" : "text-danger"}`}>{x.d >= 0 ? "+" : "−"}{fmt(Math.abs(x.d)).replace("−", "")}</b>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-faint">Impacto de cada subcategoria no resultado: receita maior ou despesa menor melhoram (▲); o contrário piora (▼).</p>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Col title="Receitas primárias" items={cur.revenue} tone="var(--municipal)" prevItems={prev?.revenue ?? []} total={cur.revenueTotal} />
        <Col title={`Despesas primárias · por ${by === "nature" ? "tipo de gasto" : "área"}`} items={exp} tone="var(--estadual)" prevItems={expPrev} total={cur.expenseTotal} />
      </div>
      {cur.excluded.length > 0 && (
        <p className="mt-4 text-xs leading-relaxed text-faint">Fora da conta primária: {cur.excluded.map((e) => `${e.name} (${fmt(c(e.value))})`).join("; ")}.</p>
      )}
    </section>
  );
}
