import Link from "next/link";

export function AdminTabs({ active }: { active: "usuarios" | "robo" }) {
  const cls = (k: string) => `rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${k === active ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-muted hover:text-ink"}`;
  return (
    <div className="mb-6 flex gap-2">
      <Link href="/admin/usuarios" className={cls("usuarios")}>Usuários</Link>
      <Link href="/admin/robo" className={cls("robo")}>Robô de notícias</Link>
    </div>
  );
}
