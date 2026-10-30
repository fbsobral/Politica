"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconBell, IconFeed, IconMore, IconPeople, IconShield, IconCalendar, IconVote, IconCoins, IconCompass, IconFlag, IconChart } from "./icons";

type Item = { href: string; label: string; short?: string; icon: React.ReactNode; match: (p: string) => boolean };

const MOBILE: Item[] = [
  { href: "/", label: "Feed", icon: <IconFeed />, match: (p) => p === "/" },
  { href: "/representantes", label: "Representantes", short: "Pessoas", icon: <IconPeople />, match: (p) => p.startsWith("/representantes") },
  { href: "/agenda", label: "Agenda", icon: <IconCalendar />, match: (p) => p.startsWith("/agenda") },
  { href: "/alertas", label: "Alertas", icon: <IconBell />, match: (p) => p.startsWith("/alertas") },
  { href: "/mais", label: "Mais", icon: <IconMore />, match: (p) => ["/mais", "/partidos", "/perfil", "/eleicoes", "/orcamento", "/indicadores", "/score", "/roi", "/favoritos", "/configuracoes", "/checagens", "/diario-oficial", "/admin"].some((x) => p.startsWith(x)) },
];

type Leaf = { href: string; label: string; hint: string; icon: React.ReactNode; match: (p: string) => boolean };
type Entry = { label: string; href?: string; match?: (p: string) => boolean; children?: Leaf[] };

const MENU: Entry[] = [
  { label: "Feed", href: "/", match: (p) => p === "/" },
  {
    label: "Quem é quem",
    children: [
      { href: "/representantes", label: "Representantes", hint: "Prefeito, vereadores, deputados, senadores", icon: <IconPeople />, match: (p) => p.startsWith("/representantes") },
      { href: "/partidos", label: "Partidos", hint: "Notícias, perfil e eleitos de cada partido", icon: <IconFlag />, match: (p) => p.startsWith("/partidos") },
      { href: "/perfil", label: "Você", hint: "Seu perfil político e os partidos mais próximos", icon: <IconCompass />, match: (p) => p.startsWith("/perfil") },
    ],
  },
  {
    label: "Acompanhe",
    children: [
      { href: "/agenda", label: "Agenda", hint: "Sessões, votações e eventos", icon: <IconCalendar />, match: (p) => p.startsWith("/agenda") },
      { href: "/eleicoes", label: "Eleições", hint: "Candidatos, pesquisas e notícias por cargo", icon: <IconVote />, match: (p) => p.startsWith("/eleicoes") },
      { href: "/checagens", label: "Checagens", hint: "Boatos e declarações verificados", icon: <IconShield />, match: (p) => p.startsWith("/checagens") },
    ],
  },
  {
    label: "Números",
    children: [
      { href: "/orcamento", label: "Orçamento", hint: "Para onde vai o dinheiro público", icon: <IconCoins />, match: (p) => p.startsWith("/orcamento") },
      { href: "/indicadores", label: "Indicadores", hint: "Economia, dívida, segurança, pobreza e mais, em 10 anos", icon: <IconChart />, match: (p) => p.startsWith("/indicadores") },
      { href: "/score", label: "Score dos governos", hint: "Nota de 0 a 100 por ano, 50% economia e 50% social", icon: <IconChart />, match: (p) => p.startsWith("/score") },
      { href: "/roi", label: "ROI do orçamento", hint: "Quanto o gasto público mudou os indicadores", icon: <IconCoins />, match: (p) => p.startsWith("/roi") },
    ],
  },
  { label: "Pergunte", href: "/conversar", match: (p) => p.startsWith("/conversar") },
];

/** Aparece dentro de um <Link> enquanto a página de destino carrega. */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-label="Carregando" className="ml-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null;
}

const topClass = (active: boolean) => `inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${active ? "bg-ink text-paper" : "text-muted hover:bg-ink/5 hover:text-ink"}`;

function Dropdown({ entry, path, onGo }: { entry: Entry; path: string; onGo: (href: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = entry.children!.some((c) => c.match(path));

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === "Escape") setOpen(false);
      } else if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(true)} className={topClass(active)}>
        {entry.label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-40 w-72 pt-2">
          <div className="rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
            {entry.children!.map((c) => {
              const on = c.match(path);
              return (
                <Link key={c.href} href={c.href} role="menuitem" aria-current={on ? "page" : undefined} onClick={() => onGo(c.href)} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${on ? "bg-brand-soft" : "hover:bg-ink/5"}`}>
                  <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-brand-soft text-brand">{c.icon}</span>
                  <span className="min-w-0 flex-1"><b className="block text-sm">{c.label}<Pending /></b><span className="block text-xs text-muted">{c.hint}</span></span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Caminho "otimista": o item clicado já aparece ativo na hora, antes da página chegar. */
function useOptimisticPath() {
  const real = usePathname();
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => setNext(null), [real]);
  return [next ?? real, setNext] as const;
}

export function DesktopNav({ isAdmin }: { isAdmin: boolean }) {
  const [path, setNext] = useOptimisticPath();
  void isAdmin; // Alertas, Favoritos, Conta e Admin ficam no menu do avatar
  return (
    <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Principal">
      {MENU.map((e) =>
        e.children ? (
          <Dropdown key={e.label} entry={e} path={path} onGo={setNext} />
        ) : (
          <Link key={e.label} href={e.href!} onClick={() => setNext(e.href!)} aria-current={e.match!(path) ? "page" : undefined} className={topClass(e.match!(path))}>
            {e.label}<Pending />
          </Link>
        ),
      )}
    </nav>
  );
}

export function MobileNav() {
  const [path, setNext] = useOptimisticPath();
  const list = MOBILE;
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {list.map((i) => {
          const active = i.match(path);
          return (
            <li key={i.href}>
              <Link href={i.href} onClick={() => setNext(i.href)} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${active ? "text-brand" : "text-faint"}`}>
                <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-brand-soft" : ""}`}>{i.icon}</span>
                <span className="inline-flex items-center">{i.short ?? i.label}<Pending /></span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
