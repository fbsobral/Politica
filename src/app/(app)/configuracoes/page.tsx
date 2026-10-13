import Link from "next/link";
import { savePrefs, sendTestDigest } from "@/app/actions";
import { LocationForm } from "@/app/onboarding/location-form";
import { Notice, PageHeader } from "@/components/ui";
import { emailEnabled } from "@/lib/email";
import { UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Conta" };
export const dynamic = "force-dynamic";

const MSG: Record<string, [kind: "ok" | "erro" | "info", text: string]> = {
  ok: ["ok", "Resumo enviado! Confira sua caixa de entrada."],
  vazio: ["info", "Ainda não há notícias classificadas para montar o resumo."],
  erro: ["erro", "Não foi possível enviar. Verifique RESEND_API_KEY e EMAIL_FROM (domínio verificado no Resend)."],
};

function Toggle({ name, defaultChecked, title, desc }: { name: string; defaultChecked: boolean; title: string; desc: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-[0.9375rem] font-semibold">{title}</span>
        <span className="block text-sm text-muted">{desc}</span>
      </span>
      <span className="relative mt-0.5 inline-flex h-6 w-11 flex-none">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="absolute inset-0 rounded-full bg-line-strong transition peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export default async function ConfigPage({ searchParams }: { searchParams: Promise<{ digest?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const msg = sp.digest ? MSG[sp.digest] : null;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader eyebrow={user.email} title="Sua conta" />

      {user.role === "ADMIN" && (
        <Link href="/admin/usuarios" className="card-flat flex items-center justify-between gap-3 p-4 transition-shadow hover:shadow-card">
          <span><b className="block">Painel de administração</b><span className="text-sm text-muted">Usuários, convites e robô de notícias.</span></span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <section className="card p-5 sm:p-6">
        <h2 className="display mb-1 text-xl font-semibold">E-mails</h2>
        <form action={savePrefs}>
          <div className="divide-y divide-line">
            <Toggle name="dailyDigest" defaultChecked={user.dailyDigest} title="Resumo diário às 7h" desc="O que aconteceu nas esferas municipal, estadual e federal, em poucas linhas." />
            <Toggle name="alertEmails" defaultChecked={user.alertEmails} title="Alertas" desc="Aviso quando surgirem notícias das suas palavras-chave e dos políticos monitorados." />
          </div>
          <button className="btn btn-primary mt-3">Salvar preferências</button>
        </form>
        <form action={sendTestDigest} className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <button className="btn btn-secondary btn-sm" disabled={!emailEnabled()}>Enviar o resumo de hoje agora</button>
          {!emailEnabled() && <span className="text-xs text-faint">Configure RESEND_API_KEY</span>}
        </form>
        {msg && <div className="mt-3"><Notice kind={msg[0]}>{msg[1]}</Notice></div>}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="display mb-1 text-xl font-semibold">Onde você vota</h2>
        <p className="mb-4 text-sm text-muted">Define o feed municipal/estadual e os representantes exibidos.</p>
        <LocationForm ufs={UFS} initialUf={user.uf} initialCity={user.municipality} submitLabel="Atualizar localização" />
      </section>
    </div>
  );
}
