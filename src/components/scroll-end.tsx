"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Área com rolagem lateral que:
 * - já abre mostrando o fim (anos mais recentes);
 * - pode ser arrastada com o mouse em qualquer ponto (cursor de mãozinha), sem atrapalhar botões e links.
 */
export function ScrollEnd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return; // toque já rola nativamente
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea, summary, label")) return;
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false };
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current, el = ref.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 4) { d.moved = true; setGrabbing(true); el.setPointerCapture(e.pointerId); }
    if (d.moved) el.scrollLeft = d.left - dx;
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (drag.current?.moved && el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    drag.current = null;
    setGrabbing(false);
  };

  return (
    <div
      ref={ref}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClickCapture={(e) => { if (drag.current?.moved) e.stopPropagation(); }}
      className={`${className} ${grabbing ? "cursor-grabbing select-none" : "cursor-grab"}`}
    >
      {children}
    </div>
  );
}
