"use client";

import { UserButton } from "@clerk/nextjs";
import { IconBell, IconFeed, IconShield, IconStar, IconUser } from "@/components/icons";

/** Avatar com atalhos. Precisa ser um componente de cliente: o Clerk só lê os itens do menu assim. */
export function UserMenu({ isAdmin }: { isAdmin: boolean }) {
  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Link label="Diário Oficial" labelIcon={<IconFeed width={16} height={16} />} href="/diario-oficial" />
        <UserButton.Link label="Favoritos" labelIcon={<IconStar width={16} height={16} />} href="/favoritos" />
        <UserButton.Link label="Alertas" labelIcon={<IconBell width={16} height={16} />} href="/alertas" />
        <UserButton.Link label="Minha conta" labelIcon={<IconUser width={16} height={16} />} href="/configuracoes" />
        {isAdmin && <UserButton.Link label="Administração" labelIcon={<IconShield width={16} height={16} />} href="/admin" />}
      </UserButton.MenuItems>
    </UserButton>
  );
}
