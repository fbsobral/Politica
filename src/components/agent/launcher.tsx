"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ASK_EVENT, type AskFocus } from "./ask-button";
import { Chat, type ChatHints } from "./chat";

/** Botão flutuante que abre o assistente em qualquer tela (menos na própria página de conversa). */
export function AgentLauncher({ hints }: { hints: ChatHints }) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<AskFocus | null>(null);
  const path = usePathname();
  useEffect(() => {
    const on = (e: Event) => {
      setFocus((e as CustomEvent<AskFocus>).detail);
      setOpen(true);
    };
    window.addEventListener(ASK_EVENT, on);
    return () => window.removeEventListener(ASK_EVENT, on);
  }, []);
  useEffect(() => {
    setOpen(false);
    setFocus(null);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  if (path.startsWith("/conversar") || path.startsWith("/admin")) return null;
  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label="Abrir o assistente" className="fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white shadow-pop hover:opacity-90 lg:bottom-6 lg:right-6">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></svg>
          Pergunte
        </button>
      )}
      {open && (
        <div role="dialog" aria-label="Assistente" className="fixed inset-x-0 bottom-0 z-40 flex h-[78dvh] flex-col rounded-t-3xl border border-line bg-paper p-4 shadow-pop sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[34rem] sm:w-[26rem] sm:rounded-3xl">
          <div className="mb-2 flex items-center justify-between">
            <b className="display text-lg">Assistente</b>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-ink">✕</button>
          </div>
          <Suspense fallback={null}>
            <Chat hints={hints} variant="panel" onClose={() => setOpen(false)} focus={focus} onClearFocus={() => setFocus(null)} />
          </Suspense>
        </div>
      )}
    </>
  );
}
