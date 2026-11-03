"use client";

import { useMemo, useState } from "react";
import type { PlanItem, Projection } from "@/lib/fiscal";

type Scope = "MUNICIPAL" | "ESTADUAL" | "FEDERAL";
type View = "expense" | "revenue" | "nature";
type Stage = "done" | "liquidated" | "paid";
type Base = "updated" | "initial";
type Show = "brl" | "pct";
type Sort = "size" | "high" | "low" | "dev";

const FILL: Record<Scope, string> = { MUNICIPAL: "var(--municipal)", ESTADUAL: "var(--estadual)", FEDERAL: "var(--federal)" };
const SOFT: Record<Scope, string> = { MUNICIPAL: "var(--municipal-soft)", ESTADUAL: "var(--estadual-soft)", FEDERAL: "var(--federal-soft)" };
const MONTH = ["", "fevereiro", "abril", "junho", "agosto", "outubro", "dezembro"];

const brl = (v: number) => {
  const a = Math.abs(v);
  const f = (n: number, u: string) => `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: n >= 100 ? 0 : n >= 10 ? 1 : 2 })} ${u}`;
  if (a >= 1e12) return f(v / 1e12, "tri");
  if (a >= 1e9) return f(v / 1e9, "bi");
  if (a >= 1e6) return f(v / 1e6, "mi");
  if (a >= 1e3) return f(v / 1e3, "mil");
  return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
};
const pc = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: n < 0.1 ? 1 : 0 })}%`;

export type PlanChartProps = {
  scope: Scope;
  year: number;
  period: number;
  plan: { expense: PlanItem[]; revenue: PlanItem[]; nature: PlanItem[] };
  /** projeção do fechamento por "<visão>:<código>" (empenho ou arrecadação) */
  projection?: Record<string, Projection>;
};

const TOL = 0.05;

/** Previsto x realizado do ano corrente por categoria, com detalhamento por subcategoria. */
export function BudgetPlanChart({ scope, year, period, plan, projection }: PlanChartProps) {
  const views = (["expense", "revenue", "nature"] as View[]).filter((v) => plan[v]?.length);
  const [view, setView] = useState<View>(views[0] ?? "expense");
  const [stage, setStage] = useState<Stage>("done");
  const [base, setBase] = useState<Base>(projection ? "initial" : "updated");
  const [show, setShow] = useState<Show>("brl");
  const [sort, setSort] = useState<Sort>(projection ? "dev" : "size");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const isExp = view !== "revenue";
  const all = plan[view] ?? [];
  const parent = openCode ? all.find((i) => i.code === openCode) ?? null : null;
  const items = parent?.children ?? all;
  const hasLiq = isExp && all.some((i) => i.liquidated !== undefined);
  const hasPaid = isExp && all.some((i) => i.paid !== undefined);
  const st: Stage = !isExp ? "done" : stage === "liquidated" && !hasLiq ? "done" : stage === "paid" && !hasPaid ? "done" : stage;

  const doneOf = (i: PlanItem) => (st === "liquidated" ? i.liquidated ?? 0 : st === "paid" ? i.paid ?? 0 : i.done);
  const baseOf = (i: PlanItem) => (base === "initial" ? i.initial : i.updated);
  const rate = (i: PlanItem) => (baseOf(i) > 0 ? doneOf(i) / baseOf(i) : null);
  const pace = period / 6; // fração do ano já decorrida no bimestre
  // projeção só existe para o empenho/arrecadação; comparada sempre com a LOA (previsto inicial)
  const projOf = (i: PlanItem) => (st === "done" ? projection?.[`${view}:${i.code}`] : undefined);
  const devOf = (i: PlanItem) => {
    const p = projOf(i);
    return p && i.initial > 0 ? p.value / i.initial - 1 : null;
  };

  const rows = useMemo(() => {
    const list = items.filter((i) => baseOf(i) > 0 || doneOf(i) > 0);
    const r = (i: PlanItem) => rate(i) ?? -1;
    if (sort === "high") return [...list].sort((a, b) => r(b) - r(a));
    if (sort === "low") return [...list].sort((a, b) => r(a) - r(b));
    if (sort === "dev") return [...list].sort((a, b) => Math.abs(devOf(b) ?? 0) - Math.abs(devOf(a) ?? 0) || baseOf(b) - baseOf(a));
    return [...list].sort((a, b) => baseOf(b) - baseOf(a) || doneOf(b) - doneOf(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sort, base, st]);

  const max = Math.max(1, ...rows.map((i) => Math.max(baseOf(i), doneOf(i), projOf(i)?.value ?? 0)));
  const maxPct = Math.max(1, ...rows.map((i) => Math.max(rate(i) ?? 0, baseOf(i) > 0 && projOf(i) ? projOf(i)!.value / baseOf(i) : 0)));
  const tot = rows.reduce((a, i) => ({ b: a.b + baseOf(i), d: a.d + doneOf(i) }), { b: 0, d: 0 });

  const doneLabel = !isExp ? "Arrecadado" : st === "liquidated" ? "Liquidado" : st === "paid" ? "Pago" : "Empenhado";
  const baseLabel = !isExp ? (base === "initial" ? "Previsão inicial" : "Previsão atualizada") : base === "initial" ? "Dotação inicial" : "Dotação atualizada";
  const catLabel = view === "expense" ? (parent ? "subfunção" : "função") : view === "revenue" ? (parent ? "desdobramento" : "origem") : "tipo de gasto";

  const seg = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${on ? "bg-ink text-paper" : "text-muted hover:bg-ink/5 hover:text-ink"}`;
  const pick = (v: View) => {
    setView(v);
    setOpenCode(null);
  };

  if (!views.length) return <p className="text-sm text-muted">O relatório bimestral deste ente não trouxe o detalhamento por categoria.</p>;

  return (
    <div>
      {/* filtros em uma linha */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <div className="flex gap-0.5 rounded-xl border border-line bg-surface p-0.5" role="group" aria-label="O que mostrar">
          {views.includes("expense") && <button type="button" onClick={() => pick("expense")} className={seg(view === "expense")}>Para onde vai</button>}
          {views.includes("revenue") && <button type="button" onClick={() => pick("revenue")} className={seg(view === "revenue")}>De onde vem</button>}
          {views.includes("nature") && <button type="button" onClick={() => pick("nature")} className={seg(view === "nature")}>Em que se gasta</button>}
        </div>
        {isExp && (hasLiq || hasPaid) && (
          <div className="flex gap-0.5 rounded-xl border border-line bg-surface p-0.5" role="group" aria-label="Estágio da despesa">
            <button type="button" onClick={() => setStage("done")} className={seg(st === "done")} title="Valor reservado para o gasto (contratado)">Empenhado</button>
            {hasLiq && <button type="button" onClick={() => setStage("liquidated")} className={seg(st === "liquidated")} title="Serviço ou bem já entregue e conferido">Liquidado</button>}
            {hasPaid && <button type="button" onClick={() => setStage("paid")} className={seg(st === "paid")} title="Dinheiro que já saiu do caixa">Pago</button>}
          </div>
        )}
        <div className="flex gap-0.5 rounded-xl border border-line bg-surface p-0.5" role="group" aria-label="Previsto">
          <button type="button" onClick={() => setBase("updated")} className={seg(base === "updated")} title="Inclui os créditos e ajustes feitos durante o ano">Previsto atualizado</button>
          <button type="button" onClick={() => setBase("initial")} className={seg(base === "initial")} title="Como aprovado na lei orçamentária (LOA)">Previsto na LOA</button>
        </div>
        <div className="flex gap-0.5 rounded-xl border border-line bg-surface p-0.5" role="group" aria-label="Unidade">
          <button type="button" onClick={() => setShow("brl")} className={seg(show === "brl")}>R$</button>
          <button type="button" onClick={() => setShow("pct")} className={seg(show === "pct")}>% executado</button>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Ordenar
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input !w-52 !py-1.5">
            <option value="size">Maior previsto</option>
            <option value="high">Mais executado</option>
            <option value="low">Menos executado</option>
            {projection && <option value="dev">Maior desvio da LOA</option>}
          </select>
        </label>
      </div>

      {/* trilha de navegação */}
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {parent ? (
          <>
            <button type="button" onClick={() => setOpenCode(null)} className="font-semibold text-brand underline-offset-4 hover:underline">← Todas as categorias</button>
            <span className="text-faint">›</span>
            <b>{parent.name}</b>
            <span className="text-xs text-muted">· {brl(doneOf(parent))} de {brl(baseOf(parent))}{baseOf(parent) > 0 ? ` (${pc(doneOf(parent) / baseOf(parent))})` : ""}</span>
          </>
        ) : (
          <span className="text-xs text-muted">Toque numa categoria com ▸ para ver as subcategorias.</span>
        )}
      </div>

      {/* legenda */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm" style={{ background: SOFT[scope], boxShadow: "inset 0 0 0 1px var(--line-strong)" }} />{baseLabel}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-sm" style={{ background: FILL[scope] }} />{doneLabel} até {MONTH[period]}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 bg-ink" />Ritmo esperado ({pc(pace)} do ano)</span>
        {projection && st === "done" && period < 6 && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 bg-surface" style={{ borderColor: FILL[scope] }} />Projeção do fechamento</span>}
      </div>

      <div className="card p-4 sm:p-5">
        <ul className="space-y-3.5" role="list">
          {rows.map((i) => {
            const b = baseOf(i);
            const d = doneOf(i);
            const r = rate(i);
            const kids = !parent && i.children?.length ? i.children.length : 0;
            const scale = show === "pct" ? maxPct : max;
            const trackW = show === "pct" ? (b > 0 ? 1 / scale : 0) : b / scale;
            const fillW = show === "pct" ? (r ?? 0) / scale : d / scale;
            const paceX = show === "pct" ? pace / scale : (b * pace) / scale;
            const behind = r !== null && r < pace * 0.75;
            const over = r !== null && r > 1;
            const on = hover === i.code;
            const p = projOf(i);
            const dev = devOf(i);
            const projX = p ? (show === "pct" ? (b > 0 ? p.value / b / scale : null) : p.value / scale) : null;
            const status = dev === null ? null : Math.abs(dev) <= TOL ? "segue" : dev > 0 ? "acima" : "abaixo";
            // receita abaixo da LOA e despesa acima dela são os desvios que pedem atenção
            const bad = status !== null && status !== "segue" && (isExp ? status === "acima" : status === "abaixo");
            const Row = kids ? "button" : "div";
            return (
              <li key={i.code} className="relative" onMouseEnter={() => setHover(i.code)} onMouseLeave={() => setHover((h) => (h === i.code ? null : h))}>
                <Row
                  {...(kids ? { type: "button" as const, onClick: () => setOpenCode(i.code), "aria-label": `${i.name}: ver ${kids} subcategorias` } : {})}
                  className={`block w-full rounded-lg px-1.5 py-1 text-left ${kids ? "cursor-pointer hover:bg-ink/5" : ""} ${on ? "bg-ink/[0.03]" : ""}`}
                >
                  <div className="mb-1 flex flex-col gap-x-3 text-sm sm:flex-row sm:items-baseline sm:justify-between">
                    <span className="min-w-0 truncate font-medium">
                      {kids > 0 && <span className="mr-1 text-brand">▸</span>}
                      {i.name}
                      {kids > 0 && <span className="ml-1.5 text-[11px] font-semibold text-brand">{kids} sub</span>}
                    </span>
                    <span className="flex-none text-xs text-muted">
                      <b className="text-ink">{brl(d)}</b> de {brl(b)} · <b className={over ? "text-ink" : behind ? "text-danger" : "text-ink"}>{r === null ? "—" : pc(r)}</b>
                    </span>
                  </div>
                  <div className="relative h-3.5">
                    <div className="absolute inset-y-0 left-0 rounded-[4px]" style={{ width: `${Math.min(100, trackW * 100)}%`, background: SOFT[scope], boxShadow: "inset 0 0 0 1px var(--line-strong)" }} />
                    <div className="absolute left-0 top-[3px] h-2 rounded-[4px]" style={{ width: `${Math.max(d > 0 ? 0.6 : 0, Math.min(100, fillW * 100))}%`, background: FILL[scope] }} />
                    {b > 0 && <div className="absolute -top-0.5 h-[18px] w-0.5 bg-ink" style={{ left: `calc(${Math.min(100, paceX * 100)}% - 1px)` }} />}
                    {projX !== null && period < 6 && <div className="absolute top-[1px] h-3 w-3 rounded-full border-2 bg-surface" style={{ left: `calc(${Math.min(100, projX * 100)}% - 6px)`, borderColor: FILL[scope] }} />}
                  </div>
                  {status && (
                    <p className={`mt-1 text-[11px] font-semibold ${status === "segue" ? "text-ok" : bad ? "text-danger" : "text-muted"}`}>
                      {status === "segue" ? "✓ Segue a LOA" : `${status === "acima" ? "▲" : "▼"} ${pc(Math.abs(dev!))} ${status} da LOA`}
                      <span className="font-normal text-faint"> · projeção {brl(p!.value)} de {brl(i.initial)} previstos{p!.seasonal ? "" : " (estimativa linear)"}</span>
                    </p>
                  )}
                </Row>
                {on && (
                  <div className="pointer-events-none absolute right-2 top-full z-10 mt-1 w-64 rounded-xl border border-line bg-surface/95 p-3 text-xs shadow-pop backdrop-blur">
                    <p className="mb-1.5 font-bold">{i.name}</p>
                    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
                      <dt className="text-muted">{isExp ? "Dotação inicial" : "Previsão inicial"}</dt><dd className="text-right tabular-nums">{brl(i.initial)}</dd>
                      <dt className="text-muted">{isExp ? "Dotação atualizada" : "Previsão atualizada"}</dt><dd className="text-right tabular-nums">{brl(i.updated)}</dd>
                      <dt className="text-muted">{isExp ? "Empenhado" : "Arrecadado"}</dt><dd className="text-right tabular-nums">{brl(i.done)}</dd>
                      {i.liquidated !== undefined && (<><dt className="text-muted">Liquidado</dt><dd className="text-right tabular-nums">{brl(i.liquidated)}</dd></>)}
                      {i.paid !== undefined && (<><dt className="text-muted">Pago</dt><dd className="text-right tabular-nums">{brl(i.paid)}</dd></>)}
                      <dt className="text-muted">{over ? "Acima do previsto" : "Falta realizar"}</dt><dd className="text-right tabular-nums">{brl(Math.abs(b - d))}</dd>
                      {p && (<><dt className="text-muted">Projeção do ano</dt><dd className="text-right tabular-nums">{brl(p.value)}</dd></>)}
                    </dl>
                    {r !== null && <p className="mt-1.5 text-faint">{over ? "Já passou do previsto para o ano." : behind ? `Abaixo do ritmo: esperado ~${pc(pace)} até ${MONTH[period]}.` : r >= pace ? "No ritmo ou à frente do esperado." : "Um pouco abaixo do ritmo esperado."}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3 text-sm">
          <span className="text-muted">Total {parent ? `de ${parent.name}` : "das categorias"}</span>
          <span className="text-xs text-muted"><b className="text-ink">{brl(tot.d)}</b> de {brl(tot.b)} · <b className="text-ink">{tot.b > 0 ? pc(tot.d / tot.b) : "—"}</b></span>
        </div>
      </div>

      {/* tabela acessível com os mesmos números */}
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-brand">Ver em tabela</summary>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-faint">
              <tr>
                <th className="p-3 capitalize">{catLabel}</th>
                <th className="p-3 text-right">{isExp ? "Dot. inicial" : "Prev. inicial"}</th>
                <th className="p-3 text-right">{isExp ? "Dot. atualizada" : "Prev. atualizada"}</th>
                <th className="p-3 text-right">{isExp ? "Empenhado" : "Arrecadado"}</th>
                {hasLiq && <th className="p-3 text-right">Liquidado</th>}
                {hasPaid && <th className="p-3 text-right">Pago</th>}
                <th className="p-3 text-right">% exec.</th>
                {projection && <th className="p-3 text-right">Projeção</th>}
                {projection && <th className="p-3 text-right">vs LOA</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.code} className="border-b border-line last:border-0">
                  <td className="p-3">{i.name}</td>
                  <td className="p-3 text-right tabular-nums">{brl(i.initial)}</td>
                  <td className="p-3 text-right tabular-nums">{brl(i.updated)}</td>
                  <td className="p-3 text-right tabular-nums">{brl(i.done)}</td>
                  {hasLiq && <td className="p-3 text-right tabular-nums">{i.liquidated !== undefined ? brl(i.liquidated) : "—"}</td>}
                  {hasPaid && <td className="p-3 text-right tabular-nums">{i.paid !== undefined ? brl(i.paid) : "—"}</td>}
                  <td className="p-3 text-right font-semibold tabular-nums">{rate(i) === null ? "—" : pc(rate(i)!)}</td>
                  {projection && <td className="p-3 text-right tabular-nums">{projection[`${view}:${i.code}`] ? brl(projection[`${view}:${i.code}`].value) : "—"}</td>}
                  {projection && <td className="p-3 text-right tabular-nums">{(() => { const q = projection[`${view}:${i.code}`]; return q && i.initial > 0 ? `${q.value >= i.initial ? "+" : "−"}${pc(Math.abs(q.value / i.initial - 1))}` : "—"; })()}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="mt-3 text-xs leading-relaxed text-faint">
        Acumulado de {year} até {MONTH[period]} ({period}º bimestre), do relatório bimestral (RREO) do Tesouro. O traço vertical marca quanto seria executado se o ritmo fosse uniforme no ano; receitas e despesas sazonais (como IPTU e 13º salário) fogem dessa linha.
        {isExp ? " Empenhado é o valor já reservado; liquidado, o que foi entregue; pago, o que saiu do caixa." : ""}
        {projection ? ` A projeção divide o acumulado pela fração que estava acumulada no mesmo bimestre do ano anterior; “segue a LOA” é ficar a até ${pc(TOL)} do previsto na lei orçamentária.` : ""}
      </p>
    </div>
  );
}
