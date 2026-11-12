"use client";

import { Fragment, useEffect, useState } from "react";
import type { PlanItem, Projection } from "@/lib/fiscal";
import { AskButton } from "@/components/agent/ask-button";
import { ControlBar, Segmented } from "@/components/controls";
import { InfoTip } from "@/components/info-tip";
import { explainItem } from "@/lib/budget-glossary";

type Scope = "MUNICIPAL" | "ESTADUAL" | "FEDERAL";
type View = "expense" | "revenue" | "nature";
type Stage = "done" | "liquidated" | "paid";
type Base = "updated" | "initial";
type Sort = "size" | "high" | "low" | "dev";

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
const SORT_LABEL: Record<Sort, string> = { size: "Maior previsto", high: "Mais executado", low: "Menos executado", dev: "Maior desvio da LOA" };

type Shared = { base: Base; sort: Sort; stage: Stage };
type Col = "name" | "base" | "done" | "share" | "rate" | "pace" | "pacev" | "proj" | "dev";

const signedPc = (d: number) => `${d >= 0 ? "+" : "−"}${pc(Math.abs(d))}`;

/** Uma coluna: tabela de categorias de receita ou de despesa, com subcategorias que abrem na própria tabela. */
function Panel({ scope, year, period, plan, projection, view, base, sort, stage }: PlanChartProps & Shared & { view: View }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  // ordenação pelo cabeçalho (clique: crescente; de novo: decrescente); mudar o seletor "Ordenar" volta ao padrão
  const [col, setCol] = useState<{ key: Col; dir: 1 | -1 } | null>(null);
  useEffect(() => setCol(null), [sort, base, stage]);
  const isExp = view !== "revenue";
  const all = plan[view] ?? [];
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
  const colValue = (i: PlanItem, key: Col): number | string | null => {
    const r = rate(i);
    switch (key) {
      case "name": return i.name;
      case "base": return baseOf(i);
      case "done": return doneOf(i);
      case "share": return doneOf(i); // dentro do mesmo grupo, a ordem pela parte do total é a ordem pelo realizado
      case "rate": return r;
      case "pace": return r === null ? null : r / (period / 6);
      case "pacev": return baseOf(i) > 0 ? doneOf(i) - baseOf(i) * (period / 6) : null;
      case "proj": return projOf(i)?.value ?? null;
      case "dev": return devOf(i);
    }
  };
  const order = (list: PlanItem[]) => {
    const l = list.filter((i) => baseOf(i) > 0 || doneOf(i) > 0);
    if (col) {
      return [...l].sort((a, b) => {
        const x = colValue(a, col.key), y = colValue(b, col.key);
        if (x === null && y === null) return 0;
        if (x === null) return 1; // sem valor sempre no fim
        if (y === null) return -1;
        return (typeof x === "string" ? x.localeCompare(y as string, "pt-BR") : x - (y as number)) * col.dir;
      });
    }
    const r = (i: PlanItem) => rate(i) ?? -1;
    if (sort === "high") return [...l].sort((a, b) => r(b) - r(a));
    if (sort === "low") return [...l].sort((a, b) => r(a) - r(b));
    if (sort === "dev") return [...l].sort((a, b) => Math.abs(devOf(b) ?? 0) - Math.abs(devOf(a) ?? 0) || baseOf(b) - baseOf(a));
    return [...l].sort((a, b) => baseOf(b) - baseOf(a) || doneOf(b) - doneOf(a));
  };
  const rows = order(all);
  const tot = rows.reduce((a, i) => ({ b: a.b + baseOf(i), d: a.d + doneOf(i) }), { b: 0, d: 0 });
  const catLabel = view === "expense" ? "Função" : view === "revenue" ? "Origem" : "Tipo de gasto";
  const toggle = (code: string) => setOpen((o) => { const n = new Set(o); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  if (!all.length) return <p className="text-sm text-muted">O relatório bimestral não trouxe o detalhamento por categoria.</p>;

  const scopeTxt = scope === "MUNICIPAL" ? "município" : scope === "ESTADUAL" ? "estado" : "governo federal";
  const itemKind = (child: boolean) => (view === "revenue" ? (child ? "Item de receita" : "Fonte de receita") : view === "nature" ? "Tipo de gasto" : child ? "Subfunção" : "Função orçamentária");
  const askFocus = (i: PlanItem, child: boolean, v: { b: number; d: number; r: number | null; ritmo: number | null; p: number | null; dev: number | null }) => ({
    title: `${i.name} · ${scopeTxt}`,
    text: `${itemKind(child)} "${i.name}" (${scopeTxt}), ${year}, até ${MONTH[period]} (${period}º bimestre do RREO). ${isExp ? "Dotação" : "Previsão"} ${base === "initial" ? "inicial (LOA)" : "atualizada"}: ${brl(v.b)}; ${isExp ? (st === "liquidated" ? "liquidado" : st === "paid" ? "pago" : "empenhado") : "arrecadado"}: ${brl(v.d)}${v.r !== null ? ` (${pc(v.r)} do previsto)` : ""}. ${v.ritmo !== null ? `Pace: ${pc(v.ritmo)} (${v.ritmo >= 1 ? "acima" : "abaixo"} do esperado para o mês).` : ""}${v.p !== null ? ` Projeção do fechamento: ${brl(v.p)}${v.dev !== null ? ` (${v.dev >= 0 ? "+" : "−"}${pc(Math.abs(v.dev))} frente à LOA)` : ""}.` : ""}`,
    suggestions: ["O que é isto, em linguagem simples?", "Por que está acima ou abaixo do ritmo esperado?", "Isso é normal para esta época do ano?"],
  });

  const line = (i: PlanItem, child: boolean, parent?: PlanItem) => {
    const b = baseOf(i), d = doneOf(i), r = rate(i);
    const kids = !child && i.children?.length ? order(i.children) : [];
    const p = projOf(i), dev = devOf(i);
    const status = dev === null ? null : Math.abs(dev) <= TOL ? "segue" : dev > 0 ? "acima" : "abaixo";
    // receita abaixo da LOA e despesa acima dela são os desvios que pedem atenção
    const bad = status !== null && status !== "segue" && (isExp ? status === "acima" : status === "abaixo");
    const ritmo = r === null ? null : r / pace;
    const den = child && parent ? doneOf(parent) : tot.d;
    const share = den > 0 ? d / den : null;
    const esp = b > 0 ? b * pace : null; // valor esperado até agora, se o ano fosse uniforme
    const isOpen = open.has(i.code);
    return (
      <Fragment key={`${child ? "c" : "p"}:${i.code}`}>
        <tr className={`border-t border-line ${child ? "bg-ink/[0.02]" : ""}`}>
          <td className={`w-[34%] max-w-0 px-2.5 py-2 ${child ? "pl-7 text-muted" : "font-medium"}`}>
            <div className="flex min-w-0 items-center gap-1.5" title={i.name}>
            {kids.length > 0 ? (
              <button type="button" aria-expanded={isOpen} onClick={() => toggle(i.code)} className="flex min-w-0 items-center gap-1.5 text-left hover:underline">
                <span className={`inline-block shrink-0 text-brand transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                <span className="truncate">{i.name}</span>
                <span className="shrink-0 text-[11px] font-semibold text-brand">{kids.length} sub</span>
              </button>
            ) : (
              <span className="truncate">{i.name}</span>
            )}
            <InfoTip label={`Explicação: ${i.name}`}>
              <span className="block text-[10px] font-bold uppercase tracking-wide text-faint">O que é</span>
              {(() => {
                const g = explainItem(i.name, view, scopeTxt, parent?.name);
                return (
                  <>
                    <span className="mt-0.5 block">{g.what}</span>
                    {g.includes && <span className="mt-1.5 block text-muted"><b className="text-ink">Inclui:</b> {g.includes}</span>}
                  </>
                );
              })()}
              <span className="mt-2 block"><AskButton label="Pergunte" focus={askFocus(i, child, { b, d, r, ritmo, p: p?.value ?? null, dev })} /></span>
            </InfoTip>
            </div>
          </td>
          <td className="px-2.5 py-2 text-right tabular-nums">{brl(b)}</td>
          <td className="px-2.5 py-2 text-right font-semibold tabular-nums">{brl(d)}</td>
          <td className="px-2.5 py-2 text-right tabular-nums" title={child ? "Parte da categoria-mãe" : "Parte do total realizado das categorias"}>{share === null ? "—" : pc(share)}</td>
          <td className="px-2.5 py-2 text-right tabular-nums">{r === null ? "—" : pc(r)}</td>
          <td className={`px-2.5 py-2 text-right tabular-nums ${ritmo === null ? "" : ritmo >= 1 ? (isExp ? "text-gold" : "text-ok") : isExp ? "text-muted" : "text-danger"}`} title="Percentual do previsto já realizado dividido pelo percentual do ano que já passou: acima de 100% = acima do esperado">{ritmo === null ? "—" : `${ritmo >= 1 ? "▲" : "▼"} ${pc(ritmo)}`}</td>
          <td className={`px-2.5 py-2 text-right tabular-nums ${esp === null ? "" : d - esp >= 0 ? (isExp ? "text-gold" : "text-ok") : isExp ? "text-muted" : "text-danger"}`} title={esp === null ? undefined : `Esperado até ${MONTH[period]}: ${brl(esp)} · realizado: ${brl(d)}`}>{esp === null ? "—" : `${d - esp >= 0 ? "+" : "−"}${brl(Math.abs(d - esp))}`}</td>
          <td className="px-2.5 py-2 text-right tabular-nums">{p ? brl(p.value) : "—"}</td>
          <td className={`px-2.5 py-2 text-right text-xs font-semibold tabular-nums ${status === "segue" ? "text-ok" : bad ? "text-danger" : "text-muted"}`}>
            {status === null ? "—" : status === "segue" ? "✓ segue" : `${status === "acima" ? "▲" : "▼"} ${signedPc(dev!)}`}
          </td>
        </tr>
        {isOpen && kids.map((k) => line(k, true, i))}
      </Fragment>
    );
  };

  return (
    <div className="min-w-0 overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[840px] border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted">
            {([
              ["name", catLabel, "left", undefined],
              ["base", isExp ? "Dotação" : "Previsão", "right", undefined],
              ["done", isExp ? (st === "liquidated" ? "Liquidado" : st === "paid" ? "Pago" : "Empenhado") : "Arrecadado", "right", undefined],
              ["share", "% do total", "right", "Parte do total realizado das categorias (nas subcategorias, parte da categoria-mãe)"],
              ["rate", "% exec.", "right", undefined],
              ["pace", "Pace", "right", "Pace = % executado ÷ parte do ano que já passou. Acima de 100% = acima do esperado; abaixo de 100% = abaixo do esperado"],
              ["pacev", "Pace em R$", "right", "Diferença entre o realizado e o valor esperado até agora (previsto × parte do ano que já passou). Positivo = acima do esperado; negativo = abaixo"],
              ["proj", "Projeção", "right", undefined],
              ["dev", "vs LOA", "right", undefined],
            ] as [Col, string, "left" | "right", string | undefined][]).map(([key, label, align, tip]) => {
              const on = col?.key === key;
              return (
                <th key={key} scope="col" aria-sort={on ? (col!.dir === 1 ? "ascending" : "descending") : "none"} className={`px-2.5 py-2 font-medium ${align === "left" ? "text-left" : "text-right"}`}>
                  <button type="button" title={tip ?? `Ordenar por ${label.toLowerCase()}`} onClick={() => setCol(on ? { key, dir: (col!.dir * -1) as 1 | -1 } : { key, dir: 1 })} className={`inline-flex items-center gap-1 hover:text-ink ${on ? "font-bold text-ink" : ""}`}>
                    {label}
                    <span aria-hidden className={`text-[10px] ${on ? "" : "opacity-30"}`}>{on ? (col!.dir === 1 ? "▲" : "▼") : "↕"}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{rows.map((i) => line(i, false))}</tbody>
        <tfoot>
          <tr className="border-t-2 border-line font-semibold">
            <td className="px-2.5 py-2">Total das categorias</td>
            <td className="px-2.5 py-2 text-right tabular-nums">{brl(tot.b)}</td>
            <td className="px-2.5 py-2 text-right tabular-nums">{brl(tot.d)}</td>
            <td className="px-2.5 py-2 text-right tabular-nums">{tot.d > 0 ? "100%" : "—"}</td>
            <td className="px-2.5 py-2 text-right tabular-nums">{tot.b > 0 ? pc(tot.d / tot.b) : "—"}</td>
            <td className="px-2.5 py-2 text-right tabular-nums">{tot.b > 0 ? `${tot.d / tot.b / pace >= 1 ? "▲" : "▼"} ${pc(tot.d / tot.b / pace)}` : "—"}</td>
            <td className="px-2.5 py-2 text-right tabular-nums">{tot.b > 0 ? `${tot.d - tot.b * pace >= 0 ? "+" : "−"}${brl(Math.abs(tot.d - tot.b * pace))}` : "—"}</td>
            <td className="px-2.5 py-2" />
            <td className="px-2.5 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Previsto x realizado do ano corrente: receitas à esquerda e despesas à direita, cada uma com detalhamento por subcategoria. */
export function BudgetPlanChart({ scope, year, period, plan, projection }: PlanChartProps) {
  const hasRevenue = plan.revenue?.length > 0;
  const expViews = (["expense", "nature"] as View[]).filter((v) => plan[v]?.length);
  const [expView, setExpView] = useState<View>(expViews[0] ?? "expense");
  const [stage, setStage] = useState<Stage>("done");
  const [base, setBase] = useState<Base>(projection ? "initial" : "updated");
  const [sort, setSort] = useState<Sort>(projection ? "dev" : "size");

  const exp = plan[expView] ?? [];
  const hasLiq = exp.some((i) => i.liquidated !== undefined);
  const hasPaid = exp.some((i) => i.paid !== undefined);
  const st: Stage = stage === "liquidated" && !hasLiq ? "done" : stage === "paid" && !hasPaid ? "done" : stage;
  const pace = period / 6;
  const shared: Shared = { base, sort, stage: st };
  const props = { scope, year, period, plan, projection };

  if (!hasRevenue && !expViews.length) return <p className="text-sm text-muted">O relatório bimestral deste ente não trouxe o detalhamento por categoria.</p>;

  return (
    <div>
      {/* principal sempre à vista; o resto em "Ajustes" no celular */}
      <ControlBar
        summary={[st === "done" ? "Empenhado" : st === "liquidated" ? "Liquidado" : "Pago", base === "initial" ? "Previsto na LOA" : "Previsto atualizado", SORT_LABEL[sort]].join(" · ")}
        primary={
          <Segmented label="Previsto" value={base} onChange={setBase} options={[
            { v: "updated", l: "Previsto atualizado", title: "Inclui os créditos e ajustes feitos durante o ano" },
            { v: "initial", l: "Previsto na LOA", title: "Como aprovado na lei orçamentária (LOA)" },
          ]} />
        }
      >
        {(hasLiq || hasPaid) && (
          <Segmented label="Estágio da despesa" value={st} onChange={setStage} options={[
            { v: "done", l: "Empenhado", title: "Valor reservado para o gasto (contratado)" },
            ...(hasLiq ? [{ v: "liquidated" as Stage, l: "Liquidado", title: "Serviço ou bem já entregue e conferido" }] : []),
            ...(hasPaid ? [{ v: "paid" as Stage, l: "Pago", title: "Dinheiro que já saiu do caixa" }] : []),
          ]} />
        )}
        <label className="flex items-center gap-2 text-sm text-muted">
          Ordenar
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input !w-52 !py-1.5">
            <option value="size">{SORT_LABEL.size}</option>
            <option value="high">{SORT_LABEL.high}</option>
            <option value="low">{SORT_LABEL.low}</option>
            {projection && <option value="dev">{SORT_LABEL.dev}</option>}
          </select>
        </label>
      </ControlBar>

      <p className="mb-4 text-xs leading-relaxed text-muted">
        <b className="text-ink">% do total</b> = parte do total realizado (nas subcategorias, parte da categoria-mãe). <b className="text-ink">% exec.</b> = realizado ÷ previsto. <b className="text-ink">Pace</b> (ritmo) = % exec. ÷ {pc(pace)} (parte do ano que já passou): acima de 100% está acima do esperado para {MONTH[period]}, abaixo de 100%, abaixo do esperado. <b className="text-ink">Pace em R$</b> = realizado menos o valor esperado até agora (previsto × {pc(pace)}).
        {projection && st === "done" && period < 6 ? <> <b className="text-ink">Projeção</b> = onde o ano deve fechar; <b className="text-ink">vs LOA</b> compara a projeção com o previsto na lei.</> : null}
      </p>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        {hasRevenue && (
          <section aria-label="Receitas" className="min-w-0">
            <p className="eyebrow !text-municipal">Entradas</p>
            <h3 className="display mb-3 text-xl font-semibold">Receitas · de onde vem</h3>
            <Panel {...props} {...shared} view="revenue" />
          </section>
        )}
        {expViews.length > 0 && (
          <section aria-label="Despesas" className="min-w-0">
            <p className="eyebrow !text-municipal">Saídas</p>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="display text-xl font-semibold">Despesas · para onde vai</h3>
              {expViews.length > 1 && (
                <Segmented label="Agrupar despesas" value={expView} onChange={setExpView} options={[{ v: "expense" as View, l: "Por função" }, { v: "nature" as View, l: "Por tipo de gasto" }]} />
              )}
            </div>
            <Panel key={expView} {...props} {...shared} view={expView} />
          </section>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-faint">
        Acumulado de {year} até {MONTH[period]} ({period}º bimestre), do relatório bimestral (RREO) do Tesouro. O traço vertical marca quanto seria executado se o ritmo fosse uniforme no ano; receitas e despesas sazonais podem ficar à frente ou atrás sem ser um problema. Empenhado é o valor já reservado; liquidado, o que foi entregue; pago, o que saiu do caixa.
        {projection ? ` A projeção divide o acumulado pela fração que estava acumulada no mesmo bimestre do ano anterior; “segue a LOA” é ficar a até ${pc(TOL)} do previsto na lei orçamentária.` : ""}
      </p>
    </div>
  );
}
