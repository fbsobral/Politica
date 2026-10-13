import Link from "next/link";
import type { Branch, NewsCategory, Scope, SourceCategory } from "@prisma/client";
import { ArticleCard, FeaturedCard, type ArticleView } from "@/components/article-card";
import { FeedFilters } from "@/components/feed-filters";
import { IconFilter, IconX } from "@/components/icons";
import { EmptyState, SCOPE_DOT } from "@/components/ui";
import { db } from "@/lib/db";
import { daysToRunoff } from "@/lib/election";
import { buildWhere, scopeWhere } from "@/lib/feed";
import { BRANCH_LABEL, BRANCH_VALUES, NEWS_CATEGORY_LABEL, SCOPE_LABEL, SCOPE_SLUG, SOURCE_CATEGORY_LABEL, UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Feed" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;
const PAGE = 40;

function href(sp: SP, patch: SP): string {
  const merged = { ...sp, ...patch };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
  return `/?${qs.toString()}`;
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope: Scope = SCOPE_SLUG[sp.esfera ?? "municipal"] ?? "MUNICIPAL";
  const agrupar = ["veiculo", "tipo", "categoria"].includes(sp.agrupar ?? "") ? sp.agrupar! : "";
  const page = Math.max(1, Number(sp.pagina) || 1);
  const params = { scope, tipo: sp.tipo, veiculo: sp.veiculo, cat: sp.cat, poder: sp.poder, nivel: sp.nivel, q: sp.q, seguindo: sp.seguindo === "1" };

  const where = await buildWhere(user, params);
  const facetWhere = (await buildWhere(user, { scope }))!;
  const branchFacetWhere = (await buildWhere(user, { ...params, poder: undefined }))!;
  const [rows, scopeCounts, bySource, byCat, byBranch] = await Promise.all([
    where
      ? db.article.findMany({
          where,
          include: { source: { select: { name: true, category: true, tier: true } } },
          orderBy: { publishedAt: "desc" },
          take: agrupar ? 200 : PAGE + 1,
          skip: agrupar ? 0 : (page - 1) * PAGE,
        })
      : Promise.resolve([]),
    Promise.all((["MUNICIPAL", "ESTADUAL", "FEDERAL"] as Scope[]).map((s) => db.article.count({ where: { classified: true, ...scopeWhere(user, s) } }))),
    db.article.groupBy({ by: ["sourceId"], where: facetWhere, _count: true }),
    db.article.groupBy({ by: ["category"], where: facetWhere, _count: true }),
    db.article.groupBy({ by: ["branch"], where: branchFacetWhere, _count: true }),
  ]);
  const hasMore = !agrupar && rows.length > PAGE;
  const pageRows = agrupar ? rows : rows.slice(0, PAGE);

  const favs = await db.favorite.findMany({ where: { userId: user.id, articleId: { in: pageRows.map((r) => r.id) } }, select: { articleId: true } });
  const sources = await db.source.findMany({ where: { id: { in: bySource.map((s) => s.sourceId) } }, select: { id: true, name: true, category: true } });
  const srcById = new Map(sources.map((s) => [s.id, s]));
  const tipoCount = new Map<SourceCategory, number>();
  for (const s of bySource) {
    const c = srcById.get(s.sourceId)?.category;
    if (c) tipoCount.set(c, (tipoCount.get(c) ?? 0) + s._count);
  }
  const filterData = {
    scope,
    sp,
    tipos: [...tipoCount.entries()].sort((a, b) => b[1] - a[1]),
    sources: sources
      .filter((s) => !sp.tipo || s.category === sp.tipo)
      .map((s) => ({ id: s.id, name: s.name, n: bySource.find((b) => b.sourceId === s.id)?._count ?? 0 }))
      .sort((a, b) => b.n - a.n),
    cats: byCat.map((c) => ({ category: c.category as NewsCategory, n: c._count })).sort((a, b) => b.n - a.n),
  };

  // agrupa o mesmo assunto publicado por vários veículos
  const favSet = new Set(favs.map((f) => f.articleId));
  const clusters = new Map<string, typeof pageRows>();
  for (const r of pageRows) clusters.set(r.clusterKey, [...(clusters.get(r.clusterKey) ?? []), r]);
  const views: ArticleView[] = [...clusters.values()].map((group) => {
    const a = group[0];
    return {
      id: a.id,
      url: a.url,
      title: a.title,
      description: a.description,
      imageUrl: a.imageUrl ?? group.find((g) => g.imageUrl)?.imageUrl ?? null,
      publishedAt: a.publishedAt,
      category: a.category,
      branch: a.branch,
      source: a.source,
      favorited: favSet.has(a.id),
      alsoIn: [...new Set(group.slice(1).map((g) => g.source.name).filter((n) => n !== a.source.name))].slice(0, 4),
    };
  });

  let groups: { title: string; items: ArticleView[] }[] = [];
  if (agrupar) {
    const map = new Map<string, ArticleView[]>();
    for (const v of views) {
      const key = agrupar === "veiculo" ? v.source.name : agrupar === "tipo" ? SOURCE_CATEGORY_LABEL[v.source.category] : NEWS_CATEGORY_LABEL[v.category];
      map.set(key, [...(map.get(key) ?? []), v]);
    }
    groups = [...map.entries()].map(([title, items]) => ({ title, items })).sort((a, b) => b.items.length - a.items.length);
  }

  const place = scope === "MUNICIPAL" ? user.municipality : scope === "ESTADUAL" ? UFS[user.uf] : "Brasil";
  const today = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const activeCount = [sp.tipo, sp.veiculo, sp.cat, sp.poder, sp.nivel, sp.q, sp.seguindo, sp.agrupar].filter(Boolean).length;
  const chips: { label: string; clear: SP }[] = [];
  if (sp.q) chips.push({ label: `“${sp.q}”`, clear: { q: undefined } });
  if (sp.tipo) chips.push({ label: SOURCE_CATEGORY_LABEL[sp.tipo as SourceCategory] ?? sp.tipo, clear: { tipo: undefined, veiculo: undefined } });
  if (sp.veiculo) chips.push({ label: srcById.get(sp.veiculo)?.name ?? "Veículo", clear: { veiculo: undefined } });
  if (sp.poder) chips.push({ label: BRANCH_LABEL[sp.poder as Branch] ?? sp.poder, clear: { poder: undefined } });
  if (sp.nivel) chips.push({ label: sp.nivel === "1" ? "Só Tier 1" : "Tier 1 e 2", clear: { nivel: undefined } });
  if (sp.cat) chips.push({ label: NEWS_CATEGORY_LABEL[sp.cat as NewsCategory] ?? sp.cat, clear: { cat: undefined } });
  if (sp.seguindo) chips.push({ label: "Quem eu sigo", clear: { seguindo: undefined } });

  const showFeatured = !agrupar && page === 1 && views.length > 3 && Boolean(views[0].imageUrl);

  return (
    <div>
      <header className="mb-6">
        <p className="eyebrow mb-1 block first-letter:uppercase">{today}</p>
        <h1 className="display text-4xl font-semibold leading-none sm:text-5xl">{place}</h1>
      </header>

      {daysToRunoff() >= 0 && (
        <Link href="/eleicoes" className="card-flat mb-5 flex items-center justify-between gap-3 px-4 py-3 text-sm transition-shadow hover:shadow-card">
          <span><b>{daysToRunoff() === 0 ? "Hoje é o 2º turno." : `2º turno em ${daysToRunoff()} ${daysToRunoff() === 1 ? "dia" : "dias"}.`}</b> <span className="text-muted">Candidatos, pesquisas e notícias por cargo.</span></span>
          <span aria-hidden className="text-brand">→</span>
        </Link>
      )}

      <div role="tablist" aria-label="Esfera" className="mb-6 grid grid-cols-3 gap-1 rounded-2xl border border-line bg-surface p-1 shadow-card sm:inline-grid sm:min-w-[28rem]">
        {(["MUNICIPAL", "ESTADUAL", "FEDERAL"] as Scope[]).map((s, i) => {
          const active = s === scope;
          return (
            <Link
              key={s}
              role="tab"
              aria-selected={active}
              href={href({ ...sp, pagina: undefined, veiculo: undefined }, { esfera: s.toLowerCase() })}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${active ? "bg-ink text-paper" : "text-muted hover:bg-ink/5 hover:text-ink"}`}
            >
              <span className={`h-2 w-2 rounded-full ${SCOPE_DOT[s]}`} />
              {SCOPE_LABEL[s]}
              <span className={`hidden text-xs font-medium sm:inline ${active ? "opacity-70" : "text-faint"}`}>{scopeCounts[i]}</span>
            </Link>
          );
        })}
      </div>

      <nav aria-label="Poder" className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {[{ v: "", l: "Todos os poderes", n: byBranch.reduce((a, b) => a + b._count, 0) }, ...BRANCH_VALUES.map((b) => ({ v: b, l: BRANCH_LABEL[b], n: byBranch.find((x) => x.branch === b)?._count ?? 0 }))].map((b) => {
          const active = (sp.poder ?? "") === b.v;
          return (
            <Link key={b.v} href={href({ ...sp, pagina: undefined }, { poder: b.v || undefined })} aria-current={active ? "true" : undefined} className={`flex flex-none items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${active ? "border-brand bg-brand-soft text-brand" : "border-line-strong bg-surface text-muted hover:text-ink"}`}>
              {b.l} <span className="text-xs font-medium opacity-60">{b.n}</span>
            </Link>
          );
        })}
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
        <section aria-label="Notícias" className="min-w-0 space-y-4">
          <details className="card-flat group lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2"><IconFilter width={18} height={18} /> Filtros e busca</span>
              {activeCount > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-brand-ink">{activeCount}</span>}
            </summary>
            <div className="border-t border-line p-4"><FeedFilters d={filterData} idPrefix="m" /></div>
          </details>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <Link key={c.label} href={href({ ...sp, pagina: undefined }, c.clear)} className="chip !bg-brand-soft !text-brand hover:opacity-80" aria-label={`Remover filtro ${c.label}`}>
                  {c.label} <IconX />
                </Link>
              ))}
            </div>
          )}

          {!views.length && (
            <EmptyState
              title={sp.seguindo === "1" && !where ? "Você ainda não segue ninguém" : "Nada por aqui — ainda"}
              action={sp.seguindo === "1" && !where ? <Link className="btn btn-primary" href="/representantes">Ver representantes</Link> : undefined}
            >
              {sp.seguindo === "1" && !where
                ? "Siga políticos na aba Representantes para montar um feed só com o que importa para você."
                : activeCount > 0
                  ? "Nenhuma notícia combina com esses filtros. Tente remover algum."
                  : "O robô coleta novas notícias a cada hora. As da sua cidade aparecem logo após a primeira coleta depois do cadastro."}
            </EmptyState>
          )}

          {agrupar ? (
            groups.map((g) => (
              <section key={g.title} className="space-y-3 pt-2">
                <h2 className="flex items-center gap-2.5">
                  <span className="display text-xl font-semibold">{g.title}</span>
                  <span className="chip">{g.items.length}</span>
                  <span className="h-px flex-1 bg-line" />
                </h2>
                {g.items.map((a, i) => <ArticleCard key={a.id} a={a} index={i} />)}
              </section>
            ))
          ) : (
            <div className="space-y-3.5">
              {showFeatured && <FeaturedCard a={views[0]} />}
              {views.slice(showFeatured ? 1 : 0).map((a, i) => <ArticleCard key={a.id} a={a} index={i} />)}
            </div>
          )}

          {!agrupar && (page > 1 || hasMore) && (
            <nav className="flex items-center justify-between pt-2" aria-label="Paginação">
              {page > 1 ? <Link href={href(sp, { pagina: String(page - 1) })} className="btn btn-secondary">← Mais recentes</Link> : <span />}
              {hasMore && <Link href={href(sp, { pagina: String(page + 1) })} className="btn btn-secondary">Mais antigas →</Link>}
            </nav>
          )}
        </section>

        <aside className="hidden lg:block">
          <div className="card sticky top-20 p-5">
            <h2 className="display mb-4 text-lg font-semibold">Filtros</h2>
            <FeedFilters d={filterData} idPrefix="d" />
          </div>
        </aside>
      </div>
    </div>
  );
}
