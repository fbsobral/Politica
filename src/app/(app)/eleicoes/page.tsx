import Link from "next/link";
import type { ElectionOffice, Prisma } from "@prisma/client";
import { ArticleCard } from "@/components/article-card";
import { Avatar } from "@/components/politician-card";
import { EmptyState, PageHeader, PartyBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { CALENDAR, daysToRunoff, ELECTION, OFFICE_LABEL, OFFICE_VALUES, VOTING_TIPS } from "@/lib/election";
import { collapseClusters } from "@/lib/feed";
import { UFS } from "@/lib/taxonomy";
import { NIVEL_OPTIONS, tiersFor } from "@/lib/tier-legend";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Eleições" };
export const dynamic = "force-dynamic";
const PAGE = 30;

const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

export default async function EleicoesPage({ searchParams }: { searchParams: Promise<{ cargo?: string; pagina?: string; nivel?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const cargo = (OFFICE_VALUES as string[]).includes(sp.cargo ?? "") ? (sp.cargo as ElectionOffice) : null;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const left = daysToRunoff();
  const tiers = tiersFor(sp.nivel);
  const tierWhere: Prisma.ArticleWhereInput = tiers ? { source: { tier: { in: tiers } } } : {};

  // notícias de eleição relevantes para o usuário: nacionais + do estado + da cidade
  const relevant: Prisma.ArticleWhereInput = {
    OR: [{ scope: "FEDERAL" }, { scope: "ESTADUAL", uf: user.uf }, { scope: "MUNICIPAL", uf: user.uf, municipalityKey: user.municipalityKey }],
  };
  // governador/senado/deputados de outros estados não interessam; presidente vale para todos
  const cargoWhere: Prisma.ArticleWhereInput = cargo
    ? cargo === "PRESIDENTE"
      ? { cargo }
      : { cargo, scope: { not: "FEDERAL" }, uf: user.uf }
    : {};
  const baseWhere: Prisma.ArticleWhereInput = { classified: true, factCheck: false, AND: [relevant, { OR: [{ category: "ELEICOES" }, { cargo: { not: null } }] }] };

  const [rows, polls, checks, candidates, counts] = await Promise.all([
    db.article.findMany({ where: { ...baseWhere, ...cargoWhere, ...tierWhere, poll: false }, include: { source: { select: { name: true, category: true, tier: true } } }, orderBy: { publishedAt: "desc" }, take: PAGE + 1, skip: (page - 1) * PAGE }),
    db.article.findMany({ where: { ...baseWhere, ...cargoWhere, ...tierWhere, poll: true }, include: { source: { select: { name: true, category: true, tier: true } } }, orderBy: { publishedAt: "desc" }, take: 12 }),
    db.article.findMany({
      where: { factCheck: true, classified: true, ...tierWhere, AND: [relevant, { OR: [{ category: "ELEICOES" }, { cargo: { not: null } }, { searchText: { contains: "eleic" } }, { searchText: { contains: "candidat" } }] }, ...(cargo ? [cargoWhere] : [])] },
      include: { source: { select: { name: true, category: true, tier: true } } },
      orderBy: { publishedAt: "desc" },
      take: 8,
    }),
    db.candidate.findMany({
      where: cargo ? { office: cargo, OR: [{ uf: null }, { uf: user.uf }] } : { office: { in: ["PRESIDENTE", "GOVERNADOR"] }, OR: [{ uf: null }, { uf: user.uf }] },
      orderBy: [{ office: "asc" }, { ballotName: "asc" }],
    }),
    db.article.groupBy({ by: ["cargo"], where: { ...baseWhere, cargo: { not: null } }, _count: true }),
  ]);

  const news = collapseClusters(rows.slice(0, PAGE));
  const pollList = collapseClusters(polls).slice(0, 6);
  const checkList = collapseClusters(checks).slice(0, 4);
  const allIds = [...news, ...pollList, ...checkList].map((a) => a.id);
  const favs = await db.favorite.findMany({ where: { userId: user.id, articleId: { in: allIds } }, select: { articleId: true } });
  const fav = new Set(favs.map((f) => f.articleId));
  const card = (a: (typeof news)[number], i: number) => <ArticleCard key={a.id} index={i} a={{ ...a, favorited: fav.has(a.id) }} />;
  const countOf = (c: ElectionOffice) => counts.find((x) => x.cargo === c)?._count ?? 0;

  const nivelQs = sp.nivel ? `nivel=${sp.nivel}` : "";
  const tabHref = (c: string | null) => `/eleicoes${c || nivelQs ? "?" : ""}${[c ? `cargo=${c}` : "", nivelQs].filter(Boolean).join("&")}`;
  const tab = (c: ElectionOffice | null, label: string, n?: number) => (
    <Link key={c ?? "geral"} role="tab" aria-selected={cargo === c} href={tabHref(c)} className={`flex flex-none items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${cargo === c ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-muted hover:text-ink"}`}>
      {label}
      {n !== undefined && <span className={`text-xs font-medium ${cargo === c ? "opacity-70" : "text-faint"}`}>{n}</span>}
    </Link>
  );

  const hero =
    left > 0 ? { big: String(left), small: left === 1 ? "dia para o 2º turno" : "dias para o 2º turno", note: `Domingo, ${DATE.format(new Date(`${ELECTION.runoff}T00:00:00Z`))}` }
    : left === 0 ? { big: "Hoje", small: "é o dia do 2º turno", note: "Votação das 8h às 17h (horário local)" }
    : { big: "✓", small: "2º turno encerrado", note: `Realizado em ${DATE.format(new Date(`${ELECTION.runoff}T00:00:00Z`))}` };

  return (
    <div>
      <PageHeader eyebrow={`Eleições ${ELECTION.year}`} title="Eleições" />

      <section className="card relative mb-6 flex flex-wrap items-center gap-x-8 gap-y-4 overflow-hidden p-5 sm:p-6" style={{ backgroundImage: "radial-gradient(circle at 95% 0%, color-mix(in srgb, var(--gold) 28%, transparent), transparent 45%)" }}>
        <div className="flex items-baseline gap-3">
          <span className="display text-6xl font-semibold leading-none text-brand">{hero.big}</span>
          <span className="max-w-[9rem] text-sm font-semibold leading-tight">{hero.small}</span>
        </div>
        <p className="text-sm text-muted">{hero.note}. Em jogo no seu estado ({UFS[user.uf]}): presidente, governador e senado.</p>
      </section>

      <div role="tablist" aria-label="Cargo" className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {tab(null, "Geral")}
        {OFFICE_VALUES.map((c) => tab(c, OFFICE_LABEL[c], countOf(c)))}
      </div>

      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="eyebrow mr-1">Veículos</span>
        {NIVEL_OPTIONS.map((o) => (
          <Link key={o.v} href={`/eleicoes${cargo || o.v ? "?" : ""}${[cargo ? `cargo=${cargo}` : "", o.v ? `nivel=${o.v}` : ""].filter(Boolean).join("&")}`} className={`rounded-full border px-3 py-1 font-medium ${(sp.nivel ?? "") === o.v ? "border-brand bg-brand-soft text-brand" : "border-line-strong bg-surface text-muted hover:text-ink"}`}>{o.l}</Link>
        ))}
      </div>

      {candidates.length > 0 && (
        <section className="mb-8" aria-label="Candidatos">
          <h2 className="eyebrow mb-3">{cargo ? OFFICE_LABEL[cargo] : "Na disputa"}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {candidates.map((c) => (
              <div key={c.id} className="card relative flex items-center gap-4 overflow-hidden p-4">
                <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gold" />
                <Avatar p={{ name: c.ballotName, photoUrl: null }} size={60} />
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">{OFFICE_LABEL[c.office]}{c.uf ? ` · ${c.uf}` : ""}</p>
                  <p className="display truncate text-lg font-semibold leading-tight">{c.ballotName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <PartyBadge party={c.party} />
                    {c.number && <span>nº {c.number}</span>}
                  </div>
                </div>
                <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${c.status.startsWith("ELEITO") ? "bg-municipal-soft text-municipal" : "bg-brand-soft text-brand"}`}>{c.status.startsWith("ELEITO") ? "Eleito(a)" : "2º turno"}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">Fonte: TSE (candidaturas e resultados), atualizado a cada 6 horas.</p>
        </section>
      )}

      {pollList.length > 0 && (
        <section className="mb-8" aria-label="Pesquisas">
          <h2 className="display mb-3 text-2xl font-semibold">Pesquisas eleitorais</h2>
          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">{pollList.map(card)}</div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Notícias" className="min-w-0">
          <h2 className="display mb-3 text-2xl font-semibold">Notícias{cargo ? ` · ${OFFICE_LABEL[cargo]}` : ""}</h2>
          {news.length ? (
            <div className="space-y-3.5">{news.map(card)}</div>
          ) : (
            <EmptyState title="Nenhuma notícia de eleição por aqui ainda">O robô coleta notícias eleitorais a cada hora. {cargo && cargo !== "PRESIDENTE" ? `Mostramos só o que é do seu estado (${UFS[user.uf]}).` : ""}</EmptyState>
          )}
          {(page > 1 || rows.length > PAGE) && (
            <nav className="flex justify-between pt-5">
              {page > 1 ? <Link href={`${tabHref(cargo)}${cargo || nivelQs ? "&" : "?"}pagina=${page - 1}`} className="btn btn-secondary">← Mais recentes</Link> : <span />}
              {rows.length > PAGE && <Link href={`${tabHref(cargo)}${cargo || nivelQs ? "&" : "?"}pagina=${page + 1}`} className="btn btn-secondary">Mais antigas →</Link>}
            </nav>
          )}
        </section>

        <aside className="space-y-6">
          {checkList.length > 0 && (
            <section>
              <h2 className="display mb-3 text-xl font-semibold">Checagens eleitorais</h2>
              <ul className="space-y-2.5">
                {checkList.map((a) => (
                  <li key={a.id}><a href={a.url} target="_blank" rel="noopener noreferrer" className="card-flat block p-3.5 transition-shadow hover:shadow-card"><span className="eyebrow">{a.source.name}</span><span className="display mt-0.5 block text-[0.95rem] font-semibold leading-snug">{a.title}</span></a></li>
                ))}
              </ul>
              <Link href="/checagens?esfera=federal" className="mt-2 inline-block text-sm text-brand underline">Todas as checagens →</Link>
            </section>
          )}
          <section className="card-flat p-5">
            <h2 className="display mb-3 text-xl font-semibold">Calendário</h2>
            <ul className="space-y-3">
              {CALENDAR.map((c) => (
                <li key={c.date} className="text-sm"><b>{c.title}</b> <span className="text-faint">· {DATE.format(new Date(`${c.date}T00:00:00Z`))}</span>{c.note && <p className="text-xs text-muted">{c.note}</p>}</li>
              ))}
            </ul>
          </section>
          {left >= 0 && (
            <section className="card-flat p-5">
              <h2 className="display mb-3 text-xl font-semibold">Como votar</h2>
              <ul className="list-disc space-y-2 pl-4 text-sm text-muted">{VOTING_TIPS.map((t) => <li key={t}>{t}</li>)}</ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
