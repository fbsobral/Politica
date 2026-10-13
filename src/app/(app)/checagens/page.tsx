import Link from "next/link";
import type { Scope } from "@prisma/client";
import { ArticleCard } from "@/components/article-card";
import { EmptyState, PageHeader, ScopeTabs } from "@/components/ui";
import { db } from "@/lib/db";
import { collapseClusters, scopeWhere } from "@/lib/feed";
import { SCOPE_SLUG, UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Checagem de fatos" };
export const dynamic = "force-dynamic";
const PAGE = 30;

export default async function ChecagensPage({ searchParams }: { searchParams: Promise<{ esfera?: string; pagina?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope: Scope = SCOPE_SLUG[sp.esfera ?? "municipal"] ?? "MUNICIPAL";
  const page = Math.max(1, Number(sp.pagina) || 1);
  const rows = await db.article.findMany({
    where: { factCheck: true, classified: true, ...scopeWhere(user, scope) },
    include: { source: { select: { name: true, category: true, tier: true } } },
    orderBy: { publishedAt: "desc" },
    take: PAGE + 1,
    skip: (page - 1) * PAGE,
  });
  const favs = await db.favorite.findMany({ where: { userId: user.id, articleId: { in: rows.map((r) => r.id) } }, select: { articleId: true } });
  const fav = new Set(favs.map((f) => f.articleId));
  const list = collapseClusters(rows.slice(0, PAGE));
  const place = scope === "MUNICIPAL" ? user.municipality : scope === "ESTADUAL" ? UFS[user.uf] : "Brasil";
  const link = (p: number) => `/checagens?esfera=${scope.toLowerCase()}&pagina=${p}`;
  return (
    <div>
      <PageHeader eyebrow="Agência Lupa · Aos Fatos · Comprova · busca local" title={`Checagens · ${place}`} />
      <ScopeTabs base="/checagens" scope={scope} />
      {list.length ? (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">{list.map((a, i) => <ArticleCard key={a.id} index={i} a={{ ...a, favorited: fav.has(a.id) }} />)}</div>
      ) : (
        <EmptyState title="Nenhuma checagem nesta esfera ainda">
          {scope === "FEDERAL" ? "As agências de checagem são lidas a cada hora pelo robô." : "As agências de checagem são nacionais; para o local o robô busca no Google News reportagens de checagem sobre o seu estado e cidade. Se acabou de configurar, rode a coleta em Admin → Robô."}
        </EmptyState>
      )}
      {(page > 1 || rows.length > PAGE) && (
        <nav className="flex justify-between pt-6">
          {page > 1 ? <Link href={link(page - 1)} className="btn btn-secondary">← Mais recentes</Link> : <span />}
          {rows.length > PAGE && <Link href={link(page + 1)} className="btn btn-secondary">Mais antigas →</Link>}
        </nav>
      )}
    </div>
  );
}
