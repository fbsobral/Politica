import Link from "next/link";
import { AuthAside } from "@/components/auth-aside";
import { IconLogo } from "@/components/icons";

type Mode = "entrar" | "cadastrar";

const COPY: Record<Mode, { headline: React.ReactNode; title: string; sub: string; switchText: string; switchHref: string; switchLabel: string }> = {
  entrar: {
    headline: <>A política da sua cidade ao Planalto, <em className="font-normal italic">num só lugar.</em></>,
    title: "Que bom te ver de novo",
    sub: "Entre para acompanhar as notícias, os representantes e os resumos da sua cidade.",
    switchText: "Ainda não tem conta?",
    switchHref: "/sign-up",
    switchLabel: "Criar conta",
  },
  cadastrar: {
    headline: <>Acompanhe a política com <em className="font-normal italic">clareza.</em></>,
    title: "Crie sua conta",
    sub: "Leva menos de um minuto: depois é só escolher a sua cidade.",
    switchText: "Já tem conta?",
    switchHref: "/sign-in",
    switchLabel: "Entrar",
  },
};

/** Tela dividida ao meio: marca e benefícios à esquerda, formulário à direita. */
export function AuthShell({ children, mode = "entrar", showSwitch = true, bare = false }: { children: React.ReactNode; mode?: Mode; showSwitch?: boolean; bare?: boolean }) {
  const c = COPY[mode];
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <AuthAside headline={c.headline} />

      <section className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 lg:invisible" aria-label="Política — página inicial">
            <IconLogo />
            <span className="display text-xl font-semibold">Política</span>
          </Link>
          {showSwitch && !bare && (
            <p className="text-sm text-muted">
              {c.switchText}{" "}
              <Link href={c.switchHref} className="font-semibold text-brand underline-offset-4 hover:underline">{c.switchLabel}</Link>
            </p>
          )}
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          {!bare && (
            <>
              <h1 className="display text-3xl font-semibold leading-tight sm:text-4xl">{c.title}</h1>
              <p className="mb-7 mt-2 text-muted">{c.sub}</p>
            </>
          )}
          {children}
          <Link href="/" className="mt-6 text-center text-sm text-muted hover:text-ink">← Voltar para o início</Link>
        </div>

        <p className="text-center text-xs text-faint">Ao continuar, você concorda em receber os e-mails que escolher em Configurações. Resumos por IA podem conter imprecisões.</p>
      </section>
    </main>
  );
}
