import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { IconBell, IconLogo, IconSettings, IconShield, IconStar, IconUser, IconFeed } from "@/components/icons";
import { DesktopNav, MobileNav } from "@/components/nav";
import { UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Política — início">
            <IconLogo />
            <span className="display text-xl font-semibold tracking-tight">Política</span>
          </Link>
          <div className="hidden flex-1 lg:block">
            <DesktopNav isAdmin={isAdmin} />
          </div>
          <Link href="/configuracoes" className="ml-auto flex max-w-[12rem] items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-muted hover:text-ink sm:text-xs" title="Alterar localização">
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-municipal" />
            <span className="truncate">{user.municipality} · {user.uf}</span>
          </Link>
          {isAdmin && (
            <Link href="/admin/usuarios" className="hidden items-center gap-1.5 rounded-full bg-gold/25 px-3 py-1.5 text-sm font-semibold text-ink hover:bg-gold/40 lg:flex" title="Painel de administração">
              <IconShield width={16} height={16} /> Admin
            </Link>
          )}
          <Link href="/configuracoes" aria-label="Configurações da conta" title="Configurações" className="hidden h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink lg:flex">
            <IconSettings width={19} height={19} />
          </Link>
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Link label="Diário Oficial" labelIcon={<IconFeed width={16} height={16} />} href="/diario-oficial" />
              <UserButton.Link label="Favoritos" labelIcon={<IconStar width={16} height={16} />} href="/favoritos" />
              <UserButton.Link label="Alertas" labelIcon={<IconBell width={16} height={16} />} href="/alertas" />
              <UserButton.Link label="Minha conta" labelIcon={<IconUser width={16} height={16} />} href="/configuracoes" />
              {isAdmin && <UserButton.Link label="Administração" labelIcon={<IconShield width={16} height={16} />} href="/admin/usuarios" />}
            </UserButton.MenuItems>
          </UserButton>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs leading-relaxed text-faint sm:px-6">
        <p>
          {UFS[user.uf]} · Notícias coletadas de feeds públicos a cada hora e classificadas por IA. Representantes: Câmara dos Deputados, Senado e TSE.
        </p>
      </footer>
      <MobileNav />
    </div>
  );
}
