import Link from "next/link";
import type { Scope } from "@prisma/client";
import { ArticleCard } from "@/components/article-card";
import { IconPin } from "@/components/icons";
import { EmptyState, Notice, PageHeader, ScopeTabs } from "@/components/ui";
import { db } from "@/lib/db";
import { collapseClusters, scopeWhere } from "@/lib/feed";
import { camaraAgenda, camaraVotes, senadoAgenda, senadoVotes, type AgendaEvent, type PlenaryVote } from "@/lib/open-data";
import { SCOPE_SLUG, UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Agenda e votações" };
export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
const SHORT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });

// termos (sem acento) que indicam pauta, sessão ou votação nas notícias legislativas locais
const VOTING_TERMS = ["sessao", "votacao", "votou", "votam", "vota ", "aprova", "aprovad", "plenario", "pauta", "projeto de lei", "sanciona", "veta", "audiencia publica", "comissao", "cpi", "requerimento"];

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ esfera?: string; casa?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope: Scope = SCOPE_SLUG[sp.esfera ?? "municipal"] ?? "MUNICIPAL";
  const casa = sp.casa === "camara" || sp.casa === "senado" ? sp.casa : "";
  const place = scope === "MUNICIPAL" ? user.municipality : scope === "ESTADUAL" ? UFS[user.uf] : "Congresso Nacional";

  return (
    <div>
      <PageHeader eyebrow={`Agenda e votações · ${scope === "FEDERAL" ? "próximos 10 dias" : "na imprensa"}`} title={place} />
      <ScopeTabs base="/agenda" scope={scope} params={{ casa: casa || undefined }} />
      {scope === "FEDERAL" ? <Federal casa={casa} /> : <LocalNews user={user} scope={scope} />}
    </div>
  );
}

async function Federal({ casa }: { casa: string }) {
  const [cAg, sAg, cVo, sVo] = await Promise.allSettled([camaraAgenda(10), senadoAgenda(10), camaraVotes(45), senadoVotes(45)]);
  const ok = <T,>(r: PromiseSettledResult<T[]>): T[] => (r.status === "fulfilled" ? r.value : []);
  const failed = [cAg, sAg].some((r) => r.status === "rejected");
  const wanted = (h: string) => !casa || casa === h.toLowerCase().replace("â", "a");
  const events = [...ok(cAg), ...ok(sAg)].filter((e) => wanted(e.house)).sort((a, b) => a.start.localeCompare(b.start));
  const votes: PlenaryVote[] = [...ok(cVo), ...ok(sVo)].filter((v) => wanted(v.house)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);

  const byDay = new Map<string, AgendaEvent[]>();
  for (const e of events) byDay.set(e.start.slice(0, 10), [...(byDay.get(e.start.slice(0, 10)) ?? []), e]);
  const chip = (v: string, l: string) => (
    <Link key={v} href={`/agenda?esfera=federal${v ? `&casa=${v}` : ""}`} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${casa === v ? "border-brand bg-brand-soft text-brand" : "border-line-strong bg-surface text-muted hover:text-ink"}`}>{l}</Link>
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section aria-label="Agenda" className="space-y-6">
        <div className="flex flex-wrap gap-2">{chip("", "Câmara e Senado")}{chip("camara", "Câmara")}{chip("senado", "Senado")}</div>
        {failed && <Notice kind="info">Uma das casas não respondeu agora; a agenda pode estar incompleta.</Notice>}
        {!events.length && <EmptyState title="Sem eventos marcados">Nenhuma sessão ou reunião de comissão agendada para os próximos dias.</EmptyState>}
        {[...byDay.entries()].map(([d, list]) => (
          <div key={d}>
            <h2 className="eyebrow mb-2 first-letter:uppercase">{WHEN.format(new Date(`${d}T12:00:00-03:00`))}</h2>
            <ul className="space-y-2">
              {list.map((e) => (
                <li key={e.id} className="card-flat flex gap-4 p-4">
                  <div className="w-12 flex-none text-center"><div className="display text-lg font-semibold leading-none">{e.start.slice(11, 16)}</div></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`chip ${e.house === "Senado" ? "!bg-federal-soft !text-federal" : "!bg-municipal-soft !text-municipal"}`}>{e.house}</span>
                      <span className="chip">{e.type}</span>
                      {e.organ && <span className="chip !bg-brand-soft !text-brand">{e.organ}</span>}
                      <span className="text-xs text-faint">{e.situation}</span>
                    </div>
                    <p className="mt-1.5 text-[0.9375rem] leading-snug">{e.link ? <a href={e.link} target="_blank" rel="noopener noreferrer" className="hover:underline">{e.description}</a> : e.description}</p>
                    {e.place && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><IconPin /> {e.place}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <aside aria-label="Votações recentes">
        <h2 className="display mb-3 text-xl font-semibold">Votações recentes</h2>
        {!votes.length && <p className="text-sm text-muted">Nenhuma votação de plenário no período (o Congresso está em período eleitoral).</p>}
        <ul className="space-y-2.5">
          {votes.map((v) => (
            <li key={v.id} className="card-flat p-3.5">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="text-muted">{v.house} · {SHORT.format(new Date(v.date.length === 16 ? `${v.date}:00-03:00` : `${v.date}-03:00`))}</span>
                {v.approved !== null && <span className={`rounded-full px-2 py-0.5 font-semibold ${v.approved ? "bg-municipal-soft text-municipal" : "bg-danger/10 text-danger"}`}>{v.approved ? "Aprovada" : "Rejeitada"}</span>}
              </div>
              <p className="line-clamp-4 text-sm leading-snug text-muted">{v.description}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-faint">Fonte: dados abertos da Câmara dos Deputados e do Senado Federal.</p>
      </aside>
    </div>
  );
}

async function LocalNews({ user, scope }: { user: { id: string; uf: string; municipalityKey: string; municipality: string }; scope: Scope }) {
  const rows = await db.article.findMany({
    where: {
      classified: true,
      factCheck: false,
      branch: "LEGISLATIVO",
      ...scopeWhere(user, scope),
      OR: VOTING_TERMS.map((t) => ({ searchText: { contains: t } })),
    },
    include: { source: { select: { name: true, category: true, tier: true } } },
    orderBy: { publishedAt: "desc" },
    take: 40,
  });
  const items = collapseClusters(rows);
  const favs = await db.favorite.findMany({ where: { userId: user.id, articleId: { in: items.map((r) => r.id) } }, select: { articleId: true } });
  const fav = new Set(favs.map((f) => f.articleId));
  const who = scope === "MUNICIPAL" ? `da Câmara de ${user.municipality}` : `da Assembleia Legislativa de ${UFS[user.uf]}`;
  return (
    <div className="space-y-4">
      <Notice kind="info">
        Não existe uma agenda oficial única {who} em formato aberto. Aqui mostramos o que a imprensa publicou sobre <b>sessões, pautas e votações</b>, coletado pelo robô. Para a pauta oficial, consulte o site da casa legislativa.
      </Notice>
      {items.length ? (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">{items.map((a, i) => <ArticleCard key={a.id} index={i} a={{ ...a, favorited: fav.has(a.id) }} />)}</div>
      ) : (
        <EmptyState title="Nada sobre sessões ou votações por enquanto">O robô procura essas notícias a cada hora. Ajuste as buscas em Admin → Fontes e buscas se quiser ampliar.</EmptyState>
      )}
    </div>
  );
}
