export type Pillar = "economia" | "costumes" | "seguranca" | "ambiente" | "educacao" | "estilo";
export type Axis = "economia" | "costumes";
export type Seal = "mantem" | "negocia" | "renovacao";
export type Conf = "alta" | "média" | "baixa";

export const PILLARS: { id: Pillar; label: string; hint: string }[] = [
  { id: "economia", label: "Economia", hint: "Estado, impostos, privatização, renda" },
  { id: "costumes", label: "Costumes", hint: "drogas, aborto, identidade" },
  { id: "seguranca", label: "Segurança", hint: "armas e segurança pública" },
  { id: "ambiente", label: "Ambiente", hint: "preservação x desenvolvimento" },
  { id: "educacao", label: "Educação", hint: "modelo de educação" },
  { id: "estilo", label: "Estilo", hint: "como o partido age: alianças e negociação" },
];

export const SEAL_LABEL: Record<Seal, string> = { mantem: "Mantém posição", negocia: "Negocia amplo", renovacao: "Renovação" };

export type Option = { key: "a" | "b" | "c"; text: string };
/** valor de cada opção (a, b, c) em um eixo, com peso; o valor do partido (−1…+1) passa pela mesma regra */
export type AxisRule = { axis: Axis; weight: number; map: "id" | "neg" | "pos" };

export type Question = {
  n: number;
  round: 1 | 2 | 3;
  pillar: Pillar;
  title: string;
  intro?: string;
  options: Option[];
  /** valor de a, b, c no pilar (−1…+1) */
  values: [number, number, number];
  axes: AxisRule[];
};

const E1: AxisRule[] = [{ axis: "economia", weight: 1, map: "id" }];
const C1: AxisRule[] = [{ axis: "costumes", weight: 1, map: "id" }];

export const QUESTIONS: Question[] = [
  { n: 1, round: 1, pillar: "economia", title: "Qual deve ser o papel do Estado na economia?", values: [-1, 0, 1], axes: E1, options: [
    { key: "a", text: "Forte e indutor: investe, planeja e controla setores estratégicos." },
    { key: "b", text: "Equilibrado: regula o mercado e garante serviços básicos." },
    { key: "c", text: "Mínimo: livre mercado, Estado só no essencial." } ] },
  { n: 2, round: 1, pillar: "economia", title: "Sobre impostos e serviços públicos:", values: [-1, 0, 1], axes: E1, options: [
    { key: "a", text: "Mais impostos, mais serviços." },
    { key: "b", text: "Manter a carga, mas simplificar." },
    { key: "c", text: "Reduzir impostos, mesmo que o Estado faça menos." } ] },
  { n: 3, round: 1, pillar: "economia", title: "Privatização de estatais:", values: [-1, 0, 1], axes: E1, options: [
    { key: "a", text: "Contra." }, { key: "b", text: "Depende do caso." }, { key: "c", text: "A favor." } ] },
  { n: 4, round: 1, pillar: "economia", title: "Transferência de renda (ex.: Bolsa Família):", values: [-1, 0, 1], axes: E1, options: [
    { key: "a", text: "Ampliar." },
    { key: "b", text: "Manter, com contrapartidas." },
    { key: "c", text: "Reduzir gradualmente, com foco em emprego e empreendedorismo." } ] },

  { n: 5, round: 2, pillar: "costumes", title: "Drogas:", values: [-1, 0, 1], axes: C1, options: [
    { key: "a", text: "Descriminalizar ou legalizar, com regulação." },
    { key: "b", text: "Descriminalizar só o porte para uso pessoal." },
    { key: "c", text: "Manter a proibição e o rigor atual." } ] },
  { n: 6, round: 2, pillar: "costumes", title: "Aborto:", values: [-1, 0, 1], axes: C1, options: [
    { key: "a", text: "Ampliar o direito." },
    { key: "b", text: "Manter como está (só nos casos previstos em lei)." },
    { key: "c", text: "Restringir mais." } ] },
  { n: 7, round: 2, pillar: "seguranca", title: "Armas:", values: [1, 0, -1], axes: C1, options: [
    { key: "a", text: "Facilitar porte e posse." },
    { key: "b", text: "Manter as regras atuais." },
    { key: "c", text: "Restringir mais." } ] },
  { n: 8, round: 2, pillar: "seguranca", title: "Prioridade em segurança pública:", values: [1, 0, -1], axes: [{ axis: "costumes", weight: 1, map: "id" }, { axis: "economia", weight: 0.5, map: "neg" }], options: [
    { key: "a", text: "Endurecer penas e reforçar a polícia." },
    { key: "b", text: "Inteligência e prevenção." },
    { key: "c", text: "Políticas sociais que atacam as causas." } ] },

  { n: 9, round: 3, pillar: "ambiente", title: "Meio ambiente:", values: [-1, 0, 1], axes: E1, options: [
    { key: "a", text: "Preservação em primeiro, mesmo com custo econômico." },
    { key: "b", text: "Crescer de forma sustentável, com regras claras." },
    { key: "c", text: "Desenvolvimento em primeiro, flexibilizando o licenciamento." } ] },
  { n: 10, round: 3, pillar: "educacao", title: "Educação:", values: [-1, 0, 1], axes: [{ axis: "economia", weight: 0.5, map: "id" }, { axis: "costumes", weight: 0.5, map: "pos" }], options: [
    { key: "a", text: "Ensino público forte, com mais investimento." },
    { key: "b", text: "Gestão e resultados, com metas e parcerias com o setor privado." },
    { key: "c", text: "Mais liberdade de escolha (vouchers, escolas cívico-militares, ensino domiciliar)." } ] },
  { n: 11, round: 3, pillar: "costumes", title: "Pautas de identidade (raça, gênero, LGBT+):", values: [-1, 0, 1], axes: C1, options: [
    { key: "a", text: "Prioridade do Estado, com políticas afirmativas." },
    { key: "b", text: "Igualdade perante a lei, sem políticas por grupo." },
    { key: "c", text: "Valores tradicionais, priorizando família e tradição religiosa." } ] },
  { n: 12, round: 3, pillar: "estilo", title: "Pensando no jeito de fazer política, o que você mais valoriza em um partido?", intro: "Aqui não importa o que o partido defende, e sim como ele age na prática.", values: [0, 0, 0], axes: [], options: [
    { key: "a", text: "Coerência acima de tudo: mantém suas posições mesmo que perca votos ou aliados, e prefere a oposição a ceder." },
    { key: "b", text: "Capacidade de negociar: faz acordos com partidos diferentes para aprovar o que for possível, mesmo abrindo mão de parte do que defende." },
    { key: "c", text: "Renovação: aposta em novos nomes, critica a “velha política” e evita alianças tradicionais." } ] },
];

export const ROUND_TITLE: Record<1 | 2 | 3, string> = {
  1: "Economia e Estado",
  2: "Costumes e segurança",
  3: "Ambiente, educação, identidade e estilo",
};

export const SEAL_BY_OPTION: Record<"a" | "b" | "c", Seal> = { a: "mantem", b: "negocia", c: "renovacao" };

/* ───────── Partidos ───────── */

export type PartyBox = "mixed" | "undefined" | null; // null = a caixa é calculada pelas posições

export type Party = {
  sigla: string;
  nome: string;
  federacao?: string;
  /** valores (−1…+1) que o partido daria às perguntas 1 a 11 (estimativa, ver docs) */
  v: [number, number, number, number, number, number, number, number, number, number, number];
  seal: Seal | null;
  conf: Conf;
  box: PartyBox;
};

export const FEDERATIONS: Record<string, string> = {
  PT: "Brasil da Esperança", PCdoB: "Brasil da Esperança", PV: "Brasil da Esperança",
  PSDB: "PSDB-Cidadania", Cidadania: "PSDB-Cidadania",
  PSOL: "PSOL-Rede", Rede: "PSOL-Rede",
  PRD: "Renovação Solidária", Solidariedade: "Renovação Solidária",
  "União Brasil": "União Progressista", PP: "União Progressista",
};

//        q1    q2    q3    q4    q5    q6    q7    q8    q9    q10   q11
export const PARTIES: Party[] = [
  // Mais Estado × Progressista
  { sigla: "PT", nome: "Partido dos Trabalhadores", v: [-0.8, -0.8, -0.9, -1, -0.4, -0.3, -0.8, -0.6, -0.4, -0.9, -0.9], seal: "negocia", conf: "alta", box: null },
  { sigla: "PSOL", nome: "Partido Socialismo e Liberdade", v: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], seal: "mantem", conf: "alta", box: null },
  { sigla: "PCdoB", nome: "Partido Comunista do Brasil", v: [-1, -0.8, -1, -1, -0.3, -0.4, -0.7, -0.6, -0.5, -0.9, -0.8], seal: "negocia", conf: "alta", box: null },
  { sigla: "UP", nome: "Unidade Popular", v: [-1, -1, -1, -1, -0.8, -1, -1, -1, -1, -1, -1], seal: "mantem", conf: "baixa", box: null },
  { sigla: "PSTU", nome: "Partido Socialista dos Trabalhadores Unificado", v: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], seal: "mantem", conf: "baixa", box: null },
  { sigla: "PCB", nome: "Partido Comunista Brasileiro", v: [-1, -1, -1, -1, -0.8, -0.8, -1, -1, -1, -1, -0.9], seal: "mantem", conf: "baixa", box: null },
  // Equilibrada × Progressista
  { sigla: "PSB", nome: "Partido Socialista Brasileiro", v: [-0.3, -0.2, 0, -0.4, -0.5, -0.4, -0.6, -0.4, -0.5, -0.4, -0.7], seal: "negocia", conf: "média", box: null },
  { sigla: "PV", nome: "Partido Verde", v: [-0.1, 0, 0, -0.2, -0.7, -0.5, -0.6, -0.5, -1, -0.3, -0.7], seal: "negocia", conf: "média", box: null },
  { sigla: "Rede", nome: "Rede Sustentabilidade", v: [-0.1, 0, -0.1, -0.2, -0.6, -0.5, -0.7, -0.5, -1, -0.4, -0.8], seal: "mantem", conf: "média", box: null },
  { sigla: "Cidadania", nome: "Cidadania", v: [0, 0, 0.3, -0.2, -0.6, -0.4, -0.5, -0.2, -0.2, 0, -0.6], seal: "negocia", conf: "média", box: null },
  // Mais Estado × Moderado
  { sigla: "PDT", nome: "Partido Democrático Trabalhista", v: [-0.8, -0.6, -0.8, -0.7, 0, 0, 0, -0.4, -0.4, -0.7, -0.3], seal: "negocia", conf: "média", box: null },
  { sigla: "PCO", nome: "Partido da Causa Operária", v: [-1, -1, -1, -1, 0, -0.3, 0, -0.6, -0.5, -0.9, -0.2], seal: "mantem", conf: "baixa", box: null },
  // Equilibrada × Moderado
  { sigla: "Solidariedade", nome: "Solidariedade", v: [-0.2, -0.1, 0, -0.3, 0, 0, 0, 0, 0, 0, 0], seal: "negocia", conf: "média", box: null },
  { sigla: "PSDB", nome: "Partido da Social Democracia Brasileira", v: [0.3, 0.2, 0.4, 0, -0.2, 0, -0.2, 0, 0, 0.2, 0.1], seal: "negocia", conf: "média", box: null },
  // Mais mercado × Moderado
  { sigla: "Novo", nome: "Partido Novo", v: [1, 1, 1, 0.8, -0.3, 0, 0.5, 0.5, 0.5, 0.8, 0.1], seal: "mantem", conf: "alta", box: null },
  { sigla: "Missão", nome: "Partido Missão", v: [1, 1, 1, 0.8, 0, 0.4, 0.2, 0.3, 0.5, 0.8, 0.3], seal: "renovacao", conf: "baixa", box: null },
  // Equilibrada × Conservador
  { sigla: "PP", nome: "Progressistas", v: [0.2, 0.2, 0.5, 0, 0.8, 0.8, 0.6, 0.7, 0.3, 0.2, 0.7], seal: "negocia", conf: "média", box: null },
  { sigla: "PRD", nome: "Partido Renovação Democrática", v: [0.2, 0.2, 0.4, 0, 0.7, 0.7, 0.5, 0.6, 0.3, 0.3, 0.6], seal: "negocia", conf: "baixa", box: null },
  { sigla: "Republicanos", nome: "Republicanos", v: [0.2, 0.3, 0.4, 0, 0.9, 0.9, 0.6, 0.8, 0.3, 0.3, 0.9], seal: "negocia", conf: "média", box: null },
  { sigla: "DC", nome: "Democracia Cristã", v: [0.1, 0.2, 0.3, 0, 0.9, 1, 0.4, 0.6, 0.2, 0.2, 1], seal: "negocia", conf: "baixa", box: null },
  // Mais mercado × Conservador
  { sigla: "PL", nome: "Partido Liberal", v: [0.8, 0.8, 0.9, 0.4, 0.9, 0.9, 1, 1, 0.8, 0.9, 0.9], seal: "mantem", conf: "alta", box: null },
  { sigla: "PRTB", nome: "Partido Renovador Trabalhista Brasileiro", v: [0.8, 0.8, 0.9, 0.6, 0.9, 0.9, 1, 1, 0.8, 0.9, 0.9], seal: "mantem", conf: "baixa", box: null },
  { sigla: "Agir", nome: "Agir", v: [0.7, 0.6, 0.7, 0.3, 0.7, 0.8, 0.7, 0.8, 0.6, 0.6, 0.8], seal: null, conf: "baixa", box: null },
  // Sem caixa única (heterogêneos)
  { sigla: "MDB", nome: "Movimento Democrático Brasileiro", v: [0.1, 0.1, 0.3, 0, 0.2, 0.3, 0.2, 0.2, 0.1, 0.1, 0.2], seal: "negocia", conf: "média", box: "mixed" },
  { sigla: "PSD", nome: "Partido Social Democrático", v: [0.2, 0.2, 0.3, 0, 0.2, 0.3, 0.2, 0.2, 0.2, 0.1, 0.2], seal: "negocia", conf: "média", box: "mixed" },
  { sigla: "União Brasil", nome: "União Brasil", v: [0.3, 0.3, 0.5, 0.1, 0.4, 0.5, 0.4, 0.5, 0.3, 0.3, 0.4], seal: "negocia", conf: "média", box: "mixed" },
  { sigla: "Podemos", nome: "Podemos", v: [0.1, 0.2, 0.3, 0, 0.2, 0.3, 0.3, 0.4, 0.1, 0.2, 0.2], seal: "negocia", conf: "baixa", box: "mixed" },
  { sigla: "Avante", nome: "Avante", v: [0, 0, 0.2, -0.1, 0.2, 0.3, 0.1, 0.2, 0, 0, 0.2], seal: "negocia", conf: "baixa", box: "mixed" },
  // Perfil pouco definido
  { sigla: "Mobiliza", nome: "Mobiliza", v: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], seal: null, conf: "baixa", box: "undefined" },
  { sigla: "PMB", nome: "Partido da Mulher Brasileira", v: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], seal: null, conf: "baixa", box: "undefined" },
].map((p) => ({ ...p, federacao: FEDERATIONS[p.sigla] })) as Party[];
