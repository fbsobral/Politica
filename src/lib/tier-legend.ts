export const TIER_LEGEND: Record<1 | 2 | 3, { label: string; desc: string }> = {
  1: { label: "Tier 1", desc: "Grande alcance nacional, agências e fontes oficiais federais." },
  2: { label: "Tier 2", desc: "Nacionais menores ou especializados, regionais fortes e fontes oficiais estaduais." },
  3: { label: "Tier 3", desc: "Blogs, sites locais pequenos e demais veículos." },
};

/** Valores do filtro "nível do veículo" na URL: "1" = só tier 1; "12" = tier 1 e 2. */
export const NIVEL_OPTIONS = [
  { v: "", l: "Todos" },
  { v: "1", l: "Só Tier 1" },
  { v: "12", l: "Tier 1 e 2" },
] as const;

export function tiersFor(nivel?: string): number[] | null {
  return nivel === "1" ? [1] : nivel === "12" ? [1, 2] : null;
}
