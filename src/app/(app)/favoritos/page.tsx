import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { EmptyState, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Favoritos" };
export const dynamic = "force-dynamic";

export default async function FavoritosPage() {
  const user = await requireUser();
  const favs = await db.favorite.findMany({
    where: { userId: user.id },
    include: { article: { include: { source: { select: { name: true, category: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Guardadas para depois" title="Favoritos" />
      {favs.length ? (
        <div className="space-y-3.5">{favs.map((f, i) => <ArticleCard key={f.articleId} index={i} a={{ ...f.article, favorited: true, alsoIn: [] }} />)}</div>
      ) : (
        <EmptyState title="Nenhuma notícia salva" action={<Link href="/" className="btn btn-primary">Ir para o feed</Link>}>
          Toque na estrela de uma notícia para guardá-la aqui. Favoritas não são apagadas na limpeza automática.
        </EmptyState>
      )}
    </div>
  );
}
