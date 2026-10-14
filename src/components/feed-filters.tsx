import Link from "next/link";
import type { NewsCategory, Scope, SourceCategory } from "@prisma/client";
import { feedScopeSlug, type FeedScope } from "@/lib/feed";
import { AutoForm } from "@/components/auto-form";
import { IconSearch } from "@/components/icons";
import { NEWS_CATEGORY_LABEL, SOURCE_CATEGORY_LABEL } from "@/lib/taxonomy";
import { NIVEL_OPTIONS, TIER_LEGEND } from "@/lib/tier-legend";

export type FilterData = {
  scope: FeedScope;
  sp: Record<string, string | undefined>;
  tipos: [SourceCategory, number][];
  sources: { id: string; name: string; n: number }[];
  cats: { category: NewsCategory; n: number }[];
};

const GROUPS = [
  { v: "", l: "Recentes" },
  { v: "veiculo", l: "Veículo" },
  { v: "tipo", l: "Tipo" },
  { v: "categoria", l: "Categoria" },
];

export function FeedFilters({ d, idPrefix }: { d: FilterData; idPrefix: string }) {
  const { sp, scope } = d;
  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <AutoForm className="space-y-5">
      <input type="hidden" name="esfera" value={feedScopeSlug(scope)} />
      {sp.poder && <input type="hidden" name="poder" value={sp.poder} />}

      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" width={18} height={18} />
        <input type="search" name="q" defaultValue={sp.q} placeholder="Buscar nas notícias…" aria-label="Buscar" className="input !pl-10" />
      </div>

      <fieldset>
        <legend className="eyebrow mb-2">Organizar por</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {GROUPS.map((g) => (
            <label key={g.v} className="cursor-pointer">
              <input type="radio" name="agrupar" value={g.v} defaultChecked={(sp.agrupar ?? "") === g.v} className="peer sr-only" />
              <span className="block rounded-lg border border-line-strong px-3 py-2 text-center text-sm font-medium text-muted transition peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand">
                {g.l}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-2">Nível do veículo</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {NIVEL_OPTIONS.map((o) => (
            <label key={o.v} className="cursor-pointer">
              <input type="radio" name="nivel" value={o.v} defaultChecked={(sp.nivel ?? "") === o.v} className="peer sr-only" />
              <span className="block rounded-lg border border-line-strong px-2 py-2 text-center text-[13px] font-medium text-muted transition peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand">{o.l}</span>
            </label>
          ))}
        </div>
        <details className="mt-1.5 text-xs text-faint">
          <summary className="cursor-pointer">O que significa?</summary>
          <ul className="mt-1.5 space-y-1">{([1, 2, 3] as const).map((t) => <li key={t}><b className="text-muted">{TIER_LEGEND[t].label}:</b> {TIER_LEGEND[t].desc}</li>)}</ul>
        </details>
      </fieldset>

      <div className="space-y-3">
        <div>
          <label htmlFor={id("tipo")} className="eyebrow mb-1.5 block">Tipo de veículo</label>
          <select id={id("tipo")} name="tipo" defaultValue={sp.tipo ?? ""} className="input">
            <option value="">Todos</option>
            {d.tipos.map(([k, n]) => (
              <option key={k} value={k}>{SOURCE_CATEGORY_LABEL[k]} ({n})</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id("veiculo")} className="eyebrow mb-1.5 block">Veículo</label>
          <select id={id("veiculo")} name="veiculo" defaultValue={sp.veiculo ?? ""} className="input">
            <option value="">Todos</option>
            {d.sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.n})</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id("cat")} className="eyebrow mb-1.5 block">Categoria</label>
          <select id={id("cat")} name="cat" defaultValue={sp.cat ?? ""} className="input">
            <option value="">Todas</option>
            {d.cats.map((c) => (
              <option key={c.category} value={c.category}>{NEWS_CATEGORY_LABEL[c.category]} ({c.n})</option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line-strong px-3.5 py-3 text-sm font-medium">
        <span>Só quem eu sigo</span>
        <span className="relative inline-flex h-6 w-11 flex-none">
          <input type="checkbox" name="seguindo" value="1" defaultChecked={sp.seguindo === "1"} className="peer sr-only" />
          <span className="absolute inset-0 rounded-full bg-line-strong transition peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand" />
          <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
        </span>
      </label>

      <noscript>
        <button className="btn btn-primary w-full">Aplicar filtros</button>
      </noscript>

      {(sp.tipo || sp.veiculo || sp.cat || sp.poder || sp.nivel || sp.q || sp.seguindo || sp.agrupar) && (
        <Link href={`/?esfera=${feedScopeSlug(scope)}`} className="btn btn-ghost btn-sm w-full">Limpar filtros</Link>
      )}
    </AutoForm>
  );
}
