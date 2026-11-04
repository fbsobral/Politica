/* Conteúdo dos tours de boas-vindas: um geral e um por módulo. Só dados (usado no cliente). */

export type TourLink = { href: string; label: string };
export type TourStep = {
  title: string;
  text: string;
  /** dicas curtas, em lista */
  tips?: string[];
  /** atalhos para outras telas (fecham o tour) */
  links?: TourLink[];
  /** ícone/arte do passo (chave em ART, no componente) */
  art?: string;
  /** miniatura da tela (chave em SCREENS); sem ela, aparece o ícone */
  screen?: string;
};
export type Tour = { id: string; name: string; match: (path: string) => boolean; steps: TourStep[] };

const at = (prefix: string) => (p: string) => p === prefix || p.startsWith(`${prefix}/`) || p.startsWith(`${prefix}?`);

export function generalTour(city: string): Tour {
  return {
    id: "geral",
    name: "Boas-vindas",
    match: () => false,
    steps: [
      {
        screen: "welcome", art: "logo",
        title: `Bem-vindo! Tudo pronto para ${city}.`,
        text: "Aqui você acompanha a política da sua cidade, do seu estado e do país num só lugar: notícias, quem te representa, votações, eleições e os números do governo.",
        tips: ["Leva 1 minuto. Você pode pular e rever quando quiser pelo botão ? no topo."],
      },
      {
        screen: "feed", art: "feed",
        title: "Seu feed de notícias",
        text: "O robô coleta notícias de dezenas de veículos a cada hora e separa por esfera: Municipal, Estadual e Federal.",
        tips: ["Filtre por poder (Legislativo, Executivo, Judiciário), assunto e veículo", "Toque numa notícia para ler um resumo em 3 parágrafos", "Salve com a estrela para ler depois"],
        links: [{ href: "/", label: "Feed" }],
      },
      {
        screen: "people", art: "people",
        title: "Quem é quem",
        text: "Do prefeito ao presidente: partido, mandato, projetos, gastos e as notícias que citam cada um. Siga quem importa para você.",
        tips: ["Partidos: notícias, perfil e eleitos de cada um", "Você: responda o quiz e descubra os partidos mais próximos das suas ideias"],
        links: [{ href: "/representantes", label: "Representantes" }, { href: "/partidos", label: "Partidos" }, { href: "/perfil", label: "Você" }],
      },
      {
        screen: "agenda", art: "calendar",
        title: "Acompanhe o que acontece",
        text: "Sessões e votações do Congresso explicadas em linguagem simples, eleições, checagem de boatos e o Diário Oficial da sua cidade.",
        links: [{ href: "/agenda", label: "Agenda" }, { href: "/eleicoes", label: "Eleições" }, { href: "/checagens", label: "Checagens" }, { href: "/diario-oficial", label: "Diário Oficial" }],
      },
      {
        screen: "numbers", art: "chart",
        title: "Os números do governo",
        text: "Veja para onde vai o dinheiro público, se o orçamento do ano está sendo cumprido, como está a inflação e se os indicadores melhoraram.",
        tips: ["Orçamento e Expectativa fiscal: receitas, gastos e a LOA", "Inflação: IPCA, expectativas e pilares frente à meta", "Indicadores, Score e ROI: resultados em até 30 anos"],
        links: [{ href: "/orcamento", label: "Orçamento" }, { href: "/expectativa-fiscal", label: "Expectativa fiscal" }, { href: "/inflacao", label: "Inflação" }, { href: "/indicadores", label: "Indicadores" }, { href: "/score", label: "Score" }, { href: "/roi", label: "ROI" }],
      },
      {
        screen: "chat", art: "ask",
        title: "Pergunte quando tiver dúvida",
        text: "O assistente responde sobre política e sobre os números que você está vendo. O botão Perguntar ao lado de cada gráfico já envia o contexto.",
        tips: ["O botão do assistente fica no canto da tela, em qualquer página"],
        links: [{ href: "/conversar", label: "Abrir o assistente" }],
      },
      {
        screen: "alerts", art: "bell",
        title: "Não perca nada",
        text: "Crie alertas por palavra-chave ou por político e escolha receber resumos por e-mail: diário, semanal ou mensal.",
        tips: ["No celular, use a barra de baixo; os módulos de números e a sua conta ficam em Mais", "Cada tela tem um tour próprio: toque em ? no topo para rever"],
        links: [{ href: "/alertas", label: "Criar alerta" }, { href: "/configuracoes", label: "E-mails e conta" }],
      },
    ],
  };
}

export const MODULE_TOURS: Tour[] = [
  {
    id: "feed",
    name: "Feed",
    match: (p) => p === "/",
    steps: [
      { screen: "feed-tabs", art: "feed", title: "Notícias por esfera", text: "As abas Municipal, Estadual e Federal mostram a política de cada nível de governo. Todas junta tudo, da mais recente para a mais antiga.", tips: ["A data no topo mostra quando o robô coletou notícias pela última vez"] },
      { screen: "feed-filters", art: "filter", title: "Filtre do seu jeito", text: "Escolha o poder (Legislativo, Executivo, Judiciário), busque por palavra, filtre por assunto, veículo e nível do veículo.", tips: ["No celular os filtros ficam recolhidos no botão Filtros", "O nível (tier) indica o alcance do veículo, não a qualidade"] },
      { screen: "feed-summary", art: "star", title: "Leia o essencial", text: "Toque numa notícia para abrir um resumo em 3 parágrafos, feito por IA a partir do texto publicado, com link para a matéria completa.", tips: ["A estrela guarda a notícia em Favoritos"] },
    ],
  },
  {
    id: "representantes",
    name: "Representantes",
    match: at("/representantes"),
    steps: [
      { screen: "people-list", art: "people", title: "Quem te representa", text: "Prefeito, vereadores, governador, deputados, senadores e presidente, separados por esfera. A aba Seguindo junta quem você segue.", tips: ["Use a busca para achar alguém pelo nome ou partido"] },
      { screen: "people-profile", art: "doc", title: "Tudo sobre cada político", text: "Abra um perfil para ver partido, mandato, contatos e as notícias que citam a pessoa. Deputados federais e senadores também mostram projetos de autoria e gastos." },
      { screen: "people-follow", art: "bell", title: "Siga e receba alertas", text: "Siga para encontrar rápido na aba Seguindo. Ative Receber alertas no perfil para ganhar um e-mail quando a pessoa aparecer nas notícias." },
    ],
  },
  {
    id: "partidos",
    name: "Partidos",
    match: at("/partidos"),
    steps: [{ screen: "party", art: "flag", title: "Cada partido em uma página", text: "Notícias recentes, perfil, posições e os eleitos de cada partido. Compare as legendas e veja quem as representa na sua cidade, no estado e no Congresso." }],
  },
  {
    id: "perfil",
    name: "Você",
    match: at("/perfil"),
    steps: [
      { screen: "quiz", art: "compass", title: "Seu perfil político", text: "Responda perguntas sobre economia, costumes e o papel do Estado. Ao final você vê onde está no mapa político e quais partidos pensam mais parecido com você.", tips: ["Dá para dar mais peso aos temas que importam para você", "Refaça quando quiser; as respostas ficam só na sua conta"] },
    ],
  },
  {
    id: "agenda",
    name: "Agenda",
    match: at("/agenda"),
    steps: [
      { screen: "agenda", art: "calendar", title: "O que o Congresso vai discutir", text: "Na aba Federal aparecem as sessões e reuniões da Câmara e do Senado dos próximos 10 dias e as votações recentes, com o resultado." },
      { screen: "agenda-explain", art: "ask", title: "Entenda o que estava em jogo", text: "Toque em Saiba mais num evento ou votação para ler uma explicação em linguagem simples.", tips: ["Nas abas Estadual e Municipal, a agenda vem da imprensa local, porque não há agenda oficial aberta"] },
    ],
  },
  {
    id: "eleicoes",
    name: "Eleições",
    match: at("/eleicoes"),
    steps: [
      { screen: "elections", art: "vote", title: "Eleições sem ruído", text: "Escolha o cargo nas abas: presidente, governador, senado ou deputados do seu estado. Cada cargo traz candidatos, pesquisas, notícias e checagens.", tips: ["Os candidatos vêm dos dados abertos do TSE, atualizados a cada 6 horas"] },
    ],
  },
  {
    id: "checagens",
    name: "Checagens",
    match: at("/checagens"),
    steps: [{ screen: "factcheck", art: "shield", title: "Boatos verificados", text: "Checagens de agências independentes e da imprensa, por esfera: do país, do seu estado e da sua cidade. Toque para ler a conclusão e a fonte." }],
  },
  {
    id: "diario-oficial",
    name: "Diário Oficial",
    match: at("/diario-oficial"),
    steps: [{ screen: "gazette", art: "doc", title: "O Diário Oficial da sua cidade", text: "Edições recentes publicadas pela prefeitura, com trechos. Use a busca para encontrar nomeações, licitações, decretos ou o nome de uma rua ou empresa." }],
  },
  {
    id: "alertas",
    name: "Alertas",
    match: at("/alertas"),
    steps: [{ screen: "alerts", art: "bell", title: "Avisos no seu e-mail", text: "Crie um alerta com uma palavra-chave (por exemplo, o nome do seu bairro) e receba um e-mail quando ela aparecer numa notícia.", tips: ["Pause ou exclua quando quiser", "Alertas de políticos se ativam na página de cada um"] }],
  },
  {
    id: "favoritos",
    name: "Favoritos",
    match: at("/favoritos"),
    steps: [{ screen: "favorites", art: "star", title: "Leia depois", text: "As notícias que você marca com a estrela ficam guardadas aqui." }],
  },
  {
    id: "orcamento",
    name: "Orçamento",
    match: at("/orcamento"),
    steps: [
      { screen: "budget-kpis", art: "coins", title: "Para onde vai o dinheiro", text: "Receitas e despesas da sua cidade, do estado e da União, como declaradas ao Tesouro Nacional. Troque a esfera nas abas do topo; Todas compara as três.", tips: ["Os resumos mostram despesa, receita e gasto por habitante do último ano fechado"] },
      { screen: "budget-line", art: "chart", title: "Evolução em 10 anos", text: "No gráfico, escolha o que mostrar, o período e a categoria. Veja em R$, por habitante ou em % do total, com ou sem correção pela inflação.", tips: ["O ano corrente pode entrar parcial ou projetado"] },
      { screen: "budget-bars", art: "list", title: "Categorias e subcategorias", text: "De onde vem e para onde vai o dinheiro, por área. Toque em ver subcategorias para detalhar e em O que é isso? para entender cada termo." },
    ],
  },
  {
    id: "expectativa-fiscal",
    name: "Expectativa fiscal",
    match: at("/expectativa-fiscal"),
    steps: [
      { screen: "fiscal-cards", art: "target", title: "A LOA está sendo cumprida?", text: "A lei orçamentária (LOA) diz quanto se espera arrecadar e quanto se pode gastar no ano. Aqui comparamos o realizado até agora com essas metas.", tips: ["Os dados vêm do relatório que o governo envia ao Tesouro a cada dois meses"] },
      { screen: "fiscal-proj", art: "chart", title: "Projeção do fechamento", text: "Os cartões mostram onde receita e despesa devem fechar o ano. Segue a LOA quer dizer ficar a até 5% do previsto.", tips: ["A projeção usa o ritmo do mesmo período do ano passado (há meses que arrecadam mais, como os do IPTU)"] },
      { screen: "fiscal-bars", art: "list", title: "Cada área frente à LOA", text: "Barra clara: previsto. Barra cheia: realizado. Círculo: projeção do fim do ano. Toque numa área para ver as subáreas.", tips: ["Troque entre empenhado, liquidado e pago", "Ordene por maior desvio para achar o que foge do planejado"] },
    ],
  },
  {
    id: "inflacao",
    name: "Inflação",
    match: at("/inflacao"),
    steps: [
      { screen: "infl-meta", art: "target", title: "Inflação x meta", text: "O IPCA em 12 meses comparado com a meta do governo (3% com tolerância de 1,5 ponto). A faixa verde no gráfico é o intervalo aceito.", tips: ["Desde 2025, ficar 6 meses seguidos fora da faixa conta como descumprimento"] },
      { screen: "infl-focus", art: "chart", title: "O que o mercado espera", text: "Os círculos à direita do gráfico mostram a expectativa do boletim Focus para o fim de cada ano, com a menor e a maior projeção." },
      { screen: "infl-pillars", art: "list", title: "Os pilares da inflação", text: "Veja o que puxa os preços: grupos do IPCA (alimentação, transporte…), tipos de preço e núcleos. Toque num grupo para ver seus itens.", tips: ["Sem meta oficial para os pilares, a comparação usa o padrão internacional de 2%; você pode trocar para a meta do Brasil"] },
    ],
  },
  {
    id: "indicadores",
    name: "Indicadores",
    match: at("/indicadores"),
    steps: [
      { screen: "indicator", art: "chart", title: "Os números da sua realidade", text: "Economia, dívida, segurança, pobreza, saúde e mais, para o país, o estado e a cidade, em até 30 anos.", tips: ["Escolha o período: 5, 10, 20 ou 30 anos", "Cada indicador mostra a fonte oficial e, quando existe, uma meta de referência"] },
    ],
  },
  {
    id: "score",
    name: "Score dos governos",
    match: at("/score"),
    steps: [
      { screen: "score", art: "target", title: "Uma nota para cada ano", text: "De 0 a 100, metade economia e metade indicadores sociais. Compare governos e veja os anos de melhora e de piora." },
      { screen: "score-editor", art: "list", title: "Você escolhe a régua", text: "Personalize quais indicadores entram na nota. Veja a fonte de cada número ano a ano e baixe tudo em CSV." },
    ],
  },
  {
    id: "roi",
    name: "ROI do orçamento",
    match: at("/roi"),
    steps: [{ screen: "roi", art: "coins", title: "O gasto deu resultado?", text: "Compare quanto se gastou numa área (saúde, educação, segurança…) com a evolução dos indicadores dessa área ao longo dos anos.", tips: ["Escolha a área de gasto e o indicador para comparar", "Correlação não é causa: use como ponto de partida para perguntas"] }],
  },
  {
    id: "conversar",
    name: "Pergunte",
    match: at("/conversar"),
    steps: [{ screen: "chat", art: "ask", title: "Converse sobre política", text: "Pergunte sobre notícias, políticos, votações e os números do app. O assistente responde em linguagem simples e indica as fontes.", tips: ["Use as sugestões para começar", "Confira informações importantes nas fontes indicadas"] }],
  },
];

export const findModuleTour = (path: string): Tour | null => MODULE_TOURS.find((t) => t.match(path)) ?? null;
