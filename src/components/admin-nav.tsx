"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Badge = { n: number; tone: "warn" | "info" };
export type AdminBadges = Partial<Record<"usuarios" | "feeds" | "veiculos", Badge>>;

const GROUPS: { title: string; items: { href: string; label: string; hint: string; badge?: keyof AdminBadges }[] }[] = [
  { title: "Resumo", items: [{ href: "/admin", label: "Visão geral", hint: "Saúde do robô e pendências" }] },
  { title: "Pessoas", items: [{ href: "/admin/usuarios", label: "Usuários", hint: "Cadastros, convites e papéis", badge: "usuarios" }] },
  {
    title: "Conteúdo",
    items: [
      { href: "/admin/feeds", label: "Feeds RSS", hint: "De onde vêm as notícias", badge: "feeds" },
      { href: "/admin/veiculos", label: "Veículos e tiers", hint: "Nível de cada veículo", badge: "veiculos" },
      { href: "/admin/buscas", label: "Buscas", hint: "Google News por esfera e poder" },
    ],
  },
  { title: "Operação", items: [{ href: "/admin/robo", label: "Robô", hint: "Parâmetros, execuções e ações" }] },
];

export function AdminNav({ badges }: { badges: AdminBadges }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <nav aria-label="Administração" className="lg:sticky lg:top-20">
      {/* celular: abas roláveis */}
      <div className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 lg:hidden">
        {GROUPS.flatMap((g) => g.items).map((i) => {
          const b = i.badge ? badges[i.badge] : undefined;
          return (
            <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined} className={`flex flex-none items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${active(i.href) ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-muted"}`}>
              {i.label}
              {b && b.n > 0 && <span className={`rounded-full px-1.5 text-[11px] ${b.tone === "warn" ? "bg-danger text-white" : "bg-gold text-ink"}`}>{b.n}</span>}
            </Link>
          );
        })}
      </div>

      {/* desktop: menu lateral agrupado */}
      <div className="hidden space-y-5 lg:block">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="eyebrow mb-1.5 px-3">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const b = i.badge ? badges[i.badge] : undefined;
                const on = active(i.href);
                return (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={on ? "page" : undefined} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 transition-colors ${on ? "bg-ink text-paper" : "text-muted hover:bg-ink/5 hover:text-ink"}`}>
                      <span>
                        <span className="block text-sm font-semibold">{i.label}</span>
                        <span className={`block text-[11px] ${on ? "opacity-70" : "text-faint"}`}>{i.hint}</span>
                      </span>
                      {b && b.n > 0 && <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-bold ${b.tone === "warn" ? "bg-danger text-white" : "bg-gold text-ink"}`}>{b.n}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
