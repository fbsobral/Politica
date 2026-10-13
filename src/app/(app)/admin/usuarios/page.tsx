import { createUser, deleteUser, setRole } from "@/app/admin-actions";
import { Notice, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { SourceAvatar } from "@/components/ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/user";

export const metadata = { title: "Admin · Usuários" };
export const dynamic = "force-dynamic";

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const users = await db.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageHeader eyebrow="Administração" title="Usuários" />
      <div className="mb-5 space-y-2">
        {sp.ok && <Notice kind="ok">{sp.ok}</Notice>}
        {sp.erro && <Notice kind="erro">{sp.erro}</Notice>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="card h-fit p-5">
          <h2 className="display mb-4 text-xl font-semibold">Cadastrar usuário</h2>
          <form action={createUser} className="space-y-3.5">
            <label className="block"><span className="eyebrow mb-1.5 block">E-mail</span><input name="email" type="email" required placeholder="pessoa@email.com" className="input" /></label>
            <label className="block"><span className="eyebrow mb-1.5 block">Nome (opcional)</span><input name="name" className="input" /></label>
            <label className="block">
              <span className="eyebrow mb-1.5 block">Papel</span>
              <select name="role" defaultValue="USER" className="input"><option value="USER">Usuário</option><option value="ADMIN">Administrador</option></select>
            </label>
            <label className="block">
              <span className="eyebrow mb-1.5 block">Como cadastrar</span>
              <select name="mode" defaultValue="convite" className="input">
                <option value="convite">Enviar convite por e-mail</option>
                <option value="senha">Criar com senha provisória</option>
              </select>
            </label>
            <label className="block"><span className="eyebrow mb-1.5 block">Senha provisória</span><input name="password" minLength={8} placeholder="Só no modo “com senha”" autoComplete="off" className="input" /></label>
            <SubmitButton className="btn btn-primary w-full" pendingText="Cadastrando…">Cadastrar</SubmitButton>
          </form>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2.5"><span className="display text-xl font-semibold">Todos</span><span className="chip">{users.length}</span></h2>
          <ul className="space-y-2.5">
            {users.map((u) => {
              const pending = u.clerkId.startsWith("pending:");
              return (
                <li key={u.id} className="card-flat flex flex-wrap items-center gap-3 p-3.5">
                  <SourceAvatar name={u.name ?? u.email} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{u.name ?? u.email}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${u.role === "ADMIN" ? "bg-gold/25 text-ink" : "bg-ink/5 text-muted"}`}>{u.role === "ADMIN" ? "Admin" : "Usuário"}</span>
                      {pending && <span className="chip !bg-estadual-soft !text-estadual">convite pendente</span>}
                    </div>
                    <div className="truncate text-xs text-muted">{u.email}{u.municipality && ` · ${u.municipality}/${u.uf}`}</div>
                  </div>
                  {u.id === me.id ? (
                    <span className="text-xs text-faint">você</span>
                  ) : (
                    <div className="flex gap-1">
                      <form action={setRole.bind(null, u.id, u.role === "ADMIN" ? "USER" : "ADMIN")}><button className="btn btn-ghost btn-sm">{u.role === "ADMIN" ? "Tornar usuário" : "Tornar admin"}</button></form>
                      <form action={deleteUser.bind(null, u.id)}><ConfirmButton message={`Excluir ${u.email}? A conta também será removida do login e não dá para desfazer.`}>Excluir</ConfirmButton></form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
