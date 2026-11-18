"use client";

import { Fragment, useMemo, useState } from "react";
import { AskButton } from "@/components/agent/ask-button";
import { ControlBar, Segmented } from "@/components/controls";
import { InfoTip } from "@/components/info-tip";
import { Notice, StatTile } from "@/components/ui";
import type { BudgetScope } from "@/lib/budget";
import { formatChange, formatValue } from "@/lib/indicators/format";
import { BASIS, statusOf, type Basis } from "@/lib/pillar-basis";
import type { MetricResult, PillarResult, PillarsReport, Ref, Status } from "@/lib/pillars";

/*
 * Tela do módulo Pilares, no mesmo padrão de tabela de Expectativa fiscal e Inflação: barra de ajustes,
 * cabeçalho que ordena, linhas que abrem as submétricas e balão ⓘ com explicação, meta e fonte.
 */

type RefMode = "meta" | "estados" | "historico";
type Show = "todas" | "fora" | "ok";
type SCol = "name" | "n" | "ok" | "perto" | "longe" | "sem" | "pc" | "share";
type MCol = "name" | "status" | "trend";

const STATUS: Record<Status, { label: string; short: string; icon: string; cls: string; color: string; rank: number }> = {
  longe: { label: "Longe da meta", short: "longe", icon: "✗", cls: "text-danger", color: "var(--danger)", rank: 0 },
  perto: { label: "Perto da meta", short: "perto", icon: "≈", cls: "text-estadual", color: "var(--estadual)", rank: 1 },
  ok: { label: "Na meta", short: "na meta", icon: "✓", cls: "text-ok", color: "var(--ok)", rank: 2 },
  "sem-meta": { label: "Sem referência", short: "sem ref.", icon: "—", cls: "text-faint", color: "var(--muted)", rank: 3 },
  contexto: { label: "Contexto", short: "contexto", icon: "·", cls: "text-faint", color: "var(--muted)", rank: 4 },
};
const BASIS_CLS: Record<Basis, string> = {
  internacional: "border-[#1c64b8]/40 text-[#1c64b8] dark:border-[#74a9ec]/40 dark:text-[#74a9ec]",
  brasil: "border-[#0b7a5c]/40 text-[#0b7a5c] dark:border-[#4cc39b]/40 dark:text-[#4cc39b]",
  ideal: "border-line text-muted",
  estados: "border-[#8a4fd1]/40 text-[#8a4fd1] dark:border-[#b591ea]/40 dark:text-[#b591ea]",
  historico: "border-[#a66300]/40 text-[#a66300] dark:border-[#e0a64a]/40 dark:text-[#e0a64a]",
};
const LEVEL: Record<string, string> = { FEDERAL: "país", ESTADUAL: "estado", MUNICIPAL: "cidade" };
const REF_LABEL: Record<RefMode, string> = { meta: "Meta de referência", estados: "Melhor estado", historico: "Melhor histórico" };

const fmt = (m: { unit: MetricResult["unit"]; decimals: number }, v: number) => formatValue(v, m.unit, m.decimals);
const brlPc = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Referência usada para comparar: a meta principal, ou a projeção escolhida na barra de ajustes. */
const refOf = (m: MetricResult, mode: RefMode): Ref | null => (mode === "meta" ? m.target : [m.target, ...m.refs].find((r) => r?.basis === mode) ?? null);
const statusIn = (m: MetricResult, mode: RefMode): Status => {
  if (!m.better) return "contexto";
  const r = refOf(m, mode);
  return r ? statusOf(m.value, r.value, m.better, m.unit) : "sem-meta";
};
/** Distância até a referência, em fração dela (positivo = falta caminho), para ordenar. */
const gapOf = (m: MetricResult, mode: RefMode) => {
  const r = refOf(m, mode);
  if (!r || !m.better) return -Infinity;
  const d = m.better === "down" ? m.value - r.value : r.value - m.value;
  return d / Math.max(Math.abs(r.value), 1e-9);
};
const flat = (ms: MetricResult[]) => ms.flatMap((m) => [m, ...m.children]);
const countIn = (ms: MetricResult[], mode: RefMode) => {
  const c = { ok: 0, perto: 0, longe: 0, sem: 0 };
  for (const m of flat(ms)) { const s = statusIn(m, mode); if (s === "ok") c.ok++; else if (s === "perto") c.perto++; else if (s === "longe") c.longe++; else c.sem++; }
  return c;
};

function BasisChip({ basis }: { basis: Basis }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-px text-[10.5px] font-semibold ${BASIS_CLS[basis]}`} title={BASIS[basis].desc}>{BASIS[basis].short}</span>;
}

function StatusText({ s, title }: { s: Status; title?: string }) {
  return <span className={`whitespace-nowrap text-[11px] font-bold ${STATUS[s].cls}`} title={title}>{STATUS[s].icon} {STATUS[s].short}</span>;
}

/** Minigráfico da série (como na Inflação), com a referência tracejada. */
function Spark({ m, target }: { m: MetricResult; target: number | null }) {
  const ys = Object.keys(m.series).map(Number).sort((a, b) => a - b);
  if (ys.length < 2) return <span className="w-[60px] text-center text-[10px] text-faint">só {ys[0]}</span>;
  const vals = ys.map((y) => m.series[y]);
  const all = target != null ? [...vals, target] : vals;
  const lo = Math.min(...all), hi = Math.max(...all);
  const x = (i: number) => (i / (ys.length - 1)) * 56 + 2;
  const y = (v: number) => 16 - ((v - lo) / (hi - lo || 1)) * 13;
  return (
    <svg viewBox="0 0 60 18" className="h-[18px] w-[60px] flex-none" aria-hidden="true">
      {target != null && <line x1="2" x2="58" y1={y(target)} y2={y(target)} stroke="var(--faint)" strokeDasharray="2 2" strokeWidth="1" />}
      <polyline points={vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function SortHead<K extends string>({ k, label, col, setCol, align = "right", tip }: { k: K | null; label: string; col: { key: K; dir: 1 | -1 } | null; setCol: (c: { key: K; dir: 1 | -1 } | null) => void; align?: "left" | "right"; tip?: string }) {
  const on = k !== null && col?.key === k;
  return (
    <th scope="col" aria-sort={on ? (col!.dir === 1 ? "ascending" : "descending") : "none"} className={`px-2.5 py-2 font-medium ${align === "left" ? "text-left" : "text-right"}`}>
      {k === null ? <span title={tip}>{label}</span> : (
        <button type="button" title={tip ?? `Ordenar por ${label.toLowerCase()}`} onClick={() => setCol(on ? { key: k, dir: (col!.dir * -1) as 1 | -1 } : { key: k, dir: 1 })} className={`inline-flex items-center gap-1 hover:text-ink ${on ? "font-bold text-ink" : ""}`}>
          {label}
          <span aria-hidden className={`text-[10px] ${on ? "" : "opacity-30"}`}>{on ? (col!.dir === 1 ? "▲" : "▼") : "↕"}</span>
        </button>
      )}
    </th>
  );
}

/* ───────── resumo por pilar ───────── */

function SummaryTable({ r, mode }: { r: PillarsReport; mode: RefMode }) {
  const [col, setCol] = useState<{ key: SCol; dir: 1 | -1 } | null>(null);
  const rows = r.pillars.map((p) => ({ p, n: flat(p.metrics).length, ...countIn(p.metrics, mode) }));
  const val = (x: (typeof rows)[number], k: SCol): number | string | null =>
    k === "name" ? x.p.name : k === "n" ? x.n : k === "ok" ? x.ok : k === "perto" ? x.perto : k === "longe" ? x.longe : k === "sem" ? x.sem : k === "pc" ? x.p.spend?.perCapita ?? null : x.p.spend?.share ?? null;
  const sorted = col ? [...rows].sort((a, b) => {
    const x = val(a, col.key), y = val(b, col.key);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return (typeof x === "string" ? x.localeCompare(y as string, "pt-BR") : x - (y as number)) * col.dir;
  }) : rows;
  const tot = rows.reduce((a, x) => ({ n: a.n + x.n, ok: a.ok + x.ok, perto: a.perto + x.perto, longe: a.longe + x.longe, sem: a.sem + x.sem }), { n: 0, ok: 0, perto: 0, longe: 0, sem: 0 });
  const cell = (n: number, cls: string) => <td className={`px-2.5 py-2 text-right tabular-nums ${n ? `font-semibold ${cls}` : "text-faint"}`}>{n || "—"}</td>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <SortHead k="name" label="Pilar" col={col} setCol={setCol} align="left" />
            <SortHead k="n" label="Métricas" col={col} setCol={setCol} />
            <SortHead k="ok" label="✓ Na meta" col={col} setCol={setCol} />
            <SortHead k="perto" label="≈ Perto" col={col} setCol={setCol} tip="Falta até 20% do valor da referência" />
            <SortHead k="longe" label="✗ Longe" col={col} setCol={setCol} />
            <SortHead k="sem" label="Sem ref." col={col} setCol={setCol} tip="Sem meta nem projeção para comparar" />
            <th scope="col" className="px-2.5 py-2 text-left font-medium">Situação</th>
            <SortHead k="pc" label="Gasto por hab." col={col} setCol={setCol} tip="Gasto do governo nesta área por habitante (balanço anual)" />
            <SortHead k="share" label="% do orçamento" col={col} setCol={setCol} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ p, n, ok, perto, longe, sem }) => (
            <tr key={p.id} className="border-t border-line">
              <td className="px-2.5 py-2 font-medium">
                <a href={`#${p.id}`} className="flex items-center gap-2 hover:underline"><span aria-hidden>{p.icon}</span>{p.name}</a>
              </td>
              <td className="px-2.5 py-2 text-right tabular-nums">{n || <span className="text-xs text-faint">{p.nationalOnly ? "só federal" : "sem dado"}</span>}</td>
              {cell(ok, "text-ok")}
              {cell(perto, "text-estadual")}
              {cell(longe, "text-danger")}
              {cell(sem, "text-muted")}
              <td className="px-2.5 py-2">
                <div className="flex h-2 w-24 overflow-hidden rounded-full bg-ink/5" role="img" aria-label={`${ok} na meta, ${perto} perto, ${longe} longe`}>
                  {n > 0 && ([[ok, "var(--ok)"], [perto, "var(--estadual)"], [longe, "var(--danger)"], [sem, "var(--line)"]] as [number, string][]).map(([v, c], i) => v > 0 && <span key={i} style={{ width: `${(v / n) * 100}%`, background: c }} />)}
                </div>
              </td>
              <td className="px-2.5 py-2 text-right tabular-nums">{p.spend?.perCapita ? brlPc(p.spend.perCapita) : <span className="text-faint">—</span>}</td>
              <td className="px-2.5 py-2 text-right tabular-nums">{p.spend ? pct(p.spend.share) : <span className="text-faint">—</span>}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line font-semibold">
            <td className="px-2.5 py-2">Todos os pilares</td>
            <td className="px-2.5 py-2 text-right tabular-nums">{tot.n}</td>
            <td className="px-2.5 py-2 text-right tabular-nums text-ok">{tot.ok}</td>
            <td className="px-2.5 py-2 text-right tabular-nums text-estadual">{tot.perto}</td>
            <td className="px-2.5 py-2 text-right tabular-nums text-danger">{tot.longe}</td>
            <td className="px-2.5 py-2 text-right tabular-nums text-muted">{tot.sem}</td>
            <td className="px-2.5 py-2" colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ───────── tabela de métricas de um pilar ───────── */

function MetricsTable({ p, scope, place, mode, show }: { p: PillarResult; scope: BudgetScope; place: string; mode: RefMode; show: Show }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [col, setCol] = useState<{ key: MCol; dir: 1 | -1 } | null>(null);
  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const keep = (m: MetricResult) => { const s = statusIn(m, mode); return show === "todas" || (show === "ok" ? s === "ok" : s === "perto" || s === "longe"); };
  const order = (list: MetricResult[]) => {
    if (!col) return list;
    const tr = (m: MetricResult) => (m.trend ? (m.trend.dir === "melhor" ? 2 : m.trend.dir === "estavel" ? 1 : 0) : -1);
    return [...list].sort((a, b) => (col.key === "name" ? a.name.localeCompare(b.name, "pt-BR") : col.key === "status" ? STATUS[statusIn(a, mode)].rank - STATUS[statusIn(b, mode)].rank || gapOf(b, mode) - gapOf(a, mode) : tr(a) - tr(b)) * col.dir);
  };
  // um pai fica visível se ele ou alguma submétrica passa no filtro (as submétricas filtradas aparecem abertas)
  const rows = order(p.metrics.filter((m) => keep(m) || m.children.some(keep)));
  if (!rows.length) return <p className="mt-4 rounded-xl bg-surface-2 p-3.5 text-sm text-muted">Nenhuma métrica deste pilar nesse filtro.</p>;

  const line = (m: MetricResult, child: boolean, parent?: MetricResult) => {
    const kids = child ? [] : order(m.children.filter((c) => show === "todas" || keep(c)));
    const isOpen = open.has(m.id) || (show !== "todas" && kids.length > 0);
    const ref = refOf(m, mode);
    const s = statusIn(m, mode);
    const t = m.trend;
    const change = t ? formatChange(t.value, m.value, m.unit) : null;
    const others = [m.target, ...m.refs].filter((x): x is Ref => !!x && x !== ref);
    return (
      <Fragment key={`${child ? "c" : "p"}:${m.id}`}>
        <tr className={`border-t border-line ${child ? "bg-ink/[0.02]" : ""}`}>
          <td className={`w-[40%] max-w-0 px-2.5 py-2 ${child ? "pl-7" : ""}`}>
            <div className="flex min-w-0 items-start gap-1.5" title={m.name}>
              {kids.length > 0 ? (
                <button type="button" aria-expanded={isOpen} onClick={() => toggle(m.id)} className="flex min-w-0 items-start gap-1.5 text-left font-medium hover:underline">
                  <span className={`inline-block shrink-0 text-brand transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                  <span className="min-w-0 break-words">{m.name}</span>
                  <span className="shrink-0 text-[11px] font-semibold text-brand">{kids.length} sub</span>
                </button>
              ) : (
                <span className={`min-w-0 break-words ${child ? "text-muted" : "font-medium"}`}>{m.name}</span>
              )}
              <InfoTip label={`Explicação: ${m.name}`}>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-faint">O que é</span>
                <span className="mt-0.5 block">{m.desc}</span>
                {ref ? (
                  <span className="mt-1.5 block"><b>Referência ({fmt(m, ref.value)}):</b> <span className="text-muted">{ref.text}{ref.approx ? " (número aproximado)" : ""}</span>{ref.url && <> <a href={ref.url} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">fonte ↗</a></>}</span>
                ) : (
                  <span className="mt-1.5 block text-muted">{m.better ? `Sem ${mode === "meta" ? "meta oficial nem projeção" : REF_LABEL[mode].toLowerCase()} para comparar.` : "Indicador de contexto: não há direção “melhor” nem meta."}</span>
                )}
                {others.length > 0 && <span className="mt-1.5 block text-muted">Outras referências: {others.map((o) => `${o.label} ${fmt(m, o.value)}`).join(" · ")}.</span>}
                <span className="mt-1.5 block text-muted">Fonte: {m.source}{m.level !== scope ? ` · dado do ${LEVEL[m.level]}, porque não há a série para ${LEVEL[scope]}` : ""}.</span>
                <span className="mt-2 block">
                  <AskButton label="Pergunte" focus={{
                    title: `${m.name} · ${place}`,
                    text: `Pilar ${p.name}${parent ? `, dentro de "${parent.name}"` : ""}: ${m.name} em ${place} (${m.level !== scope ? `dado do ${LEVEL[m.level]}, ` : ""}${m.year}) = ${fmt(m, m.value)}.${ref ? ` Referência: ${fmt(m, ref.value)} (${BASIS[ref.basis].label}: ${ref.text}). Situação: ${STATUS[s].label}.` : ""}${t && change ? ` Em ${t.year} era ${fmt(m, t.value)} (${change}).` : ""}`,
                    suggestions: ["O que é isto, em linguagem simples?", "Que lugares melhoraram isso e como?", "O que o governo pode fazer para chegar à meta?"],
                  }} />
                </span>
              </InfoTip>
            </div>
            <div className={`mt-0.5 flex items-center gap-1.5 text-[11px] text-faint ${kids.length ? "pl-[1.1rem]" : ""}`}>
              <span>{m.year}</span>
              {m.level !== scope && <span className="rounded bg-estadual-soft px-1 font-semibold text-estadual">dado do {LEVEL[m.level]}</span>}
            </div>
          </td>
          <td className="px-2.5 py-2 text-right font-semibold tabular-nums">{fmt(m, m.value)}</td>
          <td className="px-2.5 py-2 text-right tabular-nums">{ref ? fmt(m, ref.value) : <span className="text-faint">—</span>}</td>
          <td className="px-2.5 py-2 text-right">{ref ? <BasisChip basis={ref.basis} /> : <span className="text-faint">—</span>}</td>
          <td className="px-2.5 py-2 text-right"><StatusText s={s} title={ref ? `${STATUS[s].label}: ${fmt(m, m.value)} contra ${fmt(m, ref.value)}` : undefined} /></td>
          <td className="px-2.5 py-2">
            <div className="flex items-center justify-end gap-2">
              <Spark m={m} target={ref?.value ?? null} />
              <span className={`w-[7.5rem] whitespace-nowrap text-right text-xs ${!t ? "text-faint" : t.dir === "melhor" ? "text-ok" : t.dir === "pior" ? "text-danger" : "text-muted"}`} title={t ? `${t.year}: ${fmt(m, t.value)} → ${m.year}: ${fmt(m, m.value)}` : "Sem dado de 5 anos antes"}>
                {!t || !change ? "—" : t.dir === "estavel" ? `estável desde ${t.year}` : `${m.value > t.value ? "↗" : "↘"} ${t.dir === "melhor" ? "melhorou" : "piorou"} ${change}`}
              </span>
            </div>
          </td>
        </tr>
        {isOpen && kids.map((k) => line(k, true, m))}
      </Fragment>
    );
  };

  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <SortHead k="name" label="Métrica" col={col} setCol={setCol} align="left" />
            <SortHead<MCol> k={null} label="Resultado" col={col} setCol={setCol} />
            <SortHead<MCol> k={null} label={mode === "meta" ? "Meta" : REF_LABEL[mode]} col={col} setCol={setCol} tip="Valor de comparação escolhido na barra de ajustes" />
            <SortHead<MCol> k={null} label="Origem" col={col} setCol={setCol} tip="De onde vem o número de comparação" />
            <SortHead k="status" label="Situação" col={col} setCol={setCol} tip="Ordena da mais distante da referência para a mais próxima" />
            <SortHead k="trend" label="Tendência (5 anos)" col={col} setCol={setCol} tip="Comparação com cerca de 5 anos antes" />
          </tr>
        </thead>
        <tbody>{rows.map((m) => line(m, false))}</tbody>
      </table>
    </div>
  );
}

function PillarSection({ p, scope, place, mode, show }: { p: PillarResult; scope: BudgetScope; place: string; mode: RefMode; show: Show }) {
  const c = countIn(p.metrics, mode);
  const all = flat(p.metrics);
  return (
    <section id={p.id} className="card scroll-mt-24 p-4 sm:p-6" aria-labelledby={`${p.id}-t`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Pilar</p>
          <h2 id={`${p.id}-t`} className="display flex items-center gap-2 text-2xl font-semibold"><span aria-hidden>{p.icon}</span>{p.name}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{p.question}</p>
        </div>
        <AskButton compact focus={{ title: `Pilar ${p.name} · ${place}`, text: `Pilar ${p.name} em ${place}. ${p.question} Métricas: ${all.map((m) => { const r = refOf(m, mode); return `${m.name}: ${fmt(m, m.value)} em ${m.year}${r ? `, referência ${fmt(m, r.value)} (${BASIS[r.basis].label})` : ""}, ${STATUS[statusIn(m, mode)].label}`; }).join("; ")}.${p.spend ? ` Gasto da área em ${p.spend.year}: ${pct(p.spend.share)} do orçamento${p.spend.perCapita ? `, ${brlPc(p.spend.perCapita)} por habitante` : ""}.` : ""}`, suggestions: ["Onde estamos piores e por quê?", "Que lugares conseguiram melhorar isso e como?", "O gasto dessa área está dando resultado?"] }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
        {all.length > 0 && <span><span className="font-semibold text-ok">✓ {c.ok} na meta</span> · <span className="font-semibold text-estadual">≈ {c.perto} perto</span> · <span className="font-semibold text-danger">✗ {c.longe} longe</span>{c.sem ? ` · ${c.sem} sem referência` : ""}</span>}
        {p.spend && <span>Gasto em {p.spend.year}: {p.spend.perCapita ? <><b className="text-ink">{brlPc(p.spend.perCapita)}</b> por habitante · </> : null}{pct(p.spend.share)} do orçamento{p.spend.realChange5y != null && ` · ${p.spend.realChange5y >= 0 ? "+" : "−"}${Math.abs(p.spend.realChange5y * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% em 5 anos, já descontada a inflação`}</span>}
      </div>
      <p className="mt-2 rounded-xl border border-brand/25 bg-brand-soft/50 px-3.5 py-2 text-sm leading-relaxed"><b className="text-[11px] font-bold uppercase tracking-wide text-brand">Para quem tem menos · </b>{p.lens}</p>

      {all.length > 0 ? <MetricsTable p={p} scope={scope} place={place} mode={mode} show={show} /> : p.nationalOnly ? (
        <p className="mt-4 rounded-xl bg-surface-2 p-3.5 text-sm text-muted">As métricas deste pilar só existem para o país inteiro. Veja a aba <a href="?esfera=federal" className="font-semibold text-brand hover:underline">Federal</a>.</p>
      ) : (
        <p className="mt-4 rounded-xl bg-surface-2 p-3.5 text-sm text-muted">Ainda não há, no app, um dado aberto e atualizado deste pilar para {place}. Abaixo, as métricas que deveriam ser acompanhadas e as metas de referência.</p>
      )}

      {p.gaps.length > 0 && (
        <details className="mt-3 rounded-xl border border-dashed border-line p-3.5" open={!all.length}>
          <summary className="cursor-pointer text-sm font-semibold text-muted">Métricas que ainda não medimos aqui ({p.gaps.length})</summary>
          <ul className="mt-2.5 space-y-2.5">
            {p.gaps.map((g) => (
              <li key={g.name} className="text-sm">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1"><b>{g.name}</b><span className="text-muted">· meta: {g.target}</span>{g.basis && <BasisChip basis={g.basis} />}</span>
                <span className="block text-muted">{g.why} <span className="text-faint">Fonte: {g.url ? <a href={g.url} target="_blank" rel="noreferrer" className="hover:underline">{g.source} ↗</a> : g.source}.</span></span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export function PillarsLegend() {
  return (
    <details className="card-flat group mb-6 p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="font-semibold">De onde vêm as metas</span>
          <span className="mt-1 block text-sm text-muted">Toda meta diz de onde veio. Quando não existe meta oficial, projetamos uma a partir do que já foi alcançado no Brasil.</span>
        </span>
        <span className="mt-1 flex-none text-sm font-semibold text-brand group-open:hidden">Entender ▾</span>
        <span className="mt-1 hidden flex-none text-sm font-semibold text-brand group-open:inline">Fechar ▴</span>
      </summary>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed">
        {(Object.keys(BASIS) as Basis[]).map((b) => (
          <li key={b} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
            <span className="w-36 flex-none"><BasisChip basis={b} /></span>
            <span className="text-muted"><b className="text-ink">{BASIS[b].label}.</b> {BASIS[b].desc}</span>
          </li>
        ))}
        <li className="pt-1 text-muted"><b className="text-ink">Situação:</b> “na meta” quando já alcançou; “perto” quando falta até 20% do valor da referência; “longe” acima disso. A tendência compara com cerca de 5 anos antes.</li>
      </ul>
    </details>
  );
}

export function PillarsDetail({ r }: { r: PillarsReport }) {
  const [mode, setMode] = useState<RefMode>("meta");
  const [show, setShow] = useState<Show>("todas");
  const all = useMemo(() => r.pillars.flatMap((p) => flat(p.metrics)), [r]);
  const c = countIn(r.pillars.flatMap((p) => p.metrics), mode);
  const gaps = r.pillars.reduce((a, p) => a + p.gaps.length, 0);
  const avail = (m: RefMode) => all.filter((x) => refOf(x, m)).length;
  return (
    <div className="space-y-8">
      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Métricas acompanhadas" value={String(all.length)} hint={`em ${r.pillars.filter((p) => p.metrics.length).length} de ${r.pillars.length} pilares`} />
        <StatTile label="Na meta" value={String(c.ok)} tone={c.ok ? "up" : null} hint={`${c.perto} perto da meta`} />
        <StatTile label="Longe da meta" value={String(c.longe)} tone={c.longe ? "down" : null} hint="mais de 20% distante" />
        <StatTile label="Ainda sem dado" value={String(gaps)} hint="métricas mapeadas sem dado aberto" />
      </section>

      <section aria-label="Resumo por pilar">
        <ControlBar
          summary={`${REF_LABEL[mode]} · ${show === "todas" ? "todas as métricas" : show === "fora" ? "fora da meta" : "na meta"}`}
          primary={<Segmented label="Comparar com" value={mode} onChange={setMode} options={(["meta", "estados", "historico"] as RefMode[]).map((v) => ({ v, l: REF_LABEL[v], title: v === "meta" ? "A meta usada em cada métrica (internacional, brasileira, ideal ou projeção)" : BASIS[v].desc, disabled: v !== "meta" && !avail(v) }))} />}
        >
          <Segmented label="Mostrar" value={show} onChange={setShow} options={[{ v: "todas", l: "Todas" }, { v: "fora", l: "Fora da meta" }, { v: "ok", l: "Na meta" }]} />
        </ControlBar>
        <p className="mb-3 text-xs text-muted">
          Comparando com <b className="text-ink">{mode === "meta" ? "a meta de cada métrica" : REF_LABEL[mode].toLowerCase()}</b>: <span className="text-ok">✓ {c.ok} na meta</span> · <span className="text-estadual">≈ {c.perto} perto</span> · <span className="text-danger">✗ {c.longe} longe</span>{c.sem ? ` · ${c.sem} sem referência` : ""}
        </p>
        <SummaryTable r={r} mode={mode} />
      </section>

      <div className="space-y-5">{r.pillars.map((p) => <PillarSection key={p.id} p={p} scope={r.scope} place={r.place} mode={mode} show={show} />)}</div>
      {r.pending > 0 && <Notice kind="info">Algumas séries ({r.pending}) ainda estão sendo preparadas e aparecem na próxima visita.</Notice>}
    </div>
  );
}
