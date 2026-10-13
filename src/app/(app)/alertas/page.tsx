import Link from "next/link";
import { createKeywordAlert, deleteAlert, toggleAlert } from "@/app/actions";
import { IconBell, IconSearch } from "@/components/icons";
import { Avatar } from "@/components/politician-card";
import { EmptyState, Notice, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Alertas" };
export const dynamic = "force-dynamic";

export default async function AlertasPage() {
  const user = await requireUser();
  const alerts = await db.alert.findMany({ where: { userId: user.id }, include: { politician: true }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <PageHeader eyebrow="Avisos por e-mail" title="Alertas" />
      <p className="-mt-3 mb-6 max-w-3xl text-[0.9375rem] leading-relaxed text-muted">
        A cada hora, se uma notícia nova citar sua palavra-chave ou um político monitorado, enviamos um e-mail para <b className="text-ink">{user.email}</b>.
      </p>
      {!user.alertEmails && (
        <div className="mb-5"><Notice kind="info">Os e-mails de alerta estão desligados. <Link href="/configuracoes" className="underline">Ligar nas configurações</Link>.</Notice></div>
      )}

      <form action={createKeywordAlert} className="card mb-6 flex flex-col gap-2 p-3 sm:flex-row">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" width={18} height={18} />
          <input name="keyword" required minLength={3} maxLength={80} placeholder="Palavra-chave ou nome — ex.: reforma tributária" className="input !border-transparent !pl-10" />
        </div>
        <button className="btn btn-primary"><IconBell width={18} height={18} /> Criar alerta</button>
      </form>

      {alerts.length ? (
        <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {alerts.map((a) => (
            <li key={a.id} className={`card-flat flex flex-wrap items-center gap-3 p-3.5 transition-opacity ${a.active ? "" : "opacity-60"}`}>
              {a.politician ? <Avatar p={a.politician} size={40} /> : <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-soft text-brand"><IconSearch /></span>}
              <div className="min-w-0 flex-1">
                {a.politician ? (
                  <Link href={`/representantes/${a.politician.id}`} className="block truncate font-semibold hover:underline">{a.politician.ballotName ?? a.politician.name}</Link>
                ) : (
                  <span className="block truncate font-semibold">{a.keyword}</span>
                )}
                <span className="text-xs text-muted">{a.politician ? "Político" : "Palavra-chave"} · {a.active ? "ativo" : "pausado"}</span>
              </div>
              <form action={toggleAlert.bind(null, a.id)}><button className="btn btn-ghost btn-sm">{a.active ? "Pausar" : "Ativar"}</button></form>
              <form action={deleteAlert.bind(null, a.id)}><button className="btn btn-danger btn-sm">Excluir</button></form>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Nenhum alerta ainda">Crie um acima ou ative “Receber alertas” na página de qualquer político.</EmptyState>
      )}
    </div>
  );
}
