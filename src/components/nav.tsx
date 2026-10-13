"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBell, IconFeed, IconMore, IconPeople, IconShield, IconCalendar } from "./icons";

type Item = { href: string; label: string; short?: string; icon: React.ReactNode; match: (p: string) => boolean };

function items(isAdmin: boolean): Item[] {
  const list: Item[] = [
    { href: "/", label: "Feed", icon: <IconFeed />, match: (p) => p === "/" },
    { href: "/representantes", label: "Representantes", short: "Pessoas", icon: <IconPeople />, match: (p) => p.startsWith("/representantes") },
    { href: "/agenda", label: "Agenda", icon: <IconCalendar />, match: (p) => p.startsWith("/agenda") },
    { href: "/checagens", label: "Checagens", icon: <IconShield />, match: (p) => p.startsWith("/checagens") },
    { href: "/diario-oficial", label: "Diário Oficial", icon: <IconFeed />, match: (p) => p.startsWith("/diario-oficial") },
  ];
  void isAdmin; // Alertas, Favoritos, Conta e Admin ficam no menu do avatar
  return list;
}

const MOBILE: Item[] = [
  { href: "/", label: "Feed", icon: <IconFeed />, match: (p) => p === "/" },
  { href: "/representantes", label: "Representantes", short: "Pessoas", icon: <IconPeople />, match: (p) => p.startsWith("/representantes") },
  { href: "/agenda", label: "Agenda", icon: <IconCalendar />, match: (p) => p.startsWith("/agenda") },
  { href: "/alertas", label: "Alertas", icon: <IconBell />, match: (p) => p.startsWith("/alertas") },
  { href: "/mais", label: "Mais", icon: <IconMore />, match: (p) => ["/mais", "/favoritos", "/configuracoes", "/checagens", "/diario-oficial", "/admin"].some((x) => p.startsWith(x)) },
];

export function DesktopNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Principal">
      {items(isAdmin).map((i) => {
        const active = i.match(path);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${active ? "bg-ink text-paper" : "text-muted hover:bg-ink/5 hover:text-ink"}`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
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
              <Link href={i.href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${active ? "text-brand" : "text-faint"}`}>
                <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-brand-soft" : ""}`}>{i.icon}</span>
                {i.short ?? i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
