import { IconLogo } from "@/components/icons";
import { Notice } from "@/components/ui";
import { UFS } from "@/lib/taxonomy";
import { getDbUser } from "@/lib/user";
import { LocationForm } from "./location-form";

export const metadata = { title: "Onde você vota?" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ erro?: string; uf?: string }> }) {
  const user = await getDbUser();
  const sp = await searchParams;
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand p-12 text-brand-ink lg:flex lg:flex-col lg:justify-between" style={{ backgroundImage: "radial-gradient(circle at 90% 8%, color-mix(in srgb, var(--gold) 60%, transparent), transparent 38%), linear-gradient(160deg, var(--brand), color-mix(in srgb, var(--brand) 60%, #000))" }}>
        <div className="flex items-center gap-2.5"><IconLogo /><span className="display text-xl font-semibold">Política</span></div>
        <div>
          <h2 className="display text-5xl font-semibold leading-[1.05]">A política da sua cidade, do seu estado e do país, num só lugar.</h2>
          <p className="mt-5 max-w-md text-lg opacity-80">Notícias atualizadas a cada hora, organizadas por veículo e assunto, e os rostos de quem decide por você.</p>
        </div>
        <p className="text-sm opacity-60">Câmara · Senado · TSE · IBGE</p>
      </aside>
      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden"><IconLogo /><span className="display text-xl font-semibold">Política</span></div>
          <p className="eyebrow mb-1">Passo único</p>
          <h1 className="display text-3xl font-semibold sm:text-4xl">Onde você vota?</h1>
          <p className="mb-7 mt-2 text-muted">Usamos seu estado e município para montar o feed local e mostrar seus representantes.</p>
          {sp.erro && <div className="mb-4"><Notice kind="erro">Escolha um estado e um município válidos.</Notice></div>}
          <div className="card p-5 sm:p-6">
            <LocationForm ufs={UFS} initialUf={sp.uf ?? user.uf ?? undefined} initialCity={user.municipality ?? undefined} />
          </div>
        </div>
      </section>
    </main>
  );
}
