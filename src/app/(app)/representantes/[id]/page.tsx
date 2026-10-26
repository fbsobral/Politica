import Link from "next/link";
import { AskButton } from "@/components/agent/ask-button";
import { notFound } from "next/navigation";
import { togglePoliticianAlert } from "@/app/actions";
import { ArticleCard } from "@/components/article-card";
import { IconBell, IconMail, IconPhone, IconPin, IconExternal } from "@/components/icons";
import { Avatar, FollowButton } from "@/components/politician-card";
import { PoliticianExtra } from "@/components/politician-extra";
import { EmptyState, PartyBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { collapseClusters } from "@/lib/feed";
import { normalize } from "@/lib/text";
import { ROLE_LABEL, UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const dynamic = "force-dynamic";

export default async function PoliticianPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const p = await db.politician.findUnique({ where: { id } });
  if (!p) notFound();

  const [follow, alert] = await Promise.all([
    db.follow.findUnique({ where: { userId_politicianId: { userId: user.id, politicianId: p.id } } }),
    db.alert.findFirst({ where: { userId: user.id, politicianId: p.id } }),
  ]);

  const needles = [...new Set([p.ballotName, p.name].filter(Boolean).map((n) => normalize(n!)).filter((n) => n.length >= 5))];
  const articles = needles.length
    ? await db.article.findMany({
        where: { classified: true, OR: needles.map((n) => ({ searchText: { contains: n } })) },
        include: { source: { select: { name: true, category: true, tier: true } } },
        orderBy: { publishedAt: "desc" },
        take: 15,
      })
    : [];
  const unique = collapseClusters(articles);
  const favs = await db.favorite.findMany({ where: { userId: user.id, articleId: { in: unique.map((a) => a.id) } }, select: { articleId: true } });
  const favSet = new Set(favs.map((f) => f.articleId));
  const place = [p.municipality, p.uf ? UFS[p.uf] : null].filter(Boolean).join(" · ");

  return (
    <div className="space-y-8">
      <Link href="/representantes" className="btn btn-ghost btn-sm -ml-2">← Representantes</Link>

      <section className="card relative overflow-hidden">
        <div aria-hidden className="h-24 bg-gradient-to-br from-brand to-brand/60 sm:h-28" style={{ backgroundImage: "radial-gradient(circle at 85% 20%, color-mix(in srgb, var(--gold) 55%, transparent), transparent 40%), linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 55%, var(--ink)))" }} />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4 sm:-mt-14">
            <div className="rounded-full bg-surface p-1.5"><Avatar p={p} size={96} /></div>
            <div className="flex flex-wrap gap-2 pb-1">
              <FollowButton id={p.id} following={Boolean(follow)} />
              <form action={togglePoliticianAlert.bind(null, p.id)}>
                <button className={`btn btn-sm ${alert ? "btn-primary" : "btn-secondary"}`} aria-pressed={Boolean(alert)}>
                  <IconBell width={16} height={16} /> {alert ? "Alertas ativos" : "Receber alertas"}
                </button>
              </form>
            </div>
          </div>
          <p className="eyebrow mt-4">{ROLE_LABEL[p.role]}</p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="display text-3xl font-semibold leading-tight sm:text-4xl">{p.ballotName ?? p.name}</h1>
            <AskButton focus={{ title: `${p.ballotName ?? p.name} · ${ROLE_LABEL[p.role]}`, text: `Político: ${p.ballotName ?? p.name} (nome civil: ${p.name}). Cargo: ${ROLE_LABEL[p.role]}. Partido: ${p.party ?? "sem partido"}. ${place ? `Local: ${place}. ` : ""}${p.mandate ? `Mandato: ${p.mandate}. ` : ""}Para notícias recentes sobre essa pessoa, use a ferramenta de busca.`, suggestions: ["O que essa pessoa faz no cargo?", "Quais as notícias recentes sobre essa pessoa?", "Qual a posição do partido dela nos temas principais?"] }} />
          </div>
          {p.ballotName && p.ballotName !== p.name && <p className="mt-0.5 text-sm text-muted">{p.name}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <PartyBadge party={p.party} />
            {place && <span className="flex items-center gap-1.5"><IconPin /> {place}</span>}
            {p.mandate && <span>Mandato {p.mandate}</span>}
          </div>
          {(p.email || p.phone || p.profileUrl) && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
              {p.email && <a className="btn btn-secondary btn-sm" href={`mailto:${p.email}`}><IconMail /> {p.email}</a>}
              {p.phone && <a className="btn btn-secondary btn-sm" href={`tel:${p.phone}`}><IconPhone /> {p.phone}</a>}
              {p.profileUrl && <a className="btn btn-secondary btn-sm" href={p.profileUrl} target="_blank" rel="noopener noreferrer">Perfil oficial <IconExternal /></a>}
            </div>
          )}
        </div>
      </section>

      <PoliticianExtra p={p} />

      <section className="space-y-3.5">
        <h2 className="display text-2xl font-semibold">Nas notícias</h2>
        {unique.length ? (
          unique.map((a, i) => <ArticleCard key={a.id} index={i} a={{ ...a, favorited: favSet.has(a.id) }} />)
        ) : (
          <EmptyState title="Sem menções recentes">Nenhuma notícia dos últimos dias cita este nome. Ative os alertas para ser avisado quando aparecer.</EmptyState>
        )}
      </section>
    </div>
  );
}
