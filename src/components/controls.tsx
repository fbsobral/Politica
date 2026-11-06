"use client";

import { useState } from "react";

/* Controles compartilhados dos gráficos (mesmo visual em todos os módulos). */

/** Botão de um grupo segmentado. */
export const segClass = (on: boolean) => `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${on ? "bg-ink text-paper" : "text-muted hover:bg-ink/5 hover:text-ink"}`;

/** Caixa do grupo segmentado; rola de lado quando não cabe (celular). */
export const SEG_GROUP = "flex max-w-full gap-0.5 overflow-x-auto rounded-xl border border-line bg-surface p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; l: React.ReactNode; title?: string; disabled?: boolean }[]; onChange: (v: T) => void }) {
  return (
    <div className={SEG_GROUP} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)} disabled={o.disabled} title={o.title} aria-pressed={value === o.v} className={`${segClass(value === o.v)} disabled:opacity-40`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

/**
 * Barra de controles: a escolha principal fica sempre à vista; as demais opções ficam atrás de "Ajustes" no celular
 * (com o resumo do que está escolhido) e aparecem em linha a partir do tablet.
 */
export function ControlBar({ primary, summary, children }: { primary?: React.ReactNode; summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 space-y-2.5 sm:flex sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2.5 sm:space-y-0">
      {primary}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2 text-left text-sm sm:hidden">
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint">Ajustes</span>
          <span className="block truncate font-medium">{summary}</span>
        </span>
        <span aria-hidden className={`flex-none text-muted transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      <div className={`${open ? "flex" : "hidden"} flex-col items-start gap-2.5 sm:contents`}>{children}</div>
    </div>
  );
}
