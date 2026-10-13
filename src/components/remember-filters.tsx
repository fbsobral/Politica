"use client";

import { useEffect } from "react";

const KEYS = ["esfera", "tipo", "veiculo", "cat", "poder", "nivel", "agrupar", "seguindo"] as const;

/** Guarda os filtros do feed em um cookie (1 ano), para voltarem sozinhos na próxima visita. */
export function RememberFilters() {
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (!KEYS.some((k) => sp.has(k))) return; // sem filtros na URL: mantém o que já estava guardado
    const saved: Record<string, string> = {};
    for (const k of KEYS) {
      const v = sp.get(k);
      if (v) saved[k] = v;
    }
    try {
      document.cookie = `pol_feed=${encodeURIComponent(JSON.stringify(saved))}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* cookies bloqueados: sem persistência */
    }
  }, []);
  return null;
}
