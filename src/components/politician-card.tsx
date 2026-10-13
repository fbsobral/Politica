import Link from "next/link";
import type { Politician } from "@prisma/client";
import { toggleFollow } from "@/app/actions";
import { IconCheck } from "@/components/icons";
import { PartyBadge, hueOf } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/taxonomy";
import { initials } from "@/lib/text";

export function Avatar({ p, size = 48 }: { p: Pick<Politician, "name" | "photoUrl">; size?: number }) {
  const hue = hueOf(p.name);
  const style = { width: size, height: size };
  return p.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.photoUrl} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" className="flex-none rounded-full bg-line object-cover object-top ring-2 ring-surface" style={style} />
  ) : (
    <div
      aria-hidden
      className="flex flex-none items-center justify-center rounded-full font-semibold ring-2 ring-surface"
      style={{ ...style, fontSize: size * 0.36, background: `hsl(${hue} 55% 90%)`, color: `hsl(${hue} 50% 30%)` }}
    >
      {initials(p.name)}
    </div>
  );
}

export function FollowButton({ id, following, compact = false }: { id: string; following: boolean; compact?: boolean }) {
  return (
    <form action={toggleFollow.bind(null, id)}>
      <button
        type="submit"
        aria-pressed={following}
        className={`btn btn-sm ${following ? "btn-primary" : "btn-secondary"} ${compact ? "" : "min-w-24"}`}
      >
        {following ? <><IconCheck /> Seguindo</> : "Seguir"}
      </button>
    </form>
  );
}

/** Cargos do Executivo e legisladores em lista: card compacto. */
export function PoliticianCard({ p, following, showRole = false, index = 0 }: { p: Politician; following: boolean; showRole?: boolean; index?: number }) {
  return (
    <div className="card-flat rise flex items-center gap-3 p-3 transition-shadow hover:shadow-card" style={{ animationDelay: `${Math.min(index, 10) * 25}ms` }}>
      <Avatar p={p} size={52} />
      <Link href={`/representantes/${p.id}`} className="min-w-0 flex-1">
        <div className="truncate text-[0.9375rem] font-semibold leading-tight hover:underline">{p.ballotName ?? p.name}</div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <PartyBadge party={p.party} />
          <span className="truncate">{showRole ? ROLE_LABEL[p.role] : (p.uf ?? "")}</span>
        </div>
      </Link>
      <FollowButton id={p.id} following={following} compact />
    </div>
  );
}

/** Destaque para prefeito, governador, presidente e seus vices. */
export function ExecutiveCard({ p, following, index = 0 }: { p: Politician; following: boolean; index?: number }) {
  return (
    <div className="card rise relative flex items-center gap-4 overflow-hidden p-4 sm:p-5" style={{ animationDelay: `${index * 50}ms` }}>
      <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gold" />
      <Avatar p={p} size={64} />
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{ROLE_LABEL[p.role]}</p>
        <Link href={`/representantes/${p.id}`} className="display mt-0.5 line-clamp-2 text-xl font-semibold leading-tight hover:underline">
          {p.ballotName ?? p.name}
        </Link>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          <PartyBadge party={p.party} />
          {p.mandate && <span className="hidden sm:inline">Mandato {p.mandate}</span>}
        </div>
      </div>
      <FollowButton id={p.id} following={following} compact />
    </div>
  );
}
