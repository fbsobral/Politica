"use client";

import { useEffect, useState } from "react";
import { saveLocation } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function LocationForm({ ufs, initialUf, initialCity, submitLabel = "Salvar e continuar" }: { ufs: Record<string, string>; initialUf?: string; initialCity?: string; submitLabel?: string }) {
  const [uf, setUf] = useState(initialUf ?? "");
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState(initialCity ?? "");

  useEffect(() => {
    if (!uf) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/municipios?uf=${uf}`)
      .then((r) => r.json())
      .then((list: string[]) => {
        if (cancelled) return;
        setCities(list);
        setCity((c) => (list.includes(c) ? c : ""));
      })
      .catch(() => !cancelled && setCities([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [uf]);

  return (
    <form action={saveLocation} className="space-y-4">
      <label className="block">
        <span className="eyebrow mb-1.5 block">Estado</span>
        <select name="uf" required value={uf} onChange={(e) => setUf(e.target.value)} className="input">
          <option value="">Selecione…</option>
          {Object.entries(ufs).map(([sigla, nome]) => (
            <option key={sigla} value={sigla}>
              {nome}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="eyebrow mb-1.5 block">Município</span>
        <select name="municipality" required value={city} onChange={(e) => setCity(e.target.value)} disabled={!uf || loading} className="input disabled:opacity-50">
          <option value="">{loading ? "Carregando…" : uf ? "Selecione…" : "Escolha o estado primeiro"}</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton className="btn btn-primary w-full" pendingText="Salvando…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
