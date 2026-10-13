import { IconExternal, IconSearch } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";
import { diarioOficial, type Gazette } from "@/lib/open-data";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Diário Oficial" };
export const dynamic = "force-dynamic";

export default async function DiarioPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = (await searchParams).q?.trim();
  let gazettes: Gazette[] = [];
  let error = false;
  try {
    gazettes = await diarioOficial(user.uf, user.municipalityKey, q);
  } catch {
    error = true;
  }
  return (
    <div>
      <PageHeader eyebrow={`Querido Diário · ${user.municipality}`} title="Diário Oficial" />
      <form className="mb-6 flex max-w-xl gap-2">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" width={18} height={18} />
          <input name="q" defaultValue={q} placeholder="Buscar nos diários (ex.: licitação, nomeação)…" className="input !pl-10" />
        </div>
        <button className="btn btn-primary">Buscar</button>
      </form>
      {error && <EmptyState title="Diário Oficial indisponível">O serviço Querido Diário não respondeu agora, ou ainda não cobre {user.municipality}. Tente novamente mais tarde.</EmptyState>}
      {!error && !gazettes.length && <EmptyState title="Nenhuma edição encontrada">{q ? "Nada encontrado para essa busca." : `O Querido Diário ainda não tem edições de ${user.municipality}.`}</EmptyState>}
      <ul className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {gazettes.map((g) => (
          <li key={g.url} className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">{g.extra ? "Edição extra" : "Edição"}{g.edition ? ` nº ${g.edition}` : ""}</p>
                <h2 className="display text-xl font-semibold">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(g.date))}</h2>
              </div>
              <a href={g.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">PDF <IconExternal /></a>
            </div>
            {g.excerpts.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-line pt-3">
                {g.excerpts.map((e, i) => <li key={i} className="line-clamp-3 text-sm leading-relaxed text-muted">…{e}…</li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
