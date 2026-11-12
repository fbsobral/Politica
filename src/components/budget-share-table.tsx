"use client";

import { Fragment, useEffect, useState } from "react";
import { AskButton } from "@/components/agent/ask-button";
import { Segmented } from "@/components/controls";
import { InfoTip } from "@/components/info-tip";
import { explainItem, type GlossaryView } from "@/lib/budget-glossary";
import type { Slice } from "@/lib/budget";

type Col = "name" | "value" | "share" | "perCapita";

const brl = (v: number) => {
  const a = Math.abs(v);
  const f = (n: number, u: string) => `${v < 0 ? "−" : ""}R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: n >= 100 ? 0 : n >= 10 ? 1 : 2 })} ${u}`;
  if (a >= 1e12) return f(a / 1e12, "tri");
  if (a >= 1e9) return f(a / 1e9, "bi");
  if (a >= 1e6) return f(a / 1e6, "mi");
  if (a >= 1e3) return f(a / 1e3, "mil");
  return `${v < 0 ? "−" : ""}R$ ${Math.round(a).toLocaleString("pt-BR")}`;
};
const pc = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: n < 0.1 ? 1 : 0 })}%`;

/** Tabela de receitas ou despesas do ano fechado: ordena pelo cabeçalho, abre subcategorias na própria tabela e tem explicação em tooltip. */
export function BudgetShareTable({ items, scope, view, year, population, entity }: { items: Slice[]; scope: "MUNICIPAL" | "ESTADUAL" | "FEDERAL"; view: GlossaryView; year: number; population: number | null; entity: string }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [col, setCol] = useState<{ key: Col; dir: 1 | -1 } | null>(null);
  useEffect(() => { setOpen(new Set()); setCol(null); }, [view]);
  const scopeTxt = scope === "MUNICIPAL" ? "município" : scope === "ESTADUAL" ? "estado" : "governo federal";
  const isExp = view !== "revenue";
  const total = items.reduce((a, i) => a + i.value, 0);
  const catLabel = view === "expense" ? "Função" : view === "revenue" ? "Origem" : "Tipo de gasto";

  const order = (list: Slice[]) => {
    if (!col) return list;
    const v = (i: Slice): number | string => (col.key === "name" ? i.name : col.key === "perCapita" ? i.value : col.key === "share" ? i.shareOfParent ?? i.share : i.value);
    return [...list].sort((a, b) => {
      // "Outros" sempre no fim
      if (a.code === "outros") return 1;
      if (b.code === "outros") return -1;
      const x = v(a), y = v(b);
      return (typeof x === "string" ? x.localeCompare(y as string, "pt-BR") : x - (y as number)) * col.dir;
    });
  };
  const toggle = (code: string) => setOpen((o) => { const n = new Set(o); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  const row = (i: Slice, child: boolean, parent?: Slice) => {
    const kids = !child && i.children?.length ? order(i.children) : [];
    const isOpen = open.has(i.code);
    const share = child ? i.shareOfParent ?? (parent && parent.value ? i.value / parent.value : null) : i.share;
    const generic = i.code === "outros" || i.code.endsWith(".out");
    return (
      <Fragment key={`${child ? "c" : "p"}:${i.code}`}>
        <tr className={`border-t border-line ${child ? "bg-ink/[0.02]" : ""}`}>
          <td className={`w-[46%] max-w-0 px-2.5 py-2 ${child ? "pl-7 text-muted" : "font-medium"}`}>
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
              {!generic && (
                <InfoTip label={`Explicação: ${i.name}`}>
                  {(() => {
                    const g = explainItem(i.name, view, scopeTxt, parent?.name);
                    return (
                      <>
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-faint">O que é</span>
                        <span className="mt-0.5 block">{g.what}</span>
                        {g.includes && <span className="mt-1.5 block text-muted"><b className="text-ink">Inclui:</b> {g.includes}</span>}
                        <span className="mt-2 block">
                          <AskButton label="Pergunte" focus={{
                            title: `${i.name} · ${entity}`,
                            text: `${isExp ? "Despesa" : "Receita"} "${i.name}"${parent ? `, dentro de "${parent.name}"` : ""} (${entity}, ${year}, ano fechado, Siconfi): ${brl(i.value)}${share !== null ? `, ${pc(share)} ${child ? `de "${parent?.name}"` : `do total (${brl(total)})`}` : ""}${population ? `, cerca de R$ ${Math.round(i.value / population).toLocaleString("pt-BR")} por habitante` : ""}.`,
                            suggestions: ["O que é isto, em linguagem simples?", "Esse valor é alto para uma cidade como esta?", "Como isso mudou nos últimos anos?"],
                          }} />
                        </span>
                      </>
                    );
                  })()}
                </InfoTip>
              )}
            </div>
          </td>
          <td className="px-2.5 py-2 text-right font-semibold tabular-nums">{brl(i.value)}</td>
          <td className="px-2.5 py-2 text-right tabular-nums" title={child ? "Parte da categoria-mãe" : "Parte do total"}>{share === null ? "—" : pc(share)}</td>
          {population ? <td className="px-2.5 py-2 text-right tabular-nums">R$ {Math.round(i.value / population).toLocaleString("pt-BR")}</td> : null}
        </tr>
        {isOpen && kids.map((k) => row(k, true, i))}
      </Fragment>
    );
  };

  const heads: [Col, string, "left" | "right", string?][] = [
    ["name", catLabel, "left"],
    ["value", isExp ? "Empenhado" : "Arrecadado", "right"],
    ["share", "% do total", "right", "Parte do total (nas subcategorias, parte da categoria-mãe)"],
    ...(population ? [["perCapita", "Por habitante", "right"] as [Col, string, "left" | "right"]] : []),
  ];

  return (
    <div className="min-w-0 overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[440px] border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted">
            {heads.map(([key, label, align, tip]) => {
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
        <tbody>{order(items).map((i) => row(i, false))}</tbody>
        <tfoot>
          <tr className="border-t-2 border-line font-semibold">
            <td className="px-2.5 py-2">Total</td>
            <td className="px-2.5 py-2 text-right tabular-nums">{brl(total)}</td>
            <td className="px-2.5 py-2 text-right tabular-nums">100%</td>
            {population ? <td className="px-2.5 py-2 text-right tabular-nums">R$ {Math.round(total / population).toLocaleString("pt-BR")}</td> : null}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Despesas do ano fechado, com alternância entre "por função" (para onde vai) e "por tipo de gasto" (em que se gasta). */
export function ExpenseShareTables({ expense, nature, scope, year, population, entity }: { expense: Slice[]; nature: Slice[]; scope: "MUNICIPAL" | "ESTADUAL" | "FEDERAL"; year: number; population: number | null; entity: string }) {
  const [view, setView] = useState<"expense" | "nature">("expense");
  return (
    <div>
      {nature.length > 0 && expense.length > 0 && (
        <div className="mb-3">
          <Segmented label="Agrupar despesas" value={view} onChange={setView} options={[{ v: "expense" as const, l: "Por função (para onde vai)" }, { v: "nature" as const, l: "Por tipo de gasto (em que se gasta)" }]} />
        </div>
      )}
      <BudgetShareTable key={view} items={view === "expense" ? expense : nature} scope={scope} view={view} year={year} population={population} entity={entity} />
    </div>
  );
}
