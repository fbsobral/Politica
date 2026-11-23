"use client";

import { Fragment, useState } from "react";
import { AskButton } from "@/components/agent/ask-button";
import { ControlBar, Segmented } from "@/components/controls";
import { InfoTip } from "@/components/info-tip";
import { IndicatorChart, type ChartSeries } from "@/components/indicator-chart";
import type { GdpData, GdpRow, GdpView } from "@/lib/gdp";

const quarterLabel = (q: number) => (q === 1 ? "1º tri" : `1º–${q}º tri`);

/* PIB por setor: tabela no padrão de Inflação e Expectativa fiscal (ajustes, colunas que ordenam, linhas que abrem). */

type Metric = "acc" | "yoy" | "last4";
type Col = "name" | "share" | "value" | "contrib" | "prev";

const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`);
const pp = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`);
const share = (v: number | null) => (v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const tone = (v: number | null | undefined, invert = false) => (v == null || Math.abs(v) < 0.05 ? "text-muted" : (v > 0) !== invert ? "text-ok" : "text-danger");

function Spark({ q }: { q: GdpRow["quarters"] }) {
  if (q.length < 2) return null;
  const vs = q.map((x) => x.v);
  const lo = Math.min(0, ...vs), hi = Math.max(0, ...vs);
  const y = (v: number) => 16 - ((v - lo) / (hi - lo || 1)) * 14;
  const pts = vs.map((v, i) => `${(i / (vs.length - 1)) * 56 + 2},${y(v)}`).join(" ");
  return (
    <svg viewBox="0 0 60 18" className="h-[18px] w-[60px] flex-none" aria-hidden>
      <line x1="2" x2="58" y1={y(0)} y2={y(0)} stroke="var(--line)" strokeWidth="1" />
      <polyline points={pts} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function GdpTable({ d }: { d: GdpData }) {
  const [view, setView] = useState<GdpView>("oferta");
  const [metric, setMetric] = useState<Metric>("acc");
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [col, setCol] = useState<{ key: Col; dir: 1 | -1 } | null>(null);
  const L = d.latest;
  const prevYear = L.year - 1;
  const METRIC: Record<Metric, { label: string; head: string; tip: string }> = {
    acc: { label: `Acumulado em ${L.year}`, head: `${L.year} (${quarterLabel(L.q)})`, tip: `Crescimento real de ${quarterLabel(L.q)} de ${L.year} contra o mesmo período de ${prevYear}` },
    yoy: { label: "Último trimestre", head: `${L.q}º tri/${String(L.year).slice(2)}`, tip: `${L.q}º trimestre de ${L.year} contra o ${L.q}º trimestre de ${prevYear}` },
    last4: { label: "4 trimestres", head: "4 trimestres", tip: "Últimos 4 trimestres contra os 4 anteriores" },
  };
  const rows = view === "oferta" ? d.supply : d.demand;
  const val = (r: GdpRow) => r[metric];
  // contribuição aproximada para o crescimento do PIB: peso × crescimento (importações entram com sinal negativo)
  const contrib = (r: GdpRow) => (r.share == null || val(r) == null ? null : r.share * val(r)! * (r.code === 93408 ? -1 : 1));
  const get = (r: GdpRow, k: Col): number | string | null => (k === "name" ? r.name : k === "share" ? r.share : k === "value" ? val(r) : k === "contrib" ? contrib(r) : r.annual[prevYear] ?? null);
  const order = (list: GdpRow[]) => (!col ? list : [...list].sort((a, b) => {
    const x = get(a, col.key), y = get(b, col.key);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (typeof x === "string" ? x.localeCompare(y as string, "pt-BR") : x - (y as number)) * col.dir;
  }));
  const top = order(rows.filter((r) => !r.parent));
  const kids = (r: GdpRow) => order(rows.filter((k) => k.parent === r.code));
  const toggle = (c: number) => setOpen((o) => { const n = new Set(o); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const heads: [Col | null, string, string?][] = [
    ["name", view === "oferta" ? "Setor" : "Componente"],
    ["share", view === "oferta" ? "Peso" : "Peso no PIB", "Participação nos últimos 4 trimestres, em valores correntes"],
    ["value", METRIC[metric].head, METRIC[metric].tip],
    ["contrib", "Contribuição", "Quanto o setor puxou (ou segurou) o crescimento do PIB: peso × crescimento, em pontos percentuais (aproximação)"],
    ["prev", String(prevYear), `Crescimento no ano fechado de ${prevYear}`],
    [null, "Últimos 12 trimestres", "Crescimento de cada trimestre contra o mesmo trimestre do ano anterior"],
  ];

  const line = (r: GdpRow, child: boolean) => {
    const ks = child ? [] : kids(r);
    const isOpen = open.has(r.code);
    const inv = r.code === 93408; // importações: crescer reduz o PIB
    return (
      <Fragment key={r.code}>
        <tr className={`border-t border-line ${child ? "bg-ink/[0.02]" : ""}`}>
          <td className={`w-[34%] max-w-0 px-2.5 py-2 ${child ? "pl-7 text-muted" : "font-medium"}`}>
            <div className="flex min-w-0 items-center gap-1.5" title={r.name}>
              {ks.length > 0 ? (
                <button type="button" aria-expanded={isOpen} onClick={() => toggle(r.code)} className="flex min-w-0 items-center gap-1.5 text-left hover:underline">
                  <span className={`inline-block shrink-0 text-brand transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                  <span className="truncate">{r.name}</span>
                  <span className="shrink-0 text-[11px] font-semibold text-brand">{ks.length} sub</span>
                </button>
              ) : <span className="truncate">{r.name}</span>}
              <InfoTip label={`Explicação: ${r.name}`}>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-faint">O que é</span>
                <span className="mt-0.5 block">{r.desc}</span>
                <span className="mt-1.5 block text-muted">Acumulado em {L.year} ({quarterLabel(L.q)}): {pct(r.acc)} · {L.q}º trimestre: {pct(r.yoy)} · 4 trimestres: {pct(r.last4)} · {prevYear}: {pct(r.annual[prevYear])}. Fonte: IBGE, Contas Nacionais Trimestrais (tabelas 5932 e 1846).</span>
                <span className="mt-2 block">
                  <AskButton label="Pergunte" focus={{ title: `${r.name} · PIB`, text: `${r.name} no PIB do Brasil (Contas Trimestrais do IBGE). Peso: ${share(r.share)}. Crescimento real acumulado em ${L.year} até o ${L.q}º trimestre contra o mesmo período de ${prevYear}: ${pct(r.acc)}; ${L.q}º trimestre contra o mesmo trimestre do ano anterior: ${pct(r.yoy)}; últimos 4 trimestres: ${pct(r.last4)}; ano de ${prevYear}: ${pct(r.annual[prevYear])}; ${prevYear - 1}: ${pct(r.annual[prevYear - 1])}.`, suggestions: ["Por que esse setor cresceu ou caiu?", "Quanto ele pesa no emprego e na renda?", "O que isso significa para o ano?"] }} />
                </span>
              </InfoTip>
            </div>
          </td>
          <td className="px-2.5 py-2 text-right tabular-nums text-muted">{share(r.share)}</td>
          <td className={`px-2.5 py-2 text-right font-semibold tabular-nums ${tone(val(r), inv)}`}>{pct(val(r))}</td>
          <td className={`px-2.5 py-2 text-right tabular-nums ${tone(contrib(r))}`}>{pp(contrib(r))}</td>
          <td className={`px-2.5 py-2 text-right tabular-nums ${tone(r.annual[prevYear], inv)}`}>{pct(r.annual[prevYear])}</td>
          <td className="px-2.5 py-2"><div className="flex justify-end"><Spark q={r.quarters} /></div></td>
        </tr>
        {isOpen && ks.map((k) => line(k, true))}
      </Fragment>
    );
  };

  return (
    <div>
      <ControlBar
        summary={`${view === "oferta" ? "Setores" : "Gastos"} · ${METRIC[metric].label}`}
        primary={<Segmented label="Ótica" value={view} onChange={(v) => { setView(v); setOpen(new Set()); setCol(null); }} options={[{ v: "oferta", l: "Setores (quem produz)" }, { v: "demanda", l: "Gastos (quem compra)" }]} />}
      >
        <Segmented label="Comparar" value={metric} onChange={setMetric} options={(["acc", "yoy", "last4"] as Metric[]).map((m) => ({ v: m, l: METRIC[m].label, title: METRIC[m].tip }))} />
      </ControlBar>
      <p className="mb-3 text-xs text-muted">
        PIB: <b className="text-ink">{pct(d.pib[metric])}</b> ({METRIC[metric].tip.toLowerCase()}). Verde: cresceu; vermelho: caiu{view === "demanda" ? " (nas importações, crescer reduz o PIB)" : ""}.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="text-xs text-muted">
              {heads.map(([k, label, tip]) => {
                const on = k !== null && col?.key === k;
                return (
                  <th key={label} scope="col" aria-sort={on ? (col!.dir === 1 ? "ascending" : "descending") : "none"} className={`px-2.5 py-2 font-medium ${k === "name" ? "text-left" : "text-right"}`}>
                    {k === null ? <span title={tip}>{label}</span> : (
                      <button type="button" title={tip ?? `Ordenar por ${label.toLowerCase()}`} onClick={() => setCol(on ? { key: k, dir: (col!.dir * -1) as 1 | -1 } : { key: k, dir: -1 })} className={`inline-flex items-center gap-1 hover:text-ink ${on ? "font-bold text-ink" : ""}`}>
                        {label}<span aria-hidden className={`text-[10px] ${on ? "" : "opacity-30"}`}>{on ? (col!.dir === 1 ? "▲" : "▼") : "↕"}</span>
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>{top.map((r) => line(r, false))}</tbody>
          <tfoot>
            <tr className="border-t-2 border-line font-semibold">
              <td className="px-2.5 py-2">PIB</td>
              <td className="px-2.5 py-2 text-right text-muted">100%</td>
              <td className={`px-2.5 py-2 text-right tabular-nums ${tone(d.pib[metric])}`}>{pct(d.pib[metric])}</td>
              <td className="px-2.5 py-2" />
              <td className={`px-2.5 py-2 text-right tabular-nums ${tone(d.pib.annual[prevYear])}`}>{pct(d.pib.annual[prevYear])}</td>
              <td className="px-2.5 py-2"><div className="flex justify-end"><Spark q={d.pib.quarters} /></div></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-faint">Crescimento em volume (já descontada a inflação). O IBGE só publica o PIB trimestral do Brasil inteiro e não abre a agropecuária em lavouras e pecuária no trimestral. A contribuição é uma aproximação (peso em valores correntes × crescimento em volume).</p>
    </div>
  );
}

const COLORS: Record<number, string> = { 90707: "#17407f", 90687: "#2b8a3e", 90691: "#b86e00", 90696: "#7048e8", 93404: "#c2255c", 93406: "#0b7285", 93407: "#e0a800" };

/** Crescimento de cada ano fechado (e o acumulado do ano corrente, parcial) dos setores principais. */
export function GdpYears({ d }: { d: GdpData }) {
  const [view, setView] = useState<GdpView>("oferta");
  const [years, setYears] = useState(10);
  const L = d.latest;
  const list = [d.pib, ...(view === "oferta" ? d.supply.filter((r) => [90687, 90691, 90696].includes(r.code)) : d.demand.filter((r) => [93404, 93406, 93407].includes(r.code)))];
  const from = L.year - years;
  const series: ChartSeries[] = list.map((r) => {
    const values: Record<number, number> = {};
    for (const [y, v] of Object.entries(r.annual)) if (Number(y) >= from) values[Number(y)] = v;
    if (L.q < 4 && r.acc != null) values[L.year] = r.acc;
    return { name: r.name, color: COLORS[r.code] ?? "#868e96", values, partial: L.q < 4 ? { year: L.year, label: quarterLabel(L.q), prev: null } : null };
  });
  return (
    <div>
      <ControlBar summary={`${view === "oferta" ? "Setores" : "Gastos"} · ${years} anos`} primary={<Segmented label="Ótica" value={view} onChange={setView} options={[{ v: "oferta", l: "Setores" }, { v: "demanda", l: "Gastos" }]} />}>
        <Segmented label="Período" value={String(years)} onChange={(v) => setYears(Number(v))} options={["5", "10", "20", "29"].map((v) => ({ v, l: v === "29" ? "Desde 1997" : `${v} anos` }))} />
      </ControlBar>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">{series.map((s) => <span key={s.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span>)}</div>
      <IndicatorChart series={series} unit="pct" decimals={1} height={240} />
      <p className="mt-1 text-[11px] text-faint">Crescimento real de cada ano. {L.q < 4 ? `${L.year}: acumulado até o ${L.q}º trimestre, contra o mesmo período de ${L.year - 1}.` : ""}</p>
    </div>
  );
}
