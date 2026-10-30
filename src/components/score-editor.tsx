"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveScoreConfig } from "@/app/actions";

type Opt = { id: string; name: string; side: "economia" | "social" };

/** Escolha dos indicadores do score de uma esfera. Os dois lados sempre valem 50% cada; dentro de cada lado, os indicadores pesam igual. */
export function ScoreEditor({ scope, options, selected, isCustom }: { scope: "FEDERAL" | "ESTADUAL" | "MUNICIPAL"; options: Opt[]; selected: string[]; isCustom: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState(new Set(selected));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const save = (ids: string[]) => start(async () => { await saveScoreConfig(scope, ids); router.refresh(); });
  const side = (s: Opt["side"]) => options.filter((o) => o.side === s);

  return (
    <details className="mb-8 rounded-2xl border border-line bg-surface p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Editar indicadores do score {isCustom && <span className="ml-1 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-medium">personalizado</span>}</summary>
      <p className="mt-2 text-muted">Marque o que entra na conta. Cada lado continua valendo 50%, e dentro do lado todos os indicadores pesam igual.</p>
      <div className="mt-3 grid gap-5 sm:grid-cols-2">
        {(["economia", "social"] as const).map((s) => (
          <fieldset key={s}>
            <legend className="mb-1.5 font-semibold">{s === "economia" ? "Econômico" : "Social"}</legend>
            {side(s).length === 0 && <p className="text-muted">Nenhum indicador publicado nesta esfera.</p>}
            {side(s).map((o) => (
              <label key={o.id} className="flex cursor-pointer items-start gap-2 py-1">
                <input type="checkbox" className="mt-1" checked={sel.has(o.id)} onChange={() => toggle(o.id)} />
                <span>{o.name}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => save([...sel])} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">{pending ? "Salvando…" : "Salvar escolha"}</button>
        <button type="button" disabled={pending} onClick={() => save([])} className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Voltar ao padrão</button>
      </div>
    </details>
  );
}
