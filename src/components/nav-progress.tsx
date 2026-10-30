"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Barra de progresso no topo: aparece NA HORA em qualquer clique em link interno ou envio de formulário
 * e some quando a nova página chega. Dá feedback imediato mesmo quando o servidor demora.
 */
export function NavProgress() {
  const path = usePathname();
  const search = useSearchParams().toString();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const guard = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef(false);

  const stopTimers = () => {
    if (timer.current) clearInterval(timer.current);
    if (guard.current) clearTimeout(guard.current);
    timer.current = guard.current = null;
  };

  const done = useCallback(() => {
    if (!running.current) return;
    running.current = false;
    stopTimers();
    setWidth(100);
    setTimeout(() => { setVisible(false); setWidth(0); }, 250);
  }, []);

  const start = useCallback(() => {
    if (running.current) return;
    running.current = true;
    stopTimers();
    setVisible(true);
    setWidth(12);
    timer.current = setInterval(() => setWidth((w) => (w < 85 ? w + (90 - w) * 0.08 : w)), 200);
    guard.current = setTimeout(done, 20000); // segurança: nunca fica preso
  }, [done]);

  // chegou uma página nova
  useEffect(() => { done(); }, [path, search, done]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // âncora ou mesma página
      start();
    };
    const onSubmit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement | null;
      if (f && !e.defaultPrevented && (f.method || "get").toLowerCase() === "get") start();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("submit", onSubmit, true); stopTimers(); };
  }, [start]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]" style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms" }}>
      <div className="h-full bg-brand shadow-[0_0_8px_var(--brand)]" style={{ width: `${width}%`, transition: "width 200ms ease-out" }} />
    </div>
  );
}
