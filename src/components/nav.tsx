"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBell, IconFeed, IconPeople, IconShield, IconStar, IconUser } from "./icons";

type Item = { href: string; label: string; short?: string; icon: React.ReactNode; match: (p: string) => boolean };

function items(isAdmin: boolean): Item[] {
  const list: Item[] = [
    { href: "/", label: "Feed", icon: <IconFeed />, match: (p) => p === "/" },
    { href: "/representantes", label: "Representantes", short: "Pessoas", icon: <IconPeople />, match: (p) => p.startsWith("/representantes") },
    { href: "/favoritos", label: "Favoritos", icon: <IconStar />, match: (p) => p.startsWith("/favoritos") },
    { href: "/alertas", label: "Alertas", icon: <IconBell />, match: (p) => p.startsWith("/alertas") },
    { href: "/configuracoes", label: "Conta", icon: <IconUser />, match: (p) => p.startsWith("/configuracoes") },
  ];
  if (isAdmin) list.push({ href: "/admin/usuarios", label: "Admin", icon: <IconShield />, match: (p) => p.startsWith("/admin") });
  return list;
}

export function DesktopNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
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

export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const list = items(isAdmin).filter((i) => i.href !== "/admin/usuarios");
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-xl md:hidden"
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
