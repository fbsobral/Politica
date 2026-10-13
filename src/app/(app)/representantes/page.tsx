import Link from "next/link";
import type { PoliticianRole, Prisma, Scope } from "@prisma/client";
import { loadUfData } from "@/app/actions";
import { AutoForm } from "@/components/auto-form";
import { IconSearch } from "@/components/icons";
import { ExecutiveCard, PoliticianCard } from "@/components/politician-card";
import { EmptyState, SCOPE_DOT } from "@/components/ui";
import { db } from "@/lib/db";
import { normalize } from "@/lib/text";
import { SCOPE_LABEL, SCOPE_SLUG, UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Representantes" };
export const dynamic = "force-dynamic";

const EXEC: Record<Scope, PoliticianRole[]> = {
  MUNICIPAL: ["PREFEITO", "VICE_PREFEITO"],
  ESTADUAL: ["GOVERNADOR", "VICE_GOVERNADOR"],
  FEDERAL: ["PRESIDENTE", "VICE_PRESIDENTE"],
};
const LEGIS: Record<Scope, PoliticianRole[]> = {
  MUNICIPAL: ["VEREADOR"],
  ESTADUAL: ["DEPUTADO_ESTADUAL"],
  FEDERAL: ["SENADOR", "DEPUTADO_FEDERAL"],
};
const PLURAL: Partial<Record<PoliticianRole, string>> = {
  SENADOR: "Senadores",
  DEPUTADO_FEDERAL: "Deputados federais",
  DEPUTADO_ESTADUAL: "Deputados estaduais",
  VEREADOR: "Vereadores",
};

export default async function RepresentantesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = sp.seguindo === "1" ? "seguindo" : (sp.esfera ?? "municipal");
  const scope: Scope = SCOPE_SLUG[view] ?? "MUNICIPAL";
  const all = sp.todos === "1";
  const q = sp.q ? normalize(sp.q) : "";

  const follows = await db.follow.findMany({ where: { userId: user.id }, select: { politicianId: true } });
  const followSet = new Set(follows.map((f) => f.politicianId));

  const base = (role: PoliticianRole): Prisma.PoliticianWhereInput => {
    if (scope === "MUNICIPAL") return { role, uf: user.uf, municipalityKey: user.municipalityKey };
    if (scope === "ESTADUAL") return { role, uf: user.uf };
    if (role === "SENADOR" || role === "DEPUTADO_FEDERAL") return all ? { role } : { role, uf: user.uf };
    return { role };
  };

  const politicians =
    view === "seguindo"
      ? await db.politician.findMany({ where: { id: { in: [...followSet] } }, orderBy: { name: "asc" } })
      : await db.politician.findMany({ where: { OR: [...EXEC[scope], ...LEGIS[scope]].map(base) }, orderBy: [{ ballotName: "asc" }, { name: "asc" }] });
  const filtered = q ? politicians.filter((p) => normalize(`${p.name} ${p.ballotName ?? ""} ${p.party ?? ""}`).includes(q)) : politicians;
  const missingUfData = view !== "seguindo" && scope !== "FEDERAL" && filtered.length === 0 && !q;

  const tabs: { key: string; label: string; scope?: Scope; href: string }[] = [
    { key: "municipal", label: "Municipal", scope: "MUNICIPAL", href: "/representantes?esfera=municipal" },
    { key: "estadual", label: "Estadual", scope: "ESTADUAL", href: "/representantes?esfera=estadual" },
    { key: "federal", label: "Federal", scope: "FEDERAL", href: "/representantes?esfera=federal" },
    { key: "seguindo", label: `Seguindo · ${followSet.size}`, href: "/representantes?seguindo=1" },
  ];
  const place = view === "seguindo" ? "Quem você segue" : scope === "MUNICIPAL" ? user.municipality : scope === "ESTADUAL" ? UFS[user.uf] : all ? "Brasil" : `Bancada de ${UFS[user.uf]}`;

  return (
    <div>
      <header className="mb-6">
        <p className="eyebrow mb-1">{view === "seguindo" ? "Acompanhando" : `Representantes · ${SCOPE_LABEL[scope]}`}</p>
        <h1 className="display text-4xl font-semibold leading-none sm:text-5xl">{place}</h1>
      </header>

      <div role="tablist" className="scrollbar-none -mx-4 mb-5 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <Link key={t.key} role="tab" aria-selected={view === t.key} href={t.href} className={`flex flex-none items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${view === t.key ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-muted hover:text-ink"}`}>
            {t.scope && <span className={`h-2 w-2 rounded-full ${SCOPE_DOT[t.scope]}`} />}
            {t.label}
          </Link>
        ))}
      </div>

      <AutoForm className="mb-6 flex gap-2">
        {view === "seguindo" ? <input type="hidden" name="seguindo" value="1" /> : <input type="hidden" name="esfera" value={view} />}
        {all && <input type="hidden" name="todos" value="1" />}
        <div className="relative flex-1 sm:max-w-md">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" width={18} height={18} />
          <input type="search" name="q" defaultValue={sp.q} placeholder="Buscar por nome ou partido…" aria-label="Buscar" className="input !pl-10" />
        </div>
        {scope === "FEDERAL" && view !== "seguindo" && (
          <Link href={all ? "/representantes?esfera=federal" : "/representantes?esfera=federal&todos=1"} className="btn btn-secondary">
            {all ? `Só ${user.uf}` : "Todos os estados"}
          </Link>
        )}
      </AutoForm>

      {missingUfData && (
        <EmptyState
          title={`Carregando dados de ${UFS[user.uf]}`}
          action={<form action={loadUfData}><button className="btn btn-primary">Carregar agora</button></form>}
        >
          Os eleitos são baixados do TSE na primeira vez (cerca de 30 segundos). Se esta tela não mudar, clique em carregar.
        </EmptyState>
      )}

      {view === "seguindo" ? (
        filtered.length ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((p, i) => <PoliticianCard key={p.id} p={p} following showRole index={i} />)}</div>
        ) : (
          <EmptyState title="Ninguém por aqui ainda">Toque em “Seguir” nos cartões dos políticos para acompanhá-los e filtrar o feed por eles.</EmptyState>
        )
      ) : (
        <div className="space-y-8">
          {(() => {
            const execs = filtered.filter((p) => EXEC[scope].includes(p.role)).sort((a, b) => EXEC[scope].indexOf(a.role) - EXEC[scope].indexOf(b.role));
            return execs.length > 0 && (
              <section aria-label="Executivo">
                <h2 className="eyebrow mb-3">Executivo</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{execs.map((p, i) => <ExecutiveCard key={p.id} p={p} following={followSet.has(p.id)} index={i} />)}</div>
              </section>
            );
          })()}
          {LEGIS[scope].map((role) => {
            const list = filtered.filter((p) => p.role === role);
            if (!list.length) return null;
            return (
              <section key={role} aria-label={PLURAL[role]}>
                <h2 className="mb-3 flex items-center gap-2.5">
                  <span className="display text-xl font-semibold">{PLURAL[role]}</span>
                  <span className="chip">{list.length}</span>
                  <span className="h-px flex-1 bg-line" />
                </h2>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((p, i) => <PoliticianCard key={p.id} p={p} following={followSet.has(p.id)} index={i} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
