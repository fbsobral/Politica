import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StickyCta } from "@/components/sticky-cta";
import { AssistantMock, EmailMock, FeedMock, NumbersMock, PeopleMock } from "@/components/landing-mocks";
import { IconBell, IconCalendar, IconChart, IconCoins, IconCompass, IconFeed, IconFlag, IconLogo, IconPeople, IconSearch, IconShield, IconStar, IconVote } from "@/components/icons";

export const metadata: Metadata = {
  title: "Política — a política da sua cidade ao Planalto, num só lugar",
  description:
    "Notícias de política municipal, estadual e federal atualizadas toda hora, seus representantes, votações do Congresso, eleições, checagens, orçamento, inflação e indicadores do governo — com um assistente para tirar dúvidas e resumos no e-mail.",
  openGraph: {
    title: "Política — a política da sua cidade ao Planalto, num só lugar",
    description: "Notícias por esfera, representantes, votações, eleições, os números do governo e um assistente que explica tudo.",
    type: "website",
    locale: "pt_BR",
  },
};

const svg = (d: React.ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);
const IconDoc = () => svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>);
const IconTarget = () => svg(<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>);
const IconTrend = () => svg(<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>);
const IconGauge = () => svg(<><path d="M4 18a8 8 0 1 1 16 0" /><path d="M12 18l4-6" /></>);
const IconChat = () => svg(<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />);
const IconHelp = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.2M12 16.5h.01" /></>);

type Feature = { icon: React.ReactNode; title: string; text: string };
const GROUPS: { id: string; eyebrow: string; title: string; text: string; items: Feature[] }[] = [
  {
    id: "informe-se",
    eyebrow: "Informe-se",
    title: "Notícias que você entende",
    text: "Coletadas a cada hora de dezenas de veículos e fontes oficiais.",
    items: [
      { icon: <IconFeed />, title: "Feed por esfera e por poder", text: "Municipal, estadual e federal, com filtros por Legislativo, Executivo e Judiciário, assunto e veículo." },
      { icon: <IconSearch />, title: "Resumo em 3 parágrafos", text: "Abra uma notícia e leia o essencial, com link para a matéria completa." },
      { icon: <IconShield />, title: "Checagem de fatos", text: "Boatos e declarações verificados por agências, do país à sua cidade." },
      { icon: <IconDoc />, title: "Diário Oficial da cidade", text: "Edições recentes e busca por texto nos atos da prefeitura." },
    ],
  },
  {
    id: "quem-e-quem",
    eyebrow: "Quem é quem",
    title: "Saiba quem decide por você",
    text: "Do prefeito ao presidente, com dados abertos da Câmara, do Senado e do TSE.",
    items: [
      { icon: <IconPeople />, title: "Seus representantes", text: "Partido, mandato, contatos, projetos de autoria, gastos e as notícias que citam cada um." },
      { icon: <IconFlag />, title: "Partidos", text: "Notícias, perfil e eleitos de cada partido." },
      { icon: <IconCompass />, title: "Seu perfil político", text: "Responda o quiz e descubra os partidos mais próximos das suas ideias." },
    ],
  },
  {
    id: "acompanhe",
    eyebrow: "Acompanhe",
    title: "O que está acontecendo",
    text: "Votações, eleições e avisos quando algo importante sai.",
    items: [
      { icon: <IconCalendar />, title: "Agenda e votações", text: "Sessões e votações do Congresso, explicadas em linguagem simples." },
      { icon: <IconVote />, title: "Eleições", text: "Candidatos, pesquisas, calendário e notícias por cargo." },
      { icon: <IconBell />, title: "Alertas e resumos no e-mail", text: "Avisos por palavra-chave ou político e resumos diários, semanais ou mensais." },
      { icon: <IconStar />, title: "Favoritos", text: "Guarde notícias para ler depois." },
    ],
  },
  {
    id: "numeros",
    eyebrow: "Números do governo",
    title: "O dinheiro público, às claras",
    text: "Dados do Tesouro Nacional, do IBGE e do Banco Central, para a cidade, o estado e o país.",
    items: [
      { icon: <IconCoins />, title: "Orçamento", text: "De onde vem e para onde vai o dinheiro, por área e subárea, em 10 anos." },
      { icon: <IconTarget />, title: "Expectativa fiscal", text: "Previsto x realizado: a lei orçamentária (LOA) está sendo cumprida? Onde o ano deve fechar." },
      { icon: <IconTrend />, title: "Inflação", text: "IPCA frente à meta, expectativas do mercado e os pilares que puxam os preços." },
      { icon: <IconChart />, title: "Indicadores", text: "Economia, dívida, segurança, pobreza e mais, em até 30 anos." },
      { icon: <IconGauge />, title: "Score dos governos", text: "Uma nota de 0 a 100 por ano, metade economia e metade social, com a régua que você escolher." },
      { icon: <IconCoins />, title: "ROI do orçamento", text: "O gasto em cada área mudou os indicadores dessa área?" },
    ],
  },
  {
    id: "pergunte",
    eyebrow: "Pergunte",
    title: "Um assistente que explica",
    text: "Tire dúvidas sobre política e sobre os números que você está vendo.",
    items: [
      { icon: <IconChat />, title: "Assistente em todas as telas", text: "Pergunte em linguagem simples. O botão Perguntar ao lado de cada gráfico já envia o contexto." },
      { icon: <IconHelp />, title: "Tour em cada tela", text: "Na primeira visita, cada módulo se apresenta. Depois, é só tocar em ? para rever." },
    ],
  },
];

const STEPS = [
  { n: "1", title: "Escolha sua cidade", text: "Crie a conta e diga onde você vota. É só isso para montar o seu painel." },
  { n: "2", title: "Faça o tour de 1 minuto", text: "Uma apresentação rápida mostra cada parte do app; cada tela também explica como funciona na primeira visita." },
  { n: "3", title: "Acompanhe do seu jeito", text: "Navegue pelo feed, siga políticos, veja os números, pergunte ao assistente e receba resumos por e-mail." },
];

const FAQ = [
  { q: "De onde vêm as notícias?", a: "De dezenas de veículos nacionais, regionais e fontes oficiais (via feeds RSS e buscas públicas). O app mostra título, trecho e link — a matéria completa sempre abre no site do veículo." },
  { q: "De onde vêm os números do governo?", a: "Orçamento e expectativa fiscal: demonstrativos que prefeituras, estados e a União enviam ao Tesouro Nacional (Siconfi). Inflação e indicadores: IBGE, Banco Central (incluindo o boletim Focus) e outras bases oficiais. Cada gráfico informa a fonte." },
  { q: "A IA opina sobre as notícias?", a: "Não. A IA classifica (esfera, poder, assunto), resume com fidelidade ao texto e responde dúvidas no assistente, sem opinião. Conteúdo gerado por IA é marcado e pode conter imprecisões: confira a fonte original." },
  { q: "O que são os níveis (tiers) dos veículos?", a: "Uma indicação de alcance e tipo do veículo — não de qualidade nem de posição política. Você pode filtrar o feed só por veículos de maior alcance, se quiser." },
  { q: "De onde vêm os dados dos políticos?", a: "Das bases abertas da Câmara dos Deputados, do Senado, do TSE e do IBGE." },
  { q: "Funciona no celular?", a: "Sim. O app foi pensado primeiro para o celular, com barra de navegação embaixo, filtros recolhíveis e telas que se apresentam sozinhas. Você pode adicioná-lo à tela inicial como um aplicativo." },
  { q: "Posso escolher quais e-mails receber?", a: "Sim. Resumo diário, semanal e mensal são independentes, e você escolhe também quais níveis de veículos entram em cada um. Dá para desligar tudo quando quiser." },
];

export default async function Landing() {
  const { userId } = await auth();
  if (userId) redirect("/");

  const cta = "btn btn-primary !px-6 !py-3 !text-base";
  const total = GROUPS.reduce((n, g) => n + g.items.length, 0);
  return (
    <div className="relative isolate min-h-screen overflow-x-clip pb-20 sm:pb-0">
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
          <a href="#orcamento-e-inflacao" className="rounded-full px-3 py-1.5 hover:bg-ink/5 hover:text-ink">Números</a>
          <a href="#como-funciona" className="rounded-full px-3 py-1.5 hover:bg-ink/5 hover:text-ink">Como funciona</a>
          <a href="#perguntas" className="rounded-full px-3 py-1.5 hover:bg-ink/5 hover:text-ink">Perguntas</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="btn btn-ghost btn-sm">Entrar</Link>
          <Link href="/sign-up" className="btn btn-primary btn-sm hidden sm:inline-flex">Criar conta</Link>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-8 text-center sm:px-6 sm:pt-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-municipal" /> Robô atualizando as notícias toda hora
          </span>
          <h1 className="display mx-auto mt-6 max-w-4xl text-[2.5rem] font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
            A política da sua cidade ao Planalto, <em className="font-normal italic text-brand">num só lugar.</em>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Notícias organizadas por esfera e poder, quem te representa, o que o Congresso votou, as eleições e os números do governo — orçamento, inflação e indicadores — com um assistente que explica tudo em linguagem simples.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link href="/sign-up" className={cta}>Criar minha conta</Link>
            <a href="#recursos" className="btn btn-secondary !px-6 !py-3 !text-base">Ver o que dá para fazer</a>
          </div>
          <p className="mt-3 text-xs text-faint">Leva menos de um minuto. Você só precisa de um e-mail.</p>

          {/* atalhos para os grupos: rolam de lado no celular */}
          <nav aria-label="Grupos de recursos" className="-mx-4 mt-10 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            <ul className="mx-auto flex w-max gap-2 sm:flex-wrap sm:justify-center">
              {GROUPS.map((g) => (
                <li key={g.id}>
                  <a href={`#${g.id}`} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium text-muted shadow-card hover:text-ink">
                    <span className="text-brand [&_svg]:h-4 [&_svg]:w-4">{g.items[0].icon}</span>{g.eyebrow}
                    <span className="rounded-full bg-ink/5 px-1.5 text-[11px] font-semibold">{g.items.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mx-auto mt-10 max-w-3xl">
            <FeedMock />
            <p className="mt-3 text-xs text-faint">Exemplo ilustrativo, com dados fictícios.</p>
          </div>
        </section>

        {/* esferas */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Três esferas, um painel</p>
            <h2 className="display mt-2 text-3xl font-semibold leading-tight sm:text-5xl">Do bairro ao país, <em className="font-normal italic text-brand">sem se perder.</em></h2>
            <p className="mt-4 text-muted">Notícias, representantes e números chegam separados pela esfera de governo, para você enxergar o que decide a sua vida — perto e longe de casa.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
            {[
              { dot: "bg-municipal", soft: "bg-municipal-soft text-municipal", t: "Municipal", d: "Prefeitura, câmara de vereadores, o orçamento e o Diário Oficial da sua cidade." },
              { dot: "bg-estadual", soft: "bg-estadual-soft text-estadual", t: "Estadual", d: "Governo do estado, assembleia, deputados estaduais e as contas do estado." },
              { dot: "bg-federal", soft: "bg-federal-soft text-federal", t: "Federal", d: "Presidência, Congresso, STF, inflação e os números que movem o país." },
            ].map((e) => (
              <div key={e.t} className="card p-5 sm:p-6">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${e.soft}`}><span className={`h-2 w-2 rounded-full ${e.dot}`} />{e.t}</span>
                <p className="mt-3 text-sm leading-relaxed text-muted">{e.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* recursos, em grupos */}
        <section id="recursos" className="scroll-mt-20 border-y border-line bg-surface-2/60 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">{total} recursos, 5 frentes</p>
              <h2 className="display mt-2 text-3xl font-semibold leading-tight sm:text-5xl">Tudo para acompanhar, <em className="font-normal italic text-brand">e entender.</em></h2>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {GROUPS.map((g) => (
                <section key={g.id} id={g.id} aria-labelledby={`g-${g.id}`} className={`card scroll-mt-20 p-5 sm:p-6 ${g.id === "numeros" ? "lg:row-span-2" : ""}`}>
                  <p className="eyebrow">{g.eyebrow}</p>
                  <h3 id={`g-${g.id}`} className="display mt-1 text-2xl font-semibold leading-snug">{g.title}</h3>
                  <p className="mt-1 text-sm text-muted">{g.text}</p>
                  <ul className="mt-4 divide-y divide-line">
                    {g.items.map((f) => (
                      <li key={f.title} className="flex gap-3.5 py-3 first:pt-1 last:pb-0">
                        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-soft text-brand">{f.icon}</span>
                        <span>
                          <b className="block text-[0.9375rem] leading-snug">{f.title}</b>
                          <span className="mt-0.5 block text-sm leading-relaxed text-muted">{f.text}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </section>

        {/* números do governo */}
        <section id="orcamento-e-inflacao" className="mx-auto grid max-w-6xl scroll-mt-20 grid-cols-1 items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="eyebrow">Números do governo</p>
            <h2 className="display mt-2 text-3xl font-semibold leading-tight sm:text-4xl">O orçamento está sendo <em className="font-normal italic text-brand">cumprido?</em></h2>
            <p className="mt-4 text-muted">Veja, área por área, quanto a sua cidade, o estado e a União previram na lei orçamentária, quanto já gastaram e onde o ano deve fechar. Acompanhe a inflação frente à meta, o que o mercado espera e quais preços mais pesam no bolso.</p>
            <ul className="mt-5 space-y-2 text-sm">
              {["Previsto x realizado com projeção do fechamento do ano", "Inflação por pilar, dentro ou fora da meta", "Indicadores, score e retorno do gasto em até 30 anos"].map((t) => (
                <li key={t} className="flex gap-2.5"><span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand" aria-hidden>✓</span>{t}</li>
              ))}
            </ul>
          </div>
          <div>
            <NumbersMock />
            <p className="mt-2 text-xs text-faint">Exemplo ilustrativo, com dados fictícios.</p>
          </div>
        </section>

        {/* representantes + assistente + e-mail */}
        <section className="border-y border-line bg-surface-2/60 py-20">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-14 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Seus representantes</p>
              <h2 className="display mt-2 text-3xl font-semibold leading-tight sm:text-4xl">Saiba <em className="font-normal italic text-brand">quem decide</em> por você.</h2>
              <p className="mt-4 text-muted">Do prefeito ao presidente: partido, mandato, contatos, projetos, gastos e as notícias mais recentes. Siga quem importa e ative alertas para não perder nada.</p>
              <div className="mt-6"><PeopleMock /></div>
              <p className="mt-2 text-xs text-faint">Exemplo ilustrativo, com nomes fictícios.</p>
            </div>
            <div>
              <p className="eyebrow">Pergunte</p>
              <h2 className="display mt-2 text-3xl font-semibold leading-tight sm:text-4xl">Ficou com dúvida? <em className="font-normal italic text-brand">Pergunte.</em></h2>
              <p className="mt-4 text-muted">O assistente explica notícias, votações e números em linguagem simples, citando de onde vem cada dado. Em qualquer gráfico, o botão Perguntar já leva o contexto.</p>
              <div className="mt-6"><AssistantMock /></div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-14">
          <div className="lg:order-2">
            <p className="eyebrow">No seu e-mail e no seu bolso</p>
            <h2 className="display mt-2 text-3xl font-semibold leading-tight sm:text-4xl">A política <em className="font-normal italic text-brand">chega até você.</em></h2>
            <p className="mt-4 text-muted">Resumos diários, semanais ou mensais com o que mexeu com a sua cidade, o estado e o país — incluindo as votações do Congresso. E alertas quando uma palavra-chave ou um político aparece nas notícias.</p>
            <p className="mt-4 text-muted">Feito primeiro para o celular: barra de navegação embaixo, filtros recolhíveis e telas que se explicam sozinhas. Adicione à tela inicial e use como um aplicativo.</p>
          </div>
          <div className="lg:order-1"><EmailMock /></div>
        </section>

        {/* como funciona */}
        <section id="como-funciona" className="scroll-mt-20 border-y border-line bg-surface-2/60 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">Como funciona</p>
              <h2 className="display mt-2 text-3xl font-semibold leading-tight sm:text-5xl">Três passos e <em className="font-normal italic text-brand">pronto.</em></h2>
            </div>
            <ol className="mt-10 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="card flex gap-4 p-5 md:block md:p-6">
                  <span className="display text-4xl font-semibold leading-none text-brand md:text-5xl">{s.n}</span>
                  <span className="block">
                    <h3 className="display text-xl font-semibold md:mt-4">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
                  </span>
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
            <p className="mx-auto mt-5 max-w-xl text-lg opacity-85">Crie sua conta, escolha sua cidade e faça o tour de um minuto. O resto o app te mostra.</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/sign-up" className="btn !bg-white !px-7 !py-3.5 !text-base !text-[#17407f] hover:!bg-white/90">Criar minha conta</Link>
              <Link href="/sign-in" className="btn !border !border-white/40 !px-7 !py-3.5 !text-base !text-white hover:!bg-white/10">Já tenho conta</Link>
            </div>
            <p className="mt-4 text-xs opacity-70">Leva menos de um minuto.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Política · Dados abertos da Câmara dos Deputados, do Senado, do TSE, do IBGE, do Tesouro Nacional e do Banco Central. Conteúdo gerado por IA pode conter imprecisões.</p>
          <div className="flex gap-4">
            <Link href="/sign-in" className="hover:text-ink">Entrar</Link>
            <Link href="/sign-up" className="hover:text-ink">Criar conta</Link>
          </div>
        </div>
      </footer>

      <StickyCta />
    </div>
  );
}
