"use client";

import { useRef } from "react";

/** Form GET que se envia sozinho ao mudar um filtro (e com debounce ao digitar). */
export function AutoForm({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <form
      ref={ref}
      method="get"
      className={className}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        clearTimeout(timer.current);
        if (t.type === "search" || t.type === "text") timer.current = setTimeout(() => ref.current?.requestSubmit(), 600);
        else ref.current?.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
