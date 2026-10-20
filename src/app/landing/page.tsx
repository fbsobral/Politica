import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmailMock, FeedMock, PeopleMock } from "@/components/landing-mocks";
import { IconBell, IconCalendar, IconCoins, IconFeed, IconLogo, IconPeople, IconSearch, IconShield, IconVote } from "@/components/icons";

export const metadata: Metadata = {
  title: "Política — a política da sua cidade ao Planalto, num só lugar",
  description:
    "Notícias de política municipal, estadual e federal atualizadas toda hora, seus representantes, votações do Congresso, eleições e checagem de fatos. Crie sua conta e receba resumos no e-mail.",
  openGraph: {
    title: "Política — a política da sua cidade ao Planalto, num só lugar",
    description: "Notícias por esfera, representantes, votações, eleições e resumos no e-mail.",
    type: "website",
    locale: "pt_BR",
  },
};

const FEATURES = [
  { icon: <IconFeed />, title: "Feed por esfera e por poder", text: "Municipal, estadual e federal separados — e filtros por Legislativo, Executivo e Judiciário, por veículo, tipo de veículo e categoria." },
  { icon: <IconSearch />, title: "Resumo da matéria em 3 parágrafos", text: "Abra qualquer notícia e entenda o essencial sem sair do app. Resumo feito por IA a partir do texto publicado, sempre com link para a matéria completa." },
  { icon: <IconPeople />, title: "Quem representa você", text: "Prefeito, vereadores, governador, deputados, senadores e presidente — com partido, projetos de autoria e as notícias que citam cada um." },
  { icon: <IconCalendar />, title: "Agenda e votações do Congresso", text: "Sessões e comissões da Câmara e do Senado, resultado das votações e uma explicação em linguagem simples do que estava em jogo." },
  { icon: <IconVote />, title: "Eleições, sem ruído", text: "Candidatos, pesquisas, calendário e notícias por cargo — presidente, governador, senado e deputados do seu estado." },
  { icon: <IconShield />, title: "Checagem de fatos", text: "Boatos e declarações verificados por agências independentes, por esfera: nacional, do seu estado e da sua cidade." },
  { icon: <IconBell />, title: "Alertas e resumos no e-mail", text: "Palavras-chave e políticos que você segue geram alertas; e o resumo diário, semanal ou mensal traz o que importa na sua cidade, no estado e no país — com as votações do Congresso." },
  { icon: <IconCoins />, title: "Orçamento público", text: "Para onde vai o dinheiro da sua cidade, do estado e da União: despesa por função, receitas, gasto por habitante e previsto x realizado." },
  { icon: <IconFeed />, title: "Diário Oficial da sua cidade", text: "Edições recentes e busca por texto nos diários oficiais do município." },
];

const STEPS = [
  { n: "1", title: "Escolha sua cidade", text: "Crie a conta e diga onde você vota. É só isso para montar o seu painel." },
  { n: "2", title: "O robô trabalha por você", text: "De hora em hora ele coleta, remove repetidas e classifica as notícias por esfera, poder e assunto." },
  { n: "3", title: "Acompanhe do seu jeito", text: "Navegue pelo feed, siga políticos, crie alertas e escolha receber resumos por e-mail." },
];

const FAQ = [
  { q: "De onde vêm as notícias?", a: "De dezenas de veículos nacionais, regionais e fontes oficiais (via feeds RSS e buscas públicas). O app mostra título, trecho e link — a matéria completa sempre abre no site do veículo." },
  { q: "A IA opina sobre as notícias?", a: "Não. A IA só classifica (esfera, poder, assunto) e resume com fidelidade ao texto, sem opinião. Os resumos são marcados como gerados por IA e podem conter imprecisões: confira a matéria original." },
  { q: "O que são os níveis (tiers) dos veículos?", a: "Uma indicação de alcance e tipo do veículo — não de qualidade nem de posição política. Você pode filtrar o feed só por veículos de maior alcance, se quiser." },
  { q: "De onde vêm os dados dos políticos?", a: "Das bases abertas da Câmara dos Deputados, do Senado, do TSE e do IBGE." },
  { q: "Posso escolher quais e-mails receber?", a: "Sim. Resumo diário, semanal e mensal são independentes, e você escolhe também quais níveis de veículos entram em cada um. Dá para desligar tudo quando quiser." },
];

export default async function Landing() {
  const { userId } = await auth();
  if (userId) redirect("/");

  const cta = "btn btn-primary !px-6 !py-3 !text-base";
  return (
    <div className="relative isolate min-h-screen overflow-x-clip">
      {/* brilho do topo: ocupa a largura toda da tela e some suavemente para baixo (sem borda cortada) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem]"
        style={{
          backgroundImage:
            "radial-gradient(55% 60% at 50% 0%, color-mix(in srgb, var(--gold) 20%, transparent), transparent 72%), radial-gradient(38% 46% at 88% 14%, color-mix(in srgb, var(--brand) 14%, transparent), transparent 72%), radial-gradient(34% 40% at 10% 18%, color-mix(in srgb, var(--brand) 9%, transparent), transparent 72%)",
          maskImage: "linear-gradient(to bottom, #000 0%, #000 45%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 45%, transparent 100%)",
        }}
      />
      {/* topo */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Política — início">
          <IconLogo />
          <span className="display text-xl font-semibold tracking-tight">Política</span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-medium text-muted md:flex" aria-label="Seções">
          <a href="#recursos" className="rounded-full px-3 py-1.5 hover:bg-ink/5 hover:text-ink">Recursos</a>
          <a href="#como-funciona" className="rounded-full px-3 py-1.5 hover:bg-ink/5 hover:text-ink">Como funciona</a>
          <a href="#perguntas" className="rounded-full px-3 py-1.5 hover:bg-ink/5 hover:text-ink">Perguntas</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="btn btn-ghost btn-sm">Entrar</Link>
          <Link href="/sign-up" className="btn btn-primary btn-sm">Criar conta</Link>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 text-center sm:px-6 sm:pt-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-municipal" /> Robô atualizando as notícias toda hora
          </span>
          <h1 className="display mx-auto mt-6 max-w-4xl text-[2.6rem] font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
            A política da sua cidade ao Planalto, <em className="font-normal italic text-brand">num só lugar.</em>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Notícias municipais, estaduais e federais organizadas por esfera, poder e assunto. Saiba quem te representa, o que o Congresso votou e o que está em jogo nas eleições — com resumos claros e alertas no seu e-mail.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up" className={cta}>Criar minha conta</Link>
            <a href="#como-funciona" className="btn btn-secondary !px-6 !py-3 !text-base">Como funciona</a>
          </div>
          <p className="mt-3 text-xs text-faint">Leva menos de um minuto. Você só precisa de um e-mail.</p>

          <div className="mx-auto mt-14 max-w-3xl">
            <FeedMock />
            <p className="mt-3 text-xs text-faint">Exemplo ilustrativo, com dados fictícios.</p>
          </div>
        </section>

        {/* esferas */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Três esferas, um painel</p>
            <h2 className="display mt-2 text-3xl font-semibold leading-tight sm:text-5xl">Do bairro ao país, <em className="font-normal italic text-brand">sem se perder.</em></h2>
            <p className="mt-4 text-muted">Cada notícia chega separada pela esfera de governo a que pertence, para você enxergar o que decide a sua vida — perto e longe de casa.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { dot: "bg-municipal", soft: "bg-municipal-soft text-municipal", t: "Municipal", d: "Prefeitura, câmara de vereadores, obras, saúde, educação e serviços da sua cidade." },
              { dot: "bg-estadual", soft: "bg-estadual-soft text-estadual", t: "Estadual", d: "Governo do estado, assembleia legislativa, tribunais e secretarias." },
              { dot: "bg-federal", soft: "bg-federal-soft text-federal", t: "Federal", d: "Presidência, ministérios, Congresso, STF e os temas que movem o país." },
            ].map((e) => (
              <div key={e.t} className="card p-6">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${e.soft}`}><span className={`h-2 w-2 rounded-full ${e.dot}`} />{e.t}</span>
                <p className="display mt-4 text-2xl font-semibold">{e.t}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{e.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* recursos */}
        <section id="recursos" className="scroll-mt-20 border-y border-line bg-surface-2/60 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">Tudo para acompanhar</p>
              <h2 className="display mt-2 text-3xl font-semibold leading-tight sm:text-5xl">Informação que você <em className="font-normal italic text-brand">entende.</em></h2>
            </div>
            <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <li key={f.title} className="card p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">{f.icon}</span>
                    <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="display mt-4 text-xl font-semibold leading-snug">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* representantes + e-mail */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Seus representantes</p>
            <h2 className="display mt-2 text-3xl font-semibold leading-tight sm:text-4xl">Saiba <em className="font-normal italic text-brand">quem decide</em> por você.</h2>
            <p className="mt-4 text-muted">Do prefeito ao presidente: partido, mandato, contatos, projetos de autoria e as notícias mais recentes. Siga quem importa e ative alertas para não perder nada.</p>
            <div className="mt-6"><PeopleMock /></div>
            <p className="mt-2 text-xs text-faint">Exemplo ilustrativo, com nomes fictícios.</p>
          </div>
          <div>
            <p className="eyebrow">No seu e-mail</p>
            <h2 className="display mt-2 text-3xl font-semibold leading-tight sm:text-4xl">O resumo <em className="font-normal italic text-brand">chega até você.</em></h2>
            <p className="mt-4 text-muted">Escolha receber todo dia, toda semana ou todo mês. Cada resumo traz o que mais mexeu com a política na sua cidade, no seu estado e no país — incluindo as votações do Congresso.</p>
            <div className="mt-6"><EmailMock /></div>
          </div>
        </section>

        {/* como funciona */}
        <section id="como-funciona" className="scroll-mt-20 border-y border-line bg-surface-2/60 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">Como funciona</p>
              <h2 className="display mt-2 text-3xl font-semibold leading-tight sm:text-5xl">Três passos e <em className="font-normal italic text-brand">pronto.</em></h2>
            </div>
            <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="card p-6">
                  <span className="display text-5xl font-semibold leading-none text-brand">{s.n}</span>
                  <h3 className="display mt-4 text-xl font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* perguntas */}
        <section id="perguntas" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="text-center">
            <p className="eyebrow">Perguntas frequentes</p>
            <h2 className="display mt-2 text-3xl font-semibold leading-tight sm:text-4xl">Transparência em primeiro lugar.</h2>
          </div>
          <div className="mt-8 space-y-2.5">
            {FAQ.map((f) => (
              <details key={f.q} className="card-flat group p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="text-xl text-faint transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* chamada final: faixa azul da marca, de ponta a ponta */}
        <section className="panel-navy relative overflow-hidden">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-24">
            <p className="eyebrow !text-white/70">Comece agora</p>
            <h2 className="display mt-3 text-4xl font-semibold leading-[1.05] sm:text-6xl">Acompanhe a política com <em className="font-normal italic">clareza.</em></h2>
            <p className="mx-auto mt-5 max-w-xl text-lg opacity-85">Crie sua conta, escolha sua cidade e receba a política no seu ritmo — no feed e no e-mail.</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/sign-up" className="btn !bg-white !px-7 !py-3.5 !text-base !text-[#17407f] hover:!bg-white/90">Criar minha conta</Link>
              <Link href="/sign-in" className="btn !border !border-white/40 !px-7 !py-3.5 !text-base !text-white hover:!bg-white/10">Já tenho conta</Link>
            </div>
            <p className="mt-4 text-xs opacity-70">Leva menos de um minuto.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Política · Dados abertos da Câmara dos Deputados, do Senado, do TSE e do IBGE. Resumos gerados por IA podem conter imprecisões.</p>
          <div className="flex gap-4">
            <Link href="/sign-in" className="hover:text-ink">Entrar</Link>
            <Link href="/sign-up" className="hover:text-ink">Criar conta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
