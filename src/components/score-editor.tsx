"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveScoreSetup } from "@/app/actions";
import { AskButton } from "@/components/agent/ask-button";

export type EditorOpt = {
  id: string; name: string; side: "economia" | "social";
  /** meta fixa (referência automática) e a fonte dela; nulo = sem meta global */
  fixed: number | null; ref: string | null; approx?: boolean; suffix: string;
  /** meta personalizada salva pelo usuário */
  custom: number | null;
};

type Method = "nivel" | "nivel-avanco";

/** Escolha dos indicadores, das metas (fixa ou personalizada) e do método do score de uma esfera. */
export function ScoreEditor({ scope, options, selected, isCustom, method }: { scope: "FEDERAL" | "ESTADUAL" | "MUNICIPAL"; options: EditorOpt[]; selected: string[]; isCustom: boolean; method: Method }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState(new Set(selected));
  const [mode, setMode] = useState<Record<string, "fixa" | "personalizada">>(() => Object.fromEntries(options.map((o) => [o.id, o.custom != null || o.fixed == null ? "personalizada" : "fixa"])));
  const [val, setVal] = useState<Record<string, string>>(() => Object.fromEntries(options.map((o) => [o.id, o.custom != null ? String(o.custom) : o.fixed != null ? String(o.fixed) : ""])));
  const [m, setM] = useState<Method>(method);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const side = (s: EditorOpt["side"]) => options.filter((o) => o.side === s);

  const save = (reset: boolean) => start(async () => {
    const targets: Record<string, number | null> = {};
    for (const o of options) {
      const v = Number(String(val[o.id] ?? "").replace(",", "."));
      targets[o.id] = !reset && mode[o.id] === "personalizada" && String(val[o.id] ?? "").trim() !== "" && Number.isFinite(v) ? v : null;
    }
    await saveScoreSetup(scope, { ids: reset ? [] : [...sel], targets, method: reset ? "nivel" : m });
    router.refresh();
  });

  return (
    <details className="mb-8 rounded-2xl border border-line bg-surface p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Editar indicadores, metas e método do score {isCustom && <span className="ml-1 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-medium">personalizado</span>}</summary>
      <p className="mt-2 text-muted">Marque o que entra na conta. Cada lado continua valendo 50%, e dentro do lado todos os indicadores pesam igual. Em cada indicador, a meta pode ser a <b>fixa</b> (referência automática, sempre preservada) ou uma <b>personalizada</b> sua. Sem meta, o indicador aparece nas listas, mas não entra na conta.</p>

      <fieldset className="mt-4 rounded-xl border border-line p-3">
        <legend className="px-1 font-semibold">Método da nota</legend>
        <label className="flex cursor-pointer items-start gap-2 py-1"><input type="radio" name="metodo" className="mt-1" checked={m === "nivel"} onChange={() => setM("nivel")} /><span><b>Só nível</b> — proximidade da meta (100 se atingiu ou superou).</span></label>
        <label className="flex cursor-pointer items-start gap-2 py-1"><input type="radio" name="metodo" className="mt-1" checked={m === "nivel-avanco"} onChange={() => setM("nivel-avanco")} /><span><b>Nível + avanço</b> — média entre a proximidade da meta e quanto da distância foi fechada em relação ao ano anterior.</span></label>
      </fieldset>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {(["economia", "social"] as const).map((s) => (
          <fieldset key={s}>
            <legend className="mb-1.5 font-semibold">{s === "economia" ? "Econômico" : "Social"}</legend>
            {side(s).length === 0 && <p className="text-muted">Nenhum indicador publicado nesta esfera.</p>}
            {side(s).map((o) => (
              <div key={o.id} className="border-t border-line py-2 first:border-t-0">
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={sel.has(o.id)} onChange={() => toggle(o.id)} />
                  <span className="font-medium">{o.name}</span>
                </label>
                <div className="ml-6 mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted">Meta:</span>
                  {o.fixed != null ? (
                    <select aria-label={`Tipo de meta de ${o.name}`} value={mode[o.id]} onChange={(e) => setMode((x) => ({ ...x, [o.id]: e.target.value as "fixa" | "personalizada" }))} className="rounded-lg border border-line bg-paper px-2 py-1">
                      <option value="fixa">Fixa ({String(o.fixed).replace(".", ",")}{o.suffix})</option>
                      <option value="personalizada">Personalizada</option>
                    </select>
                  ) : <span className="rounded-full bg-ink/10 px-2 py-0.5 font-semibold">sem meta global</span>}
                  {mode[o.id] === "personalizada" && (
                    <label className="flex items-center gap-1">
                      <input type="number" step="any" inputMode="decimal" aria-label={`Meta personalizada de ${o.name}`} value={val[o.id] ?? ""} onChange={(e) => setVal((x) => ({ ...x, [o.id]: e.target.value }))} placeholder="valor" className="w-24 rounded-lg border border-line bg-paper px-2 py-1" />
                      {o.suffix}
                    </label>
                  )}
                </div>
                {o.ref && <p className="ml-6 mt-0.5 text-[11px] text-faint">Referência fixa: {o.ref}{o.approx && <b> · valor aproximado, confira na fonte</b>}</p>}
              </div>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => save(false)} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-50">{pending ? "Salvando…" : "Salvar escolha"}</button>
        <AskButton label="Quais indicadores e metas escolher?" focus={{ title: "Escolha de indicadores e metas do score", text: `O usuário está escolhendo indicadores, metas e método do score (cada lado vale 50%, peso igual dentro do lado). Nota do indicador: proximidade da meta (100 na meta ou além) ${m === "nivel-avanco" ? "combinada com o avanço sobre o ano anterior" : "(só nível)"}. Indicadores: ${options.map((o) => `${o.name} (${o.fixed != null ? `meta fixa ${o.fixed}${o.suffix}, ${o.ref}` : "sem meta global"}${o.custom != null ? `; meta personalizada ${o.custom}` : ""}; ${sel.has(o.id) ? "marcado" : "desmarcado"})`).join("; ")}.`, suggestions: ["Como escolher uma boa meta?", "Qual a diferença entre só nível e nível + avanço?", "Que metas globais existem para estes indicadores?"] }} />
        <button type="button" disabled={pending} onClick={() => save(true)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Voltar ao padrão</button>
      </div>
    </details>
  );
}
