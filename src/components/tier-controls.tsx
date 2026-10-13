"use client";

import { useRef, useState } from "react";
import { bulkApplyTiers, bulkConfirmTiers } from "@/app/admin-actions";
import { SubmitButton } from "@/components/submit-button";

/** Barra de edição em massa dos tiers: marcar todos, aplicar um tier aos marcados ou confirmar as sugestões da IA. */
export function TierControls({ total }: { total: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);

  const boxes = () => Array.from(ref.current?.closest("form")?.querySelectorAll<HTMLInputElement>('input[name="sel"]') ?? []);
  const refresh = () => setCount(boxes().filter((b) => b.checked).length);

  return (
    <div
      ref={ref}
      onChange={(e) => {
        const t = e.target as HTMLInputElement;
        if (t.dataset.all) boxes().forEach((b) => (b.checked = t.checked));
        refresh();
      }}
      className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-card backdrop-blur"
    >
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" data-all="1" /> Selecionar todos ({total})
      </label>
      <span className="text-sm text-muted">{count} marcado(s)</span>
      <select name="bulkTier" defaultValue="" className="input !w-40 !py-1.5 text-sm" aria-label="Tier a aplicar">
        <option value="">Sem tier</option>
        <option value="1">Tier 1</option>
        <option value="2">Tier 2</option>
        <option value="3">Tier 3</option>
      </select>
      <SubmitButton formAction={bulkApplyTiers} className="btn btn-primary btn-sm" disabled={count === 0} pendingText="Aplicando…">Aplicar aos marcados</SubmitButton>
      <SubmitButton formAction={bulkConfirmTiers} className="btn btn-secondary btn-sm" disabled={count === 0} pendingText="Confirmando…">Confirmar sugestões marcadas</SubmitButton>
    </div>
  );
}
