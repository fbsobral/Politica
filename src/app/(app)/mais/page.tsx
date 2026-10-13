import Link from "next/link";
import { IconBell, IconShield, IconStar, IconUser, IconVote } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Mais" };

export default async function MaisPage() {
  const user = await requireUser();
  const items = [
    { href: "/eleicoes", t: "Eleições", d: "Candidatos, pesquisas e notícias por cargo", i: <IconVote /> },
    { href: "/checagens", t: "Checagem de fatos", d: "Boatos e declarações verificados", i: <IconShield /> },
    { href: "/diario-oficial", t: "Diário Oficial", d: `Edições de ${user.municipality}`, i: <IconStar /> },
    { href: "/favoritos", t: "Favoritos", d: "Notícias salvas", i: <IconStar /> },
    { href: "/alertas", t: "Alertas", d: "Palavras-chave e políticos", i: <IconBell /> },
    { href: "/configuracoes", t: "Conta", d: "E-mails e localização", i: <IconUser /> },
    ...(user.role === "ADMIN" ? [{ href: "/admin", t: "Administração", d: "Visão geral, usuários, fontes e robô", i: <IconShield /> }] : []),
  ];
  return (
    <div>
      <PageHeader eyebrow="Menu" title="Mais" />
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} className="card-flat flex items-center gap-4 p-4 transition-shadow hover:shadow-card">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-soft text-brand">{it.i}</span>
              <span><b className="block">{it.t}</b><span className="text-sm text-muted">{it.d}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
