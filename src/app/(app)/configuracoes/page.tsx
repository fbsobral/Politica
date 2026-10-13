import Link from "next/link";
import { savePrefs, sendTestDigest } from "@/app/actions";
import { LocationForm } from "@/app/onboarding/location-form";
import { Notice, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
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

function TierPicker({ name, value }: { name: string; value: string }) {
  const selected = new Set(value.split(","));
  return (
    <fieldset className="flex flex-wrap items-center gap-2 pb-3 pl-0.5">
      <legend className="sr-only">Tiers de veículos considerados</legend>
      <span className="text-xs font-semibold text-muted">Veículos considerados:</span>
      {[["1", "Tier 1"], ["2", "Tier 2"], ["3", "Tier 3"]].map(([v, l]) => (
        <label key={v} className="cursor-pointer">
          <input type="checkbox" name={name} value={v} defaultChecked={selected.has(v)} className="peer sr-only" />
          <span className="block rounded-full border border-line-strong px-3 py-1 text-xs font-semibold text-muted transition peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand">{l}</span>
        </label>
      ))}
    </fieldset>
  );
}

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
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <div className="lg:col-span-2"><PageHeader eyebrow={user.email} title="Sua conta" /></div>

      {user.role === "ADMIN" && (
        <Link href="/admin" className="card-flat flex lg:col-span-2 items-center justify-between gap-3 p-4 transition-shadow hover:shadow-card">
          <span><b className="block">Painel de administração</b><span className="text-sm text-muted">Visão geral, usuários, fontes e robô de notícias.</span></span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <section className="card p-5 sm:p-6">
        <h2 className="display mb-1 text-xl font-semibold">E-mails</h2>
        <form action={savePrefs}>
          <div className="divide-y divide-line">
            <div>
              <Toggle name="dailyDigest" defaultChecked={user.dailyDigest} title="Resumo diário · todo dia às 7h" desc="Notícias das três esferas, votações recentes no Congresso, quem você segue e checagens." />
              <TierPicker name="tiers_daily" value={user.digestTiersDaily} />
            </div>
            <div>
              <Toggle name="weeklyDigest" defaultChecked={user.weeklyDigest} title="Resumo semanal · segunda às 7h" desc="Os assuntos que mais mexeram com a política na semana, com as votações do período." />
              <TierPicker name="tiers_weekly" value={user.digestTiersWeekly} />
            </div>
            <div>
              <Toggle name="monthlyDigest" defaultChecked={user.monthlyDigest} title="Resumo mensal · dia 1 às 7h" desc="Panorama do mês: principais notícias, votações e checagens." />
              <TierPicker name="tiers_monthly" value={user.digestTiersMonthly} />
            </div>
            <Toggle name="alertEmails" defaultChecked={user.alertEmails} title="Alertas" desc="Aviso quando surgirem notícias das suas palavras-chave e dos políticos monitorados." />
          </div>
          <SubmitButton className="btn btn-primary mt-3" pendingText="Salvando…">Salvar preferências</SubmitButton>
        </form>
        <form className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <span className="w-full text-xs font-semibold text-muted">Enviar um agora para testar:</span>
          <SubmitButton formAction={sendTestDigest.bind(null, "daily")} className="btn btn-secondary btn-sm" disabled={!emailEnabled()} pendingText="Enviando…">Diário</SubmitButton>
          <SubmitButton formAction={sendTestDigest.bind(null, "weekly")} className="btn btn-secondary btn-sm" disabled={!emailEnabled()} pendingText="Enviando…">Semanal</SubmitButton>
          <SubmitButton formAction={sendTestDigest.bind(null, "monthly")} className="btn btn-secondary btn-sm" disabled={!emailEnabled()} pendingText="Enviando…">Mensal</SubmitButton>
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
