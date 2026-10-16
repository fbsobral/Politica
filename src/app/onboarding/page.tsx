import { IconLogo } from "@/components/icons";
import { AuthAside } from "@/components/auth-aside";
import { Notice } from "@/components/ui";
import { UFS } from "@/lib/taxonomy";
import { getDbUser } from "@/lib/user";
import { LocationForm } from "./location-form";

export const metadata = { title: "Onde você vota?" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ erro?: string; uf?: string }> }) {
  const user = await getDbUser();
  const sp = await searchParams;
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <AuthAside headline={<>A política da sua cidade, do seu estado e do país, <em className="font-normal italic">num só lugar.</em></>} />
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
