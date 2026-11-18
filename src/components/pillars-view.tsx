import { AskButton } from "@/components/agent/ask-button";
import { Notice, StatTile } from "@/components/ui";
import type { BudgetScope } from "@/lib/budget";
import { formatChange, formatValue } from "@/lib/indicators/format";
import { BASIS, type Basis } from "@/lib/pillar-basis";
import type { MetricResult, PillarResult, PillarsReport, Ref, Status } from "@/lib/pillars";

/* Tela do módulo Pilares: resumo, visão geral por pilar e a árvore de métricas de cada um. */

const STATUS: Record<Status, { label: string; cls: string; bar: string }> = {
  ok: { label: "Na meta", cls: "bg-ok/10 text-ok", bar: "var(--ok)" },
  perto: { label: "Perto da meta", cls: "bg-estadual-soft text-estadual", bar: "var(--estadual)" },
  longe: { label: "Longe da meta", cls: "bg-danger/10 text-danger", bar: "var(--danger)" },
  "sem-meta": { label: "Sem meta", cls: "bg-ink/5 text-muted", bar: "var(--line)" },
  contexto: { label: "Contexto", cls: "bg-ink/5 text-muted", bar: "var(--line)" },
};
const BASIS_CLS: Record<Basis, string> = {
  internacional: "border-[#1c64b8]/40 text-[#1c64b8] dark:border-[#74a9ec]/40 dark:text-[#74a9ec]",
  brasil: "border-[#0b7a5c]/40 text-[#0b7a5c] dark:border-[#4cc39b]/40 dark:text-[#4cc39b]",
  ideal: "border-line text-muted",
  estados: "border-[#8a4fd1]/40 text-[#8a4fd1] dark:border-[#b591ea]/40 dark:text-[#b591ea]",
  historico: "border-[#a66300]/40 text-[#a66300] dark:border-[#e0a64a]/40 dark:text-[#e0a64a]",
};
const LEVEL: Record<string, string> = { FEDERAL: "país", ESTADUAL: "estado", MUNICIPAL: "cidade" };

const fmt = (m: { unit: MetricResult["unit"]; decimals: number }, v: number) => formatValue(v, m.unit, m.decimals);

function BasisChip({ basis }: { basis: Basis }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-px text-[10.5px] font-semibold ${BASIS_CLS[basis]}`} title={BASIS[basis].desc}>{BASIS[basis].short}</span>;
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`inline-flex flex-none items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS[status].cls}`}>{STATUS[status].label}</span>;
}

/** Minigráfico da série com a linha da meta tracejada. */
function Spark({ m }: { m: MetricResult }) {
  const ys = Object.keys(m.series).map(Number).sort((a, b) => a - b);
  if (ys.length < 2) return <span className="text-[11px] text-faint">{ys.length === 1 ? `só ${ys[0]}` : ""}</span>;
  const W = 120, H = 34, pad = 3;
  const vals = ys.map((y) => m.series[y]);
  const all = m.target ? [...vals, m.target.value] : vals;
  const lo = Math.min(...all), hi = Math.max(...all);
  const sy = (v: number) => H - pad - ((v - lo) / (hi - lo || 1)) * (H - pad * 2);
  const sx = (y: number) => pad + ((y - ys[0]) / (ys.at(-1)! - ys[0] || 1)) * (W - pad * 2);
  const d = ys.map((y, i) => `${i ? "L" : "M"}${sx(y).toFixed(1)},${sy(m.series[y]).toFixed(1)}`).join(" ");
  const color = STATUS[m.status].bar === "var(--line)" ? "var(--muted)" : STATUS[m.status].bar;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="flex-none" role="img" aria-label={`Série de ${ys[0]} a ${ys.at(-1)}`}>
      {m.target && <line x1={pad} x2={W - pad} y1={sy(m.target.value)} y2={sy(m.target.value)} stroke="var(--faint)" strokeDasharray="3 3" strokeWidth="1" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx(ys.at(-1)!)} cy={sy(vals.at(-1)!)} r="2.6" fill={color} />
    </svg>
  );
}

function RefLine({ r, m, main }: { r: Ref; m: MetricResult; main?: boolean }) {
  return (
    <li className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:gap-2">
      <span className="flex flex-none items-center gap-1.5">
        <BasisChip basis={r.basis} />
        <b className="tabular-nums">{fmt(m, r.value)}</b>
        {main && <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">meta usada</span>}
      </span>
      <span className="text-muted">
        {r.text}
        {r.approx && " (número aproximado: vale conferir na fonte)"}
        {r.url && <> · <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">fonte ↗</a></>}
      </span>
    </li>
  );
}

function Metric({ m, scope, sub }: { m: MetricResult; scope: BudgetScope; sub?: boolean }) {
  const trend = m.trend;
  const change = trend ? formatChange(trend.value, m.value, m.unit) : null;
  return (
    <details className={`group ${sub ? "ml-3 border-l-2 border-line pl-3 sm:ml-6 sm:pl-4" : ""}`}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-2 py-2.5 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 basis-56">
          <span className={`block leading-snug ${sub ? "text-sm font-medium" : "font-semibold"}`}>{m.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-faint">
            <span>{m.year}</span>
            {m.level !== scope && <span className="rounded bg-estadual-soft px-1.5 font-semibold text-estadual">dado do {LEVEL[m.level]}</span>}
            {trend && change && (
              <span className={trend.dir === "melhor" ? "text-ok" : trend.dir === "pior" ? "text-danger" : ""}>
                {m.value > trend.value ? "↗" : m.value < trend.value ? "↘" : "→"} {trend.dir === "melhor" ? "melhorou" : trend.dir === "pior" ? "piorou" : "estável"} {change} desde {trend.year}
              </span>
            )}
          </span>
        </span>
        <span className="flex flex-none items-center gap-2 sm:gap-3">
          <span className="hidden sm:block"><Spark m={m} /></span>
          <span className="w-24 whitespace-nowrap text-right sm:w-28">
            <span className="display block text-lg font-semibold tabular-nums leading-tight">{fmt(m, m.value)}</span>
            {m.target && <span className="block text-[11px] text-faint">meta {fmt(m, m.target.value)}</span>}
          </span>
          <span className="text-right sm:w-28"><StatusPill status={m.status} /></span>
          <span aria-hidden className="text-faint transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="mb-3 ml-2 mt-1 space-y-2.5 rounded-xl bg-surface-2 p-3.5">
        <p className="text-sm leading-relaxed text-muted">{m.desc}</p>
        {m.target || m.refs.length ? (
          <ul className="space-y-2">
            {m.target && <RefLine r={m.target} m={m} main />}
            {m.refs.map((r) => <RefLine key={r.label} r={r} m={m} />)}
          </ul>
        ) : (
          <p className="text-sm text-muted">{m.status === "contexto" ? "Indicador de contexto: não há direção “melhor” nem meta; ajuda a ler os outros números." : "Sem meta oficial e sem histórico suficiente para projetar uma."}</p>
        )}
        <p className="text-xs text-faint">Fonte: {m.sourceUrl ? <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">{m.source} ↗</a> : m.source}</p>
      </div>
    </details>
  );
}

function StatusBar({ c }: { c: PillarResult["counts"] }) {
  const total = c.ok + c.perto + c.longe + c.semMeta;
  if (!total) return <div className="h-2 rounded-full bg-ink/5" />;
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-ink/5" role="img" aria-label={`${c.ok} na meta, ${c.perto} perto, ${c.longe} longe, ${c.semMeta} sem meta`}>
      {(["ok", "perto", "longe", "semMeta"] as const).map((k) => c[k] > 0 && <div key={k} style={{ width: `${(c[k] / total) * 100}%`, background: STATUS[k === "semMeta" ? "sem-meta" : k].bar, borderRight: "2px solid var(--surface)" }} />)}
    </div>
  );
}

const brlPc = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

function Overview({ r }: { r: PillarsReport }) {
  return (
    <section aria-label="Visão geral" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {r.pillars.map((p) => {
        const measured = p.counts.ok + p.counts.perto + p.counts.longe;
        return (
          <a key={p.id} href={`#${p.id}`} className="card-flat flex flex-col gap-2.5 p-4 transition-shadow hover:shadow-card">
            <span className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-semibold"><span aria-hidden className="text-xl">{p.icon}</span>{p.name}</span>
              <span className="text-xs text-faint">{p.metrics.length ? `${p.counts.ok} de ${measured || 0} na meta` : p.nationalOnly ? "só no Federal" : "sem dado aberto"}</span>
            </span>
            <StatusBar c={p.counts} />
            <span className="text-xs text-muted">{p.spend?.perCapita ? <>Gasto: <b className="text-ink">{brlPc(p.spend.perCapita)}</b> por habitante · {(p.spend.share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do orçamento</> : p.areas.length ? "Gasto da área não identificado no balanço" : "Pilar transversal (não é uma função do orçamento)"}</span>
          </a>
        );
      })}
    </section>
  );
}

function Pillar({ p, scope, place }: { p: PillarResult; scope: BudgetScope; place: string }) {
  const flat = p.metrics.flatMap((m) => [m, ...m.children]);
  return (
    <section id={p.id} className="card scroll-mt-24 p-4 sm:p-6" aria-labelledby={`${p.id}-t`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Pilar</p>
          <h2 id={`${p.id}-t`} className="display flex items-center gap-2 text-2xl font-semibold"><span aria-hidden>{p.icon}</span>{p.name}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{p.question}</p>
        </div>
        <AskButton compact focus={{ title: `Pilar ${p.name} · ${place}`, text: `Pilar ${p.name} em ${place}. ${p.question} Métricas: ${flat.map((m) => `${m.name}: ${fmt(m, m.value)} em ${m.year}${m.target ? `, meta ${fmt(m, m.target.value)} (${BASIS[m.target.basis].label}: ${m.target.text})` : ""}, situação ${STATUS[m.status].label}`).join("; ")}.${p.spend ? ` Gasto da área em ${p.spend.year}: ${(p.spend.share * 100).toFixed(1)}% do orçamento${p.spend.perCapita ? `, R$ ${p.spend.perCapita.toFixed(0)} por habitante` : ""}.` : ""}`, suggestions: ["Onde estamos piores e por quê?", "Que lugares conseguiram melhorar isso e como?", "O gasto dessa área está dando resultado?"] }} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
        <p className="rounded-xl border border-brand/25 bg-brand-soft/50 px-3.5 py-2.5 text-sm leading-relaxed"><b className="text-[11px] font-bold uppercase tracking-wide text-brand">Para quem tem menos · </b>{p.lens}</p>
        {p.spend && (
          <div className="rounded-xl border border-line px-3.5 py-2.5 text-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Quanto custa ({p.spend.year})</p>
            <p className="tabular-nums">{p.spend.perCapita ? <><b>{brlPc(p.spend.perCapita)}</b> por habitante · </> : null}{(p.spend.share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do orçamento</p>
            {p.spend.realChange5y != null && <p className="text-xs text-faint">{p.spend.realChange5y >= 0 ? "+" : "−"}{Math.abs(p.spend.realChange5y * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% em 5 anos, já descontada a inflação</p>}
          </div>
        )}
      </div>

      {p.metrics.length > 0 ? (
        <div className="mt-4 divide-y divide-line">
          {p.metrics.map((m) => (
            <div key={m.id} className="py-1">
              <Metric m={m} scope={scope} />
              {m.children.map((c) => <Metric key={c.id} m={c} scope={scope} sub />)}
            </div>
          ))}
        </div>
      ) : (
        p.nationalOnly ? <p className="mt-4 rounded-xl bg-surface-2 p-3.5 text-sm text-muted">As métricas deste pilar só existem para o país inteiro. Veja a aba <a href="?esfera=federal" className="font-semibold text-brand hover:underline">Federal</a>.</p> : <p className="mt-4 rounded-xl bg-surface-2 p-3.5 text-sm text-muted">Ainda não há, no app, um dado aberto e atualizado deste pilar para {place}. Abaixo, as métricas que deveriam ser acompanhadas e as metas de referência.</p>
      )}

      {p.gaps.length > 0 && (
        <details className="mt-4 rounded-xl border border-dashed border-line p-3.5" open={!p.metrics.length}>
          <summary className="cursor-pointer text-sm font-semibold text-muted">Métricas que ainda não medimos aqui ({p.gaps.length})</summary>
          <ul className="mt-2.5 space-y-2.5">
            {p.gaps.map((g) => (
              <li key={g.name} className="text-sm">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <b>{g.name}</b>
                  <span className="text-muted">· meta: {g.target}</span>
                  {g.basis && <BasisChip basis={g.basis} />}
                </span>
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
        <li className="pt-1 text-muted"><b className="text-ink">Situação:</b> “na meta” quando já alcançou; “perto” quando falta até 20% do valor da meta; “longe” acima disso. A tendência compara com cerca de 5 anos antes.</li>
      </ul>
    </details>
  );
}

export function PillarsDetail({ r }: { r: PillarsReport }) {
  const all = r.pillars.flatMap((p) => p.metrics.flatMap((m) => [m, ...m.children]));
  const c = { ok: all.filter((m) => m.status === "ok").length, perto: all.filter((m) => m.status === "perto").length, longe: all.filter((m) => m.status === "longe").length };
  const gaps = r.pillars.reduce((a, p) => a + p.gaps.length, 0);
  return (
    <div className="space-y-8">
      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Métricas acompanhadas" value={String(all.length)} hint={`em ${r.pillars.filter((p) => p.metrics.length).length} de ${r.pillars.length} pilares`} />
        <StatTile label="Na meta" value={String(c.ok)} tone={c.ok ? "up" : null} hint={`${c.perto} perto da meta`} />
        <StatTile label="Longe da meta" value={String(c.longe)} tone={c.longe ? "down" : null} hint="mais de 20% distante" />
        <StatTile label="Ainda sem dado" value={String(gaps)} hint="métricas mapeadas sem dado aberto" />
      </section>
      <Overview r={r} />
      <div className="space-y-5">{r.pillars.map((p) => <Pillar key={p.id} p={p} scope={r.scope} place={r.place} />)}</div>
      {r.pending > 0 && <Notice kind="info">Algumas séries ({r.pending}) ainda estão sendo preparadas e aparecem na próxima visita.</Notice>}
    </div>
  );
}

