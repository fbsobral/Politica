import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Checagem de fatos" };
export const dynamic = "force-dynamic";
const PAGE = 30;

export default async function ChecagensPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const user = await requireUser();
  const page = Math.max(1, Number((await searchParams).pagina) || 1);
  const rows = await db.article.findMany({
    where: { source: { factCheck: true } },
    include: { source: { select: { name: true, category: true } } },
    orderBy: { publishedAt: "desc" },
    take: PAGE + 1,
    skip: (page - 1) * PAGE,
  });
  const favs = await db.favorite.findMany({ where: { userId: user.id, articleId: { in: rows.map((r) => r.id) } }, select: { articleId: true } });
  const fav = new Set(favs.map((f) => f.articleId));
  const list = rows.slice(0, PAGE);
  return (
    <div>
      <PageHeader eyebrow="Agência Lupa · Aos Fatos · Comprova" title="Checagem de fatos" />
      <p className="-mt-3 mb-6 max-w-2xl text-[0.9375rem] text-muted">Boatos e declarações de políticos verificados por agências de checagem independentes.</p>
      {list.length ? (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">{list.map((a, i) => <ArticleCard key={a.id} index={i} a={{ ...a, favorited: fav.has(a.id), alsoIn: [] }} />)}</div>
      ) : (
        <EmptyState title="Nenhuma checagem coletada ainda">As agências são lidas a cada hora pelo robô. Se acabou de configurar, rode a coleta em Admin → Robô.</EmptyState>
      )}
      {(page > 1 || rows.length > PAGE) && (
        <nav className="flex justify-between pt-6">
          {page > 1 ? <Link href={`/checagens?pagina=${page - 1}`} className="btn btn-secondary">← Mais recentes</Link> : <span />}
          {rows.length > PAGE && <Link href={`/checagens?pagina=${page + 1}`} className="btn btn-secondary">Mais antigas →</Link>}
        </nav>
      )}
    </div>
  );
}
