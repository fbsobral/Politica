"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AskFocus } from "./ask-button";

type Source = { title: string; url: string; source: string };
type Msg = { role: "user" | "assistant"; content: string; sources?: Source[]; error?: boolean };
export type ChatHints = { city: string; party: string | null; hasQuiz: boolean };

const STORE = "agente:v1";

function suggestionsFor(h: ChatHints): string[] {
  return [
    `O que mudou na política de ${h.city} esta semana?`,
    h.hasQuiz ? "Quais partidos estão mais perto do meu perfil e por quê?" : "Como descubro meu perfil político?",
    h.party ? `Como o ${h.party} se posiciona hoje nos principais temas?` : "Como funciona a diferença entre partido e federação?",
    "Para onde vai o dinheiro da minha cidade?",
  ];
}

export function Chat({ hints, variant = "page", onClose, focus = null, onClearFocus }: { hints: ChatHints; variant?: "page" | "panel"; onClose?: () => void; focus?: AskFocus | null; onClearFocus?: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null | undefined>(undefined);
  const [enabled, setEnabled] = useState(true);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE);
      if (raw) setMsgs(JSON.parse(raw) as Msg[]);
    } catch {
      /* sem armazenamento */
    }
    fetch("/api/agente").then((r) => r.json()).then((d: { enabled?: boolean; remaining?: number | null }) => {
      setEnabled(d.enabled !== false);
      setRemaining(d.remaining ?? null);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-30)));
    } catch {
      /* ignore */
    }
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs, busy]);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const qs = search.toString();
      const res = await fetch("/api/agente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history, page: qs ? `${pathname}?${qs}` : pathname, focus: focus ? `${focus.title}\n${focus.text}`.slice(0, 2800) : undefined }) });
      const d = (await res.json().catch(() => ({}))) as { text?: string; sources?: Source[]; error?: string; remaining?: number | null };
      if (d.remaining !== undefined) setRemaining(d.remaining);
      if (!res.ok || !d.text) setMsgs((m) => [...m, { role: "assistant", content: d.error ?? "Não consegui responder agora.", error: true }]);
      else setMsgs((m) => [...m, { role: "assistant", content: d.text!, sources: d.sources }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Sem conexão. Tente de novo.", error: true }]);
    } finally {
      setBusy(false);
    }
  }, [busy, msgs, pathname, search, focus]);

  const empty = msgs.length === 0;
  const out = remaining === 0;
  return (
    <div className={`flex min-h-0 flex-col ${variant === "page" ? "h-[calc(100dvh-13rem)] min-h-[28rem]" : "h-full"}`}>
      <div className="flex-1 space-y-3 overflow-y-auto px-1 py-2" aria-live="polite">
        {empty && !focus && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted">Pergunte sobre notícias, partidos, representantes e o dinheiro público. Eu uso os dados do app e do seu perfil, e não recomendo voto.</p>
            <div className="flex flex-col gap-2">
              {suggestionsFor(hints).map((s) => (
                <button key={s} type="button" onClick={() => send(s)} disabled={busy || out || !enabled} className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left text-sm hover:border-line-strong disabled:opacity-50">{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-brand text-white" : m.error ? "border border-danger/30 bg-danger/5 text-danger" : "border border-line bg-surface"}`}>
              {m.content}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line pt-2">
                  {m.sources.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noreferrer" title={s.title} className="max-w-[14rem] truncate rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-medium text-muted hover:text-ink">{s.source}: {s.title}</a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start" role="status" aria-label="Pensando">
            <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface px-4 py-3">
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-faint" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {focus && (
        <div className="mb-2 rounded-xl border border-brand/20 bg-brand-soft/60 p-2.5 text-xs">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0"><span className="font-semibold text-brand">Falando sobre:</span> <span className="font-medium">{focus.title}</span></p>
            <button type="button" onClick={onClearFocus} aria-label="Tirar este item da conversa" className="flex-none text-faint hover:text-ink">✕</button>
          </div>
          {focus.suggestions && focus.suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {focus.suggestions.map((s) => <button key={s} type="button" disabled={busy || out || !enabled} onClick={() => send(s)} className="rounded-full border border-line bg-surface px-2.5 py-1 text-left text-[11px] font-medium hover:border-line-strong disabled:opacity-50">{s}</button>)}
            </div>
          )}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="border-t border-line pt-3">
        {!enabled ? (
          <p className="text-sm text-muted">O assistente está indisponível agora.</p>
        ) : out ? (
          <p className="text-sm text-muted">Você usou todas as mensagens de hoje. Volte amanhã.</p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }} rows={1} maxLength={1000} placeholder="Pergunte alguma coisa…" aria-label="Sua pergunta" className="input max-h-32 min-h-[2.75rem] flex-1 resize-none" />
            <button type="submit" disabled={busy || input.trim().length < 2} className="btn btn-primary">Enviar</button>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
          <span>{typeof remaining === "number" ? `${remaining} mensagens restantes hoje` : "Respostas geradas por IA; confira as fontes."}</span>
          <span className="flex gap-3">
            {!empty && <button type="button" onClick={() => { setMsgs([]); try { sessionStorage.removeItem(STORE); } catch { /* ignore */ } }} className="font-semibold hover:text-ink">Nova conversa</button>}
            {onClose && <button type="button" onClick={onClose} className="font-semibold hover:text-ink">Fechar</button>}
          </span>
        </div>
      </form>
    </div>
  );
}
