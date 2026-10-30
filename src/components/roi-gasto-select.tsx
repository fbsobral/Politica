"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/** Seletor do gasto: ao escolher, recarrega a análise já com os indicadores alinhados sugeridos. */
export function RoiGastoSelect({ base, value, h, children }: { base: string; value: string; h: number; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="relative">
      <select id="gasto" name="gasto" defaultValue={value} disabled={pending} onChange={(e) => start(() => router.push(`${base}&gasto=${encodeURIComponent(e.target.value)}&h=${h}`))} className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm disabled:opacity-60">
        {children}
      </select>
      {pending && <span className="absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-ink" aria-label="Carregando" />}
    </div>
  );
}
