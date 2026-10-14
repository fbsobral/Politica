import type { Scope } from "@prisma/client";
import Link from "next/link";
import { SCOPE_LABEL } from "@/lib/taxonomy";

/** cor estável por nome (veículos, partidos) */
export function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function SourceAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const hue = hueOf(name);
  const letter = name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className="inline-flex flex-none items-center justify-center rounded-lg font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.46,
        background: `hsl(${hue} 70% 92%)`,
        color: `hsl(${hue} 55% 28%)`,
      }}
    >
      {letter}
    </span>
  );
}

const SCOPE_STYLE: Record<Scope, string> = {
  MUNICIPAL: "bg-municipal-soft text-municipal",
  ESTADUAL: "bg-estadual-soft text-estadual",
  FEDERAL: "bg-federal-soft text-federal",
};
export const SCOPE_DOT: Record<Scope, string> = {
  MUNICIPAL: "bg-municipal",
  ESTADUAL: "bg-estadual",
  FEDERAL: "bg-federal",
};

export function ScopeBadge({ scope }: { scope: Scope }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${SCOPE_STYLE[scope]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${SCOPE_DOT[scope]}`} />
      {SCOPE_LABEL[scope]}
    </span>
  );
}

export function PartyBadge({ party }: { party: string | null }) {
  if (!party) return null;
  const hue = hueOf(party);
  return (
    <span className="rounded-md px-1.5 py-0.5 text-[11px] font-bold tracking-wide" style={{ background: `hsl(${hue} 60% 93%)`, color: `hsl(${hue} 55% 26%)` }}>
      {party}
    </span>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="display text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card-flat flex flex-col items-center px-6 py-14 text-center">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden className="mb-4 text-faint">
        <rect x="10" y="14" width="44" height="36" rx="8" stroke="currentColor" strokeWidth="2" />
        <path d="M18 24h28M18 32h20M18 40h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="48" cy="44" r="9" fill="var(--surface)" stroke="var(--gold)" strokeWidth="2.5" />
        <path d="m44.5 44 2.5 2.5 4.5-5" stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h3 className="display text-lg font-semibold">{title}</h3>
      {children && <div className="mt-1.5 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ kind, children }: { kind: "ok" | "erro" | "info"; children: React.ReactNode }) {
  const cls = kind === "ok" ? "bg-municipal-soft text-municipal" : kind === "erro" ? "bg-danger/10 text-danger" : "bg-brand-soft text-brand";
  return <p role={kind === "erro" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm font-medium ${cls}`}>{children}</p>;
}

/** Abas Municipal / Estadual / Federal como links (?esfera=...), preservando outros parâmetros. */
export function ScopeTabs({ base, scope, params = {} }: { base: string; scope: Scope | "ALL"; params?: Record<string, string | undefined> }) {
  const href = (s: Scope | "ALL") => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, pagina: undefined, esfera: s === "ALL" ? "todas" : s.toLowerCase() })) if (v) qs.set(k, v);
    return `${base}?${qs}`;
  };
  return (
    <div role="tablist" aria-label="Esfera" className="mb-6 grid grid-cols-4 gap-1 rounded-2xl border border-line bg-surface p-1 shadow-card sm:inline-grid sm:min-w-[30rem]">
      {(["ALL", "MUNICIPAL", "ESTADUAL", "FEDERAL"] as (Scope | "ALL")[]).map((s) => {
        const active = s === scope;
        return (
          <Link key={s} role="tab" aria-selected={active} href={href(s)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${active ? "bg-ink text-paper" : "text-muted hover:bg-ink/5 hover:text-ink"}`}>
            {s === "ALL" ? <span className="h-2 w-2 rounded-full bg-gradient-to-br from-municipal via-estadual to-federal" /> : <span className={`h-2 w-2 rounded-full ${SCOPE_DOT[s]}`} />}
            {s === "ALL" ? "Todas" : SCOPE_LABEL[s]}
          </Link>
        );
      })}
    </div>
  );
}
