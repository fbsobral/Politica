"use client";

import { useState } from "react";
import { Spinner } from "@/components/submit-button";

/** "Saiba mais" recolhido: busca a explicação (gerada por IA e guardada em cache) só ao abrir. */
export function Explain({ kind, text }: { kind: "vote" | "event"; text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [answer, setAnswer] = useState("");

  async function load() {
    if (state !== "idle") return;
    setState("loading");
    try {
      const res = await fetch("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, text }) });
      if (!res.ok) throw new Error(String(res.status));
      setAnswer(((await res.json()) as { text: string }).text);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <details
      className="group mt-2"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) void load();
      }}
    >
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-brand [&::-webkit-details-marker]:hidden">
        <span className="transition-transform group-open:rotate-90" aria-hidden>▸</span> Saiba mais
      </summary>
      <div className="mt-2 rounded-xl bg-brand-soft/60 p-3 text-sm leading-relaxed">
        {state === "loading" && <span className="flex items-center gap-2 text-muted"><Spinner /> Explicando…</span>}
        {state === "done" && <p>{answer}</p>}
        {state === "error" && <button type="button" onClick={() => { setState("idle"); void load(); }} className="text-muted underline">Não consegui explicar agora — tentar de novo</button>}
        {state === "done" && <p className="mt-1.5 text-[11px] text-faint">Explicação gerada por IA a partir do texto oficial; confira a fonte.</p>}
      </div>
    </details>
  );
}
