import { IconLogo } from "@/components/icons";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand p-12 text-brand-ink lg:flex lg:flex-col lg:justify-between" style={{ backgroundImage: "radial-gradient(circle at 90% 8%, color-mix(in srgb, var(--gold) 60%, transparent), transparent 38%), linear-gradient(160deg, var(--brand), color-mix(in srgb, var(--brand) 60%, #000))" }}>
        <div className="flex items-center gap-2.5"><IconLogo /><span className="display text-xl font-semibold">Política</span></div>
        <div>
          <h2 className="display text-5xl font-semibold leading-[1.05]">Saiba o que acontece na política — onde você mora.</h2>
          <ul className="mt-6 space-y-2.5 text-lg opacity-85">
            <li>• Feed municipal, estadual e federal</li>
            <li>• Prefeito, governador, deputados e senadores</li>
            <li>• Alertas e resumo diário por e-mail</li>
          </ul>
        </div>
        <p className="text-sm opacity-60">Câmara · Senado · TSE · IBGE</p>
      </aside>
      <section className="flex flex-col items-center justify-center gap-6 p-5 sm:p-10">
        <div className="flex items-center gap-2.5 lg:hidden"><IconLogo /><span className="display text-xl font-semibold">Política</span></div>
        {children}
      </section>
    </main>
  );
}
