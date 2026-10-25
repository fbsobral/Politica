import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { EmptyState, PageHeader } from "@/components/ui";
import { setMyParty } from "@/app/actions";
import { db } from "@/lib/db";
import { collapseClusters } from "@/lib/feed";
import { partyBySigla, partyBySlug, slugOf } from "@/lib/parties";
import { PARTIES } from "@/lib/quiz/data";
import { ECON_LABEL, CUST_LABEL, partyPositions } from "@/lib/quiz/calc";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Partidos" };
export const dynamic = "force-dynamic";
const PAGE = 30;

const pill = (on: boolean) => `inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"}`;

const SORTED = [...PARTIES].sort((a, b) => a.sigla.localeCompare(b.sigla, "pt-BR"));

function PartyPicker({ current }: { current: string | null }) {
  return (
    <form action={setMyParty} className="card p-5 sm:p-6">
      <input type="hidden" name="back" value="/partidos" />
      <p className="eyebrow">Seu partido</p>
      <h2 className="display text-xl font-semibold">{current ? "Trocar meu partido" : "Qual é o seu partido?"}</h2>
      <p className="mb-4 mt-1 max-w-2xl text-sm text-muted">
        Usamos isso para abrir esta tela já com as notícias do seu partido e para trazer o resumo dele nos seus e-mails. Você pode mudar quando quiser.
      </p>
      <div className="flex flex-wrap gap-2">
        {SORTED.map((p) => (
          <button key={p.sigla} type="submit" name="party" value={p.sigla} title={p.nome} className={pill(current === p.sigla)}>
            {p.sigla}
          </button>
        ))}
        <button type="submit" name="party" value="NONE" className="btn btn-ghost btn-sm">Não tenho partido</button>
      </div>
    </form>
  );
}

export default async function PartidosPage({ searchParams }: { searchParams: Promise<{ visao?: string; partido?: string; pagina?: string; trocar?: string; fonte?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const mine = user.party && user.party !== "NONE" ? partyBySigla(user.party) : undefined;
  const asked = user.party !== null;
  const picked = sp.partido ? partyBySlug(sp.partido) : undefined;
  // abre no "seu partido" quando ele existe
  const view: "seu" | "todos" = sp.visao === "todos" ? "todos" : sp.visao === "seu" ? "seu" : mine ? "seu" : "todos";
  const page = Math.max(1, Number(sp.pagina) || 1);
  const fonte: "todas" | "partido" | "imprensa" = sp.fonte === "partido" ? "partido" : sp.fonte === "imprensa" ? "imprensa" : "todas";

  const filter = view === "seu" && mine ? { parties: { has: mine.sigla } } : picked ? { parties: { has: picked.sigla } } : { NOT: { parties: { isEmpty: true } } };
  const rows = await db.article.findMany({
    where: {
      classified: true,
      factCheck: false,
      ...filter,
      ...(fonte === "partido" ? { source: { category: "PARTIDO" as const } } : fonte === "imprensa" ? { source: { category: { not: "PARTIDO" as const } } } : {}),
    },
    include: { source: { select: { name: true, category: true, tier: true } } },
    orderBy: { publishedAt: "desc" },
    take: PAGE + 1,
    skip: (page - 1) * PAGE,
  });
  const favs = await db.favorite.findMany({ where: { userId: user.id, articleId: { in: rows.map((r) => r.id) } }, select: { articleId: true } });
  const fav = new Set(favs.map((f) => f.articleId));
  const list = collapseClusters(rows.slice(0, PAGE));

  const qs = (o: Record<string, string | undefined>) => {
    o = { fonte: fonte === "todas" ? undefined : fonte, ...o };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v) p.set(k, v);
    return `/partidos?${p}`;
  };
  const tab = (on: boolean) => `flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${on ? "bg-ink text-paper" : "text-muted hover:bg-ink/5 hover:text-ink"}`;

  return (
    <div>
      <PageHeader eyebrow="Notícias e perfil de cada partido" title="Partidos" />

      {(!asked || sp.trocar) && <div className="mb-6"><PartyPicker current={mine?.sigla ?? null} /></div>}

      <nav aria-label="Ir para a página de um partido" className="mb-4">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Ir para a página de um partido</p>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {SORTED.map((p) => (
            <Link key={p.sigla} href={`/partidos/${slugOf(p.sigla)}`} title={p.nome} className={`${pill(mine?.sigla === p.sigla)} flex-none`}>{p.sigla}</Link>
          ))}
        </div>
      </nav>

      <div role="tablist" aria-label="Quais partidos" className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1 shadow-card sm:inline-grid sm:min-w-[24rem]">
        <Link role="tab" aria-selected={view === "seu"} href={mine ? qs({ visao: "seu" }) : qs({ trocar: "1" })} className={tab(view === "seu")}>
          {mine ? <>Seu partido · <b>{mine.sigla}</b></> : "Seu partido"}
        </Link>
        <Link role="tab" aria-selected={view === "todos"} href={qs({ visao: "todos" })} className={tab(view === "todos")}>Todos os partidos</Link>
      </div>

      {view === "seu" && mine && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Link href={`/partidos/${slugOf(mine.sigla)}`} className="btn btn-secondary btn-sm">Ver página do {mine.sigla}</Link>
          <Link href={qs({ trocar: "1", visao: "seu" })} className="text-sm text-muted underline-offset-4 hover:underline">Trocar meu partido</Link>
        </div>
      )}

      {picked && (
        <p className="mb-4 text-sm">
          Notícias do <b>{picked.sigla}</b>. <Link href={`/partidos/${slugOf(picked.sigla)}`} className="font-semibold text-brand underline-offset-4 hover:underline">Ver a página do {picked.sigla} →</Link>{" "}
          <Link href={qs({ visao: "todos", partido: undefined })} className="text-muted underline-offset-4 hover:underline">Limpar</Link>
        </p>
      )}

      <div role="group" aria-label="Fonte das notícias" className="mb-5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">Fonte</span>
        {([["todas", "Tudo"], ["imprensa", "Imprensa"], ["partido", "Sites dos partidos"]] as const).map(([v, t]) => (
          <Link key={v} href={qs({ visao: view, partido: sp.partido, fonte: v === "todas" ? undefined : v })} className={pill(fonte === v)}>{t}</Link>
        ))}
      </div>

      {view === "todos" && !picked && fonte === "todas" && page === 1 && (
        <section className="mb-8" aria-label="Páginas dos partidos">
          <h2 className="display mb-1 text-xl font-semibold">Conheça cada partido</h2>
          <p className="mb-3 text-sm text-muted">Perfil, posições por tema, pessoas eleitas e notícias de cada um.</p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {partyPositions().sort((a, b) => a.party.sigla.localeCompare(b.party.sigla, "pt-BR")).map((p) => (
              <li key={p.party.sigla}>
                <Link href={`/partidos/${slugOf(p.party.sigla)}`} className="card-flat block h-full p-3 transition-shadow hover:shadow-card">
                  <b className="block text-base">{p.party.sigla}</b>
                  <span className="block truncate text-xs text-muted">{p.party.nome}</span>
                  <span className="mt-1 block text-[11px] text-faint">
                    {p.party.box === "mixed" ? "Sem caixa única" : p.party.box === "undefined" ? "Perfil pouco definido" : `${ECON_LABEL[p.eco]} × ${CUST_LABEL[p.cus]}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <h2 className="display mb-3 mt-8 text-xl font-semibold">Últimas notícias</h2>
        </section>
      )}

      {list.length ? (
        <div className="grid grid-cols-1 gap-3.5">{list.map((a, i) => <ArticleCard key={a.id} index={i} a={{ ...a, favorited: fav.has(a.id) }} />)}</div>
      ) : (
        <EmptyState title="Nenhuma notícia por aqui ainda">
          {view === "seu" && mine ? `Ainda não achamos notícias recentes que citem o ${mine.sigla}. O robô busca por partido a cada coleta.` : "O robô busca notícias de cada partido a cada coleta. Se acabou de ativar, rode a coleta em Admin → Robô."}
        </EmptyState>
      )}

      {(page > 1 || rows.length > PAGE) && (
        <nav className="flex justify-between pt-6">
          {page > 1 ? <Link href={qs({ visao: view, partido: sp.partido, pagina: String(page - 1) })} className="btn btn-secondary">← Mais recentes</Link> : <span />}
          {rows.length > PAGE && <Link href={qs({ visao: view, partido: sp.partido, pagina: String(page + 1) })} className="btn btn-secondary">Mais antigas →</Link>}
        </nav>
      )}

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-faint">
        As notícias são ligadas a um partido quando o título ou o resumo o citam (por sigla ou nome). Algumas matérias podem não aparecer, e outras podem citar o partido só de passagem.
      </p>
    </div>
  );
}
