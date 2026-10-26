import Link from "next/link";
import { notFound } from "next/navigation";
import type { PoliticianRole } from "@prisma/client";
import { setMyParty } from "@/app/actions";
import { AskButton } from "@/components/agent/ask-button";
import { ArticleCard } from "@/components/article-card";
import { PoliticianCard } from "@/components/politician-card";
import { EmptyState } from "@/components/ui";
import { db } from "@/lib/db";
import { collapseClusters } from "@/lib/feed";
import { partyBySlug, politicianPartyValues, slugOf } from "@/lib/parties";
import { PARTIES, PILLARS, SEAL_LABEL } from "@/lib/quiz/data";
import { CUST_LABEL, ECON_LABEL, boxName, partyPositions } from "@/lib/quiz/calc";
import { Radar } from "@/components/quiz/radar";
import { describePillar, fmtPos, POLE_LABEL, radarBand } from "@/lib/quiz/describe";
import { ROLE_LABEL, UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const p = partyBySlug((await params).slug);
  return { title: p ? `${p.sigla} · ${p.nome}` : "Partido" };
}

const ROLE_ORDER: PoliticianRole[] = ["PRESIDENTE", "VICE_PRESIDENTE", "GOVERNADOR", "VICE_GOVERNADOR", "SENADOR", "DEPUTADO_FEDERAL", "DEPUTADO_ESTADUAL", "PREFEITO", "VICE_PREFEITO", "VEREADOR"];

function PillarBar({ label, pos, poles }: { label: string; pos: number; poles: [string, string] }) {
  const left = ((pos + 10) / 20) * 100;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm"><span className="font-medium">{label}</span><b className="tabular-nums text-brand" title="Posição de −10 a +10">{fmtPos(pos)}</b></div>
      <div className="relative h-2 rounded-full bg-line">
        <div className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
        <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand shadow" style={{ left: `${Math.min(97, Math.max(3, left))}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-faint"><span>{poles[0]}</span><span>{poles[1]}</span></div>
    </div>
  );
}

export default async function PartidoPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const party = partyBySlug((await params).slug);
  if (!party) notFound();

  const values = politicianPartyValues(party.sigla);
  const [counts, local, articles, ownArticles, fed] = await Promise.all([
    db.politician.groupBy({ by: ["role"], where: { party: { in: values } }, _count: true }),
    db.politician.findMany({
      where: {
        party: { in: values },
        OR: [
          { role: { in: ["SENADOR", "DEPUTADO_FEDERAL", "DEPUTADO_ESTADUAL", "GOVERNADOR", "VICE_GOVERNADOR"] }, uf: user.uf },
          { role: { in: ["PREFEITO", "VICE_PREFEITO", "VEREADOR"] }, uf: user.uf, municipalityKey: user.municipalityKey },
          { role: { in: ["PRESIDENTE", "VICE_PRESIDENTE"] } },
        ],
      },
      orderBy: [{ name: "asc" }],
      take: 120,
    }),
    db.article.findMany({
      where: { classified: true, factCheck: false, parties: { has: party.sigla }, source: { category: { not: "PARTIDO" } } },
      include: { source: { select: { name: true, category: true, tier: true } } },
      orderBy: { publishedAt: "desc" },
      take: 12,
    }),
    db.article.findMany({
      where: { classified: true, factCheck: false, parties: { has: party.sigla }, source: { category: "PARTIDO" } },
      include: { source: { select: { name: true, category: true, tier: true } } },
      orderBy: { publishedAt: "desc" },
      take: 8,
    }),
    db.follow.findMany({ where: { userId: user.id }, select: { politicianId: true } }),
  ]);
  const following = new Set(fed.map((f) => f.politicianId));
  const favs = await db.favorite.findMany({ where: { userId: user.id, articleId: { in: [...articles, ...ownArticles].map((r) => r.id) } }, select: { articleId: true } });
  const fav = new Set(favs.map((f) => f.articleId));
  const news = collapseClusters(articles).slice(0, 8);
  const own = collapseClusters(ownArticles).slice(0, 6);

  const pos = partyPositions().find((x) => x.party.sigla === party.sigla)!;
  const isMine = user.party === party.sigla;
  const total = counts.reduce((a, c) => a + c._count, 0);
  const byRole = new Map(counts.map((c) => [c.role, c._count]));
  const others = PARTIES.filter((p) => p.sigla !== party.sigla && p.federacao && p.federacao === party.federacao);
  const placement = party.box === "mixed" ? "Sem caixa única: o partido tem posições variadas" : party.box === "undefined" ? "Perfil pouco definido" : boxName(pos.eco, pos.cus);

  return (
    <div className="space-y-8">
      <Link href="/partidos" className="btn btn-ghost btn-sm -ml-2">← Partidos</Link>

      <section className="card p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Partido</p>
            <h1 className="display text-4xl font-semibold leading-tight sm:text-5xl">{party.sigla}</h1>
            <p className="mt-1 text-muted">{party.nome}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {party.federacao && <span className="rounded-full bg-brand-soft px-2.5 py-1 font-semibold">Federação {party.federacao}</span>}
              {party.seal && <span className="rounded-full bg-ink/5 px-2.5 py-1 font-semibold" title="Como o partido age na prática (alianças e negociação)">Estilo: {SEAL_LABEL[party.seal]}</span>}
              <span className="rounded-full bg-ink/5 px-2.5 py-1 font-semibold">Confiança da estimativa: {party.conf}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <AskButton focus={{
            title: `${party.sigla} · ${party.nome}`,
            text: `Partido: ${party.sigla} (${party.nome})${party.federacao ? `; federação ${party.federacao}` : ""}. Caixa no mapa do quiz: ${placement}. ${party.box !== "undefined" ? `Posições estimadas pelo app (−10 a +10; confiança ${party.conf}): ${PILLARS.filter((x) => x.id !== "estilo").map((x) => `${x.label} ${fmtPos(pos.pillars[x.id as "economia"] ?? 0)} (${radarBand(x.id as "economia", pos.pillars[x.id as "economia"] ?? 0)})`).join("; ")}.` : "Perfil pouco definido."}${party.seal ? ` Estilo: ${SEAL_LABEL[party.seal]}.` : ""} Eleitos no cadastro: ${total}.`,
            suggestions: ["O que esse partido defende?", "Como ele costuma votar?", "Em que ele se difere do meu perfil?", "Quem são os principais nomes dele na minha região?"],
          }} />
          <form action={setMyParty}>
            <input type="hidden" name="back" value={`/partidos/${slugOf(party.sigla)}`} />
            <input type="hidden" name="party" value={isMine ? "NONE" : party.sigla} />
            <button type="submit" className={`btn ${isMine ? "btn-primary" : "btn-secondary"}`}>{isMine ? "✓ É o meu partido" : "Definir como meu partido"}</button>
          </form>
          </div>
        </div>
        {others.length > 0 && <p className="mt-4 text-sm text-muted">Federado com {others.map((o, i) => <span key={o.sigla}>{i ? ", " : ""}<Link href={`/partidos/${slugOf(o.sigla)}`} className="font-semibold text-ink underline-offset-4 hover:underline">{o.sigla}</Link></span>)}. Partidos federados atuam como um só por pelo menos quatro anos.</p>}
      </section>

      <section className="card p-5 sm:p-8">
        <p className="eyebrow">Perfil</p>
        <h2 className="display text-2xl font-semibold">{placement}</h2>
        {party.box === null && (
          <p className="mt-1 text-sm text-muted">
            Economia: {ECON_LABEL[pos.eco].toLowerCase()} · Costumes: {CUST_LABEL[pos.cus].toLowerCase()}. Esta é a caixa fixa do partido no mapa do <Link href="/perfil" className="font-semibold text-brand underline-offset-4 hover:underline">quiz de perfil político</Link>.
          </p>
        )}
        {party.box === "mixed" && <p className="mt-1 text-sm text-muted">Partidos com bancadas e diretórios de posições variadas não ganham uma caixa única. Abaixo, a posição média estimada.</p>}
        {party.box === "undefined" && <p className="mt-1 text-sm text-muted">Há pouca informação documentada, então não estimamos posições por pilar.</p>}

        {party.box !== "undefined" && (
          <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid grid-cols-1 gap-x-10 gap-y-6 xl:grid-cols-2">
              {PILLARS.filter((p) => p.id !== "estilo").map((pl) => {
                const id = pl.id as Exclude<typeof pl.id, "estilo">;
                const v = pos.pillars[id] ?? 0;
                return (
                  <div key={id}>
                    <PillarBar label={pl.label} pos={v} poles={POLE_LABEL[id]} />
                    <p className="mt-2 text-sm text-muted">{describePillar(id, v)}</p>
                  </div>
                );
              })}
            </div>
            <div className="mx-auto w-full max-w-[22rem] lg:sticky lg:top-24">
              <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-muted">Posição em cada tema</p>
              <Radar
                label={`Posição do ${party.sigla} em cada tema`}
                size={320}
                axes={(["economia", "costumes", "seguranca", "ambiente", "educacao"] as const).map((id) => {
                  const v = pos.pillars[id] ?? 0;
                  const label = { economia: "Economia", costumes: "Costumes", seguranca: "Segurança", ambiente: "Ambiente", educacao: "Educação" }[id];
                  return { label, value: (v + 10) / 2, text: `${radarBand(id, v)} · ${fmtPos(v)}` };
                })}
              />
              <p className="mt-1 text-center text-[11px] text-faint">Perto do centro: Mais Estado, Progressista, Social, Preservação, Ensino público. Perto da borda: o polo oposto.</p>
            </div>
          </div>
        )}
        {party.seal && (
          <p className="mt-6 text-sm"><b>Estilo:</b> {SEAL_LABEL[party.seal]} <span className="text-muted">— como o partido age na prática (alianças, negociação, coerência), com confiança baixa.</span></p>
        )}
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-faint">
          Estimativa do app (outubro de 2026) a partir de programa, estatuto, alianças e votações. É uma simplificação e não um julgamento: leia o programa do partido e confira como as bancadas votam. Nenhum partido é recomendado aqui.
        </p>
      </section>

      <section aria-label="Eleitos">
        <h2 className="display mb-1 text-2xl font-semibold">Pessoas eleitas</h2>
        <p className="mb-4 text-sm text-muted">{total ? `${total.toLocaleString("pt-BR")} mandatos cadastrados no Brasil.` : "Nenhum mandato cadastrado para este partido."}</p>
        {total > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {ROLE_ORDER.filter((r) => byRole.get(r)).map((r) => (
              <span key={r} className="rounded-full bg-ink/5 px-3 py-1 text-sm"><b>{byRole.get(r)!.toLocaleString("pt-BR")}</b> <span className="text-muted">{ROLE_LABEL[r].replace("(a)", "")}</span></span>
            ))}
          </div>
        )}
        {local.length > 0 ? (
          <>
            <p className="mb-3 text-sm font-semibold">No seu estado ({UFS[user.uf]}) e na sua cidade ({user.municipality})</p>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              {[...local].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)).map((p, i) => <PoliticianCard key={p.id} p={p} following={following.has(p.id)} showRole index={i} />)}
            </div>
          </>
        ) : total > 0 ? (
          <p className="text-sm text-muted">Nenhuma pessoa deste partido cadastrada no seu estado ou cidade.</p>
        ) : null}
      </section>

      {own.length > 0 && (
        <section aria-label="Do próprio partido">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2 className="display text-2xl font-semibold">Do próprio partido</h2>
            <Link href={`/partidos?visao=todos&partido=${slugOf(party.sigla)}&fonte=partido`} className="text-sm font-semibold text-brand underline-offset-4 hover:underline">Ver todas →</Link>
          </div>
          <p className="-mt-2 mb-4 text-sm text-muted">Publicações do site oficial do {party.sigla}. É a comunicação do próprio partido, não de um veículo independente.</p>
          <div className="grid grid-cols-1 gap-3.5">{own.map((a, i) => <ArticleCard key={a.id} index={i} a={{ ...a, favorited: fav.has(a.id) }} />)}</div>
        </section>
      )}

      <section aria-label="Notícias">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 className="display text-2xl font-semibold">Na imprensa</h2>
          <Link href={`/partidos?visao=todos&partido=${slugOf(party.sigla)}&fonte=imprensa`} className="text-sm font-semibold text-brand underline-offset-4 hover:underline">Ver todas →</Link>
        </div>
        {news.length ? (
          <div className="grid grid-cols-1 gap-3.5">{news.map((a, i) => <ArticleCard key={a.id} index={i} a={{ ...a, favorited: fav.has(a.id) }} />)}</div>
        ) : (
          <EmptyState title="Sem notícias recentes">Ainda não achamos matérias que citem o {party.sigla}.</EmptyState>
        )}
      </section>
    </div>
  );
}
