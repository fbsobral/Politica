"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Botão "i" com balão de explicação (passar o mouse, focar ou tocar). O balão usa posição fixa,
 * então não é cortado por tabelas com rolagem, e pode conter botões (ex.: Pergunte).
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const w = 304;
    const left = Math.max(8, Math.min(r.left - 8, window.innerWidth - w - 8));
    const below = r.bottom + 8;
    setPos({ top: below + 140 > window.innerHeight ? Math.max(8, r.top - 8 - 140) : below, left });
  }, []);
  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPos(null), 150);
  }, []);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); window.removeEventListener("keydown", esc); };
  }, [pos]);

  return (
    <span className="inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={pos !== null}
        onClick={() => (pos ? setPos(null) : show())}
        onFocus={show}
        onBlur={hide}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold leading-none ${pos ? "border-brand bg-brand text-brand-ink" : "border-line text-muted hover:border-brand hover:text-brand"}`}
      >
        i
      </button>
      {pos && (
        <span role="tooltip" style={{ position: "fixed", top: pos.top, left: pos.left, width: 304 }} className="z-50 block rounded-xl border border-line bg-surface p-3 text-left text-xs font-normal leading-relaxed text-ink shadow-pop" onMouseEnter={show} onMouseLeave={hide}>
          {children}
        </span>
      )}
    </span>
  );
}
