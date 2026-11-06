import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Branch, NewsCategory, Scope, SourceCategory } from "@prisma/client";
import { toggleFavorite } from "@/app/actions";
import { AskButton } from "@/components/agent/ask-button";
import { IconExternal, IconOfficial, IconStar } from "@/components/icons";
import { ArticleSheet } from "@/components/article-sheet";
import { ScopeBadge, SourceAvatar } from "@/components/ui";
import { TIER_LEGEND } from "@/lib/tier-legend";
import { BRANCH_LABEL, NEWS_CATEGORY_LABEL, SOURCE_CATEGORY_LABEL } from "@/lib/taxonomy";

export type ArticleView = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  publishedAt: Date;
  category: NewsCategory;
  branch?: Branch | null;
  source: { name: string; category: SourceCategory; tier?: number | null };
  favorited: boolean;
  alsoIn: string[];
  /** esfera da notícia; mostrada quando o feed está em "Todas" */
  scope?: Scope;
  related?: { source: string; url: string; title: string }[];
  /** esfera da notícia, para o selo "Oficial · Municipal" (mesmo fora do modo "Todas") */
  officialScope?: Scope;
  /** versão oficial do mesmo assunto, quando o veículo principal não é oficial */
  official?: { source: string; url: string; title: string };
};

const OFFICIAL_SCOPE: Record<Scope, string> = { MUNICIPAL: "Municipal", ESTADUAL: "Estadual", FEDERAL: "Federal" };

/** Selo de fonte oficial (governo, legislativo, tribunal), com a esfera. */
export function OfficialBadge({ scope }: { scope?: Scope }) {
  return (
    <span title="Fonte oficial: site de governo, legislativo, tribunal ou outro órgão público" className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-px text-[10px] font-bold uppercase tracking-wide text-paper">
      <IconOfficial width={11} height={11} /> Oficial{scope ? ` · ${OFFICIAL_SCOPE[scope]}` : ""}
    </span>
  );
}

function timeAgo(d: Date) {
  return formatDistanceToNowStrict(d, { addSuffix: false, locale: ptBR }).replace(" minutos", " min").replace(" minuto", " min").replace(" horas", " h").replace(" hora", " h").replace(" dias", " d").replace(" dia", " d");
}

function sheetData(a: ArticleView) {
  return {
    id: a.id,
    url: a.url,
    title: a.title,
    description: a.description,
    imageUrl: a.imageUrl,
    publishedAt: a.publishedAt.toISOString(),
    sourceName: a.source.name,
    sourceType: SOURCE_CATEGORY_LABEL[a.source.category],
    tier: a.source.tier ?? null,
    categoryLabel: NEWS_CATEGORY_LABEL[a.category],
    branchLabel: a.branch ? BRANCH_LABEL[a.branch] : null,
    related: a.related ?? [],
  };
}

function FavButton({ a, className = "" }: { a: ArticleView; className?: string }) {
  return (
    <form action={toggleFavorite.bind(null, a.id)} className={className}>
      <button
        type="submit"
        aria-label={a.favorited ? "Remover dos favoritos" : "Salvar nos favoritos"}
        aria-pressed={a.favorited}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-all hover:scale-110 ${a.favorited ? "text-gold" : "text-faint hover:text-ink"}`}
      >
        <IconStar filled={a.favorited} />
      </button>
    </form>
  );
}

function Meta({ a }: { a: ArticleView }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <SourceAvatar name={a.source.name} size={22} />
      <span className="truncate font-semibold text-ink">{a.source.name}</span>
      <span aria-hidden className="text-line-strong">•</span>
      {a.source.category === "ORGAO_OFICIAL" ? <OfficialBadge scope={a.officialScope ?? a.scope} /> : <span>{SOURCE_CATEGORY_LABEL[a.source.category]}</span>}
      {a.source.tier && (
        <span title={`${TIER_LEGEND[a.source.tier as 1 | 2 | 3].label}: ${TIER_LEGEND[a.source.tier as 1 | 2 | 3].desc}`} className={`rounded px-1.5 py-px text-[10px] font-bold tracking-wide ${a.source.tier === 1 ? "bg-gold/25 text-ink" : a.source.tier === 2 ? "bg-ink/8 text-muted" : "bg-ink/5 text-faint"}`}>T{a.source.tier}</span>
      )}
      <span aria-hidden className="text-line-strong">•</span>
      <time dateTime={a.publishedAt.toISOString()}>{timeAgo(a.publishedAt)}</time>
    </div>
  );
}

function Tags({ a }: { a: ArticleView }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {a.scope && <ScopeBadge scope={a.scope} />}
      <span className="chip !bg-brand-soft !text-brand">{NEWS_CATEGORY_LABEL[a.category]}</span>
      {a.branch && <span className="chip">{BRANCH_LABEL[a.branch]}</span>}
      {a.official && (
        <a href={a.official.url} target="_blank" rel="noopener noreferrer" className="relative z-10 inline-flex max-w-full items-center gap-1.5 rounded-full border border-ink/20 bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink hover:border-ink" title={a.official.title}>
          <IconOfficial width={12} height={12} /> <span className="truncate">Versão oficial: {a.official.source}</span> <span aria-hidden>→</span>
        </a>
      )}
      {a.alsoIn.length > 0 && (
        <span className="text-xs text-faint">
          também em <span className="text-muted">{a.alsoIn.join(", ")}</span>
        </span>
      )}
    </div>
  );
}

export function ArticleCard({ a, index = 0 }: { a: ArticleView; index?: number }) {
  return (
    <article
      className="card rise group relative flex gap-4 p-4 transition-shadow hover:shadow-pop sm:p-5"
      
    >
      <div className="min-w-0 flex-1">
        <Meta a={a} />
        <h3 className="display mt-2 text-[1.075rem] font-semibold leading-snug sm:text-xl">
          <ArticleSheet data={sheetData(a)} className="text-left after:absolute after:inset-0 hover:underline hover:decoration-line-strong hover:underline-offset-4">
            {a.title}
          </ArticleSheet>
        </h3>
        {a.description && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{a.description}</p>}
        <Tags a={a} />
      </div>
      <div className="relative z-10 flex flex-none flex-col items-end justify-between gap-2">
        {a.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-20 w-20 rounded-xl bg-line object-cover sm:h-24 sm:w-32" />
        ) : (
          <span className="hidden text-faint opacity-0 transition-opacity group-hover:opacity-100 sm:block"><IconExternal /></span>
        )}
        <div className="-mb-1 -mr-1 flex items-center">
          <AskButton compact focus={{
            title: a.title.length > 80 ? `${a.title.slice(0, 79)}…` : a.title,
            text: `Notícia: "${a.title}". Veículo: ${a.source.name} (${SOURCE_CATEGORY_LABEL[a.source.category]}). Publicada em ${a.publishedAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Assunto: ${NEWS_CATEGORY_LABEL[a.category]}${a.branch ? `, ${BRANCH_LABEL[a.branch]}` : ""}.${a.description ? ` Resumo do veículo: ${a.description}` : ""}${a.alsoIn.length ? ` Também publicada por: ${a.alsoIn.join(", ")}.` : ""}`,
            suggestions: ["Explique essa notícia em linguagem simples", "Por que isso importa para mim?", "Quem são os envolvidos?", "Há outras versões ou notícias sobre isso?"],
          }} />
          <FavButton a={a} />
        </div>
      </div>
    </article>
  );
}
