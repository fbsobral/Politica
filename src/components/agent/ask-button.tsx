"use client";

export type AskFocus = {
  /** nome curto do que o usuário está vendo (ex.: "PIB · São José dos Campos") */
  title: string;
  /** dados do item, em texto compacto: vão junto das mensagens para o assistente responder sobre ele */
  text: string;
  /** perguntas sugeridas (atalhos) */
  suggestions?: string[];
};

export const ASK_EVENT = "agent:ask";

/** Abre o assistente já com o item na conversa. */
export function askAssistant(focus: AskFocus) {
  window.dispatchEvent(new CustomEvent<AskFocus>(ASK_EVENT, { detail: focus }));
}

/** Botão "Perguntar" para ficar ao lado de gráficos, tabelas e cartões. */
export function AskButton({ focus, label = "Perguntar", className = "", compact = false }: { focus: AskFocus; label?: string; className?: string; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        askAssistant(focus);
      }}
      title="Tirar dúvidas sobre isto com o assistente"
      aria-label={compact ? "Perguntar ao assistente sobre isto" : undefined}
      className={`inline-flex flex-none items-center gap-1.5 rounded-full border border-line bg-surface text-xs font-semibold text-brand transition-colors hover:border-brand/40 hover:bg-brand-soft ${compact ? "h-9 w-9 justify-center border-transparent bg-transparent" : "px-2.5 py-1"} ${className}`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></svg>
      {!compact && label}
    </button>
  );
}
