import { getBudgetHistory, UF_CODE, type BudgetHistory, type BudgetScope } from "@/lib/budget";
import { db } from "@/lib/db";
import { ibgeIdFor } from "@/lib/ibge";
import { getSeries, INDICATORS, type Indicator } from "@/lib/indicators/catalog";
import type { Geo, Scope, YearSeries } from "@/lib/indicators/core";
import type { Unit } from "@/lib/indicators/format";
import { TARGETS } from "@/lib/indicators/targets";
import { UFS } from "@/lib/taxonomy";

/*
 * Pilares: o governo dividido por área de resultado (saúde, educação, saneamento…), cada uma com uma árvore de
 * métricas e submétricas, o nosso resultado, a meta e — sempre documentado — de onde a meta vem:
 * referência internacional, meta brasileira (lei ou plano), ideal declarado, ou projeção quando não há meta
 * (o melhor estado do país, uma "vitória isolada" que mostra o que é possível, ou o melhor resultado já alcançado aqui).
 */

import { BASIS, type Basis } from "@/lib/pillar-basis";

export { BASIS, type Basis };

/** De onde vem cada meta do arquivo de metas (TARGETS): classificação explícita, conferida à mão. */
const TARGET_BASIS: Record<string, Basis> = {
  "mortalidade-5": "internacional", "mortalidade-neonatal": "internacional", "mortalidade-materna": "internacional", "mortalidade-infantil": "internacional",
  homicidios: "internacional", suicidio: "internacional", transito: "internacional", desemprego: "internacional", subutilizacao: "internacional", informalidade: "internacional",
  ipca: "brasil", "divida-bruta": "internacional", "divida-liquida": "internacional", "divida-liquida-gg": "internacional", "deficit-primario": "ideal", "deficit-nominal": "internacional",
  "pib-cresc": "internacional", gini: "internacional", analfabetismo: "internacional", "analfabetismo-censo": "internacional", "pobreza-int": "internacional", pobreza: "internacional", "pobreza-ocupados": "internacional",
  "nem-nem": "internacional", inadimplencia: "internacional", "inadimplencia-total": "internacional", previdencia: "ideal", "dcl-rcl": "brasil", "pessoal-rcl": "brasil", reservas: "internacional",
  comprometimento: "internacional", endividamento: "internacional", "endividamento-sem-habitacao": "internacional", "renda-trabalho": "brasil", desalento: "ideal",
  "agua-rede": "brasil", "esgoto-rede": "brasil", "sem-banheiro": "internacional", "lixo-coletado": "ideal",
  creche: "brasil", "pre-escola": "brasil", "escola-15-17": "brasil", "mortalidade-cronicas": "internacional", "agua-segura": "brasil", energia: "internacional",
  "moradia-precaria": "internacional", "inseguranca-grave": "internacional", "inseguranca-alimentar": "internacional", "trabalho-infantil": "internacional",
};

/** Metas próprias do pilar para indicadores que não têm meta no score. */
const EXTRA_TARGETS: Record<string, { value: number; basis: Basis; ref: string; url?: string; approx?: boolean }> = {
  "salario-minimo": { value: 7107, basis: "brasil", ref: "Salário mínimo necessário calculado pelo DIEESE (R$ 7.107 em dez/2025, família de 4 pessoas), a referência do art. 7º, IV, da Constituição (moradia, alimentação, educação, saúde, lazer, vestuário, higiene, transporte e previdência)", url: "https://www.dieese.org.br/analisecestabasica/salarioMinimo.html" },
};

/** Métricas calculadas a partir de duas séries (numerador ÷ denominador × 100). */
const DERIVED: Record<string, { name: string; num: string; den: string; better: "up" | "down"; desc: string; source: string }> = {
  "investimento-pct": { name: "Investimento (% da despesa)", num: "gasto-investimento", den: "despesa-total", better: "up", desc: "Quanto da despesa total vai para obras, equipamentos e outros investimentos, que ampliam os serviços no futuro.", source: "Tesouro Nacional (Siconfi, balanço anual)" },
  "juros-pct": { name: "Juros da dívida (% da despesa)", num: "gasto-juros", den: "despesa-total", better: "down", desc: "Quanto da despesa total vai para juros e encargos da dívida, dinheiro que não vira serviço público.", source: "Tesouro Nacional (Siconfi, balanço anual)" },
};

type Node = { id: string; children?: Node[] };
export type Gap = { name: string; target: string; basis: Basis | null; why: string; source: string; url?: string };

export type PillarDef = {
  id: string;
  name: string;
  icon: string;
  /** a pergunta que o pilar responde */
  question: string;
  /** por que importa mais para quem tem menos (mesma lente do Diagnóstico) */
  lens: string;
  /** funções do orçamento que financiam o pilar (nomes normalizados, como no Diagnóstico) */
  areas: string[];
  tree: Node[];
  /** métricas importantes que ainda não temos em dado aberto no app, com a meta de referência */
  gaps: Gap[];
};

const n = (id: string, ...children: string[]): Node => ({ id, children: children.map((c) => ({ id: c })) });

export const PILLARS: PillarDef[] = [
  {
    id: "saude", name: "Saúde", icon: "🩺", areas: ["saude"],
    question: "As pessoas estão vivendo mais e morrendo menos de causas evitáveis?",
    lens: "Cerca de 7 em cada 10 brasileiros dependem só do SUS; mortes de bebês e de mães se concentram nas famílias pobres.",
    tree: [n("mortalidade-5", "mortalidade-neonatal"), n("mortalidade-infantil", "mortalidade-neonatal"), n("mortalidade-materna"), n("gravidez-adolescente"), n("mortalidade-cronicas"), n("suicidio")],
    gaps: [
      { name: "Cobertura vacinal infantil", target: "95% das crianças", basis: "internacional", why: "Abaixo disso doenças eliminadas, como o sarampo, voltam.", source: "Ministério da Saúde (PNI) e OMS", url: "https://sipni.datasus.gov.br" },
      { name: "Cobertura da atenção primária", target: "100% da população", basis: "ideal", why: "A porta de entrada do SUS resolve a maior parte dos problemas de saúde perto de casa.", source: "Ministério da Saúde (e-Gestor AB)", url: "https://egestorab.saude.gov.br" },
      { name: "Expectativa de vida ao nascer", target: "~81 anos (média da OCDE)", basis: "internacional", why: "Resume, num número, as condições de vida e de saúde.", source: "IBGE (Tábuas de mortalidade) e OCDE" },
      { name: "Internações por condições sensíveis à atenção primária", target: "Sem número fixado", basis: null, why: "Internações que um posto de saúde funcionando teria evitado.", source: "Ministério da Saúde (SIH/DATASUS)" },
    ],
  },
  {
    id: "educacao", name: "Educação", icon: "📚", areas: ["educacao"],
    question: "Todo mundo aprende a ler e os jovens estão estudando ou trabalhando?",
    lens: "8 em cada 10 alunos estão na escola pública; creche e ensino básico pesam mais para as famílias pobres.",
    tree: [n("creche"), n("pre-escola"), n("escola-15-17"), n("conclusao-medio", "conclusao-fund"), n("analfabetismo"), n("analfabetismo-censo"), n("nem-nem")],
    gaps: [
      { name: "IDEB dos anos iniciais", target: "6,0", basis: "brasil", why: "Mede aprendizagem e aprovação juntas; o número é a meta do Plano Nacional de Educação.", source: "INEP (IDEB) e PNE 2014–2024, meta 7", url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb" },
      { name: "Alunos em tempo integral", target: "25% dos alunos (50% das escolas)", basis: "brasil", why: "Mais tempo na escola, com alimentação e proteção.", source: "PNE 2014–2024, meta 6", url: "https://pne.mec.gov.br" },
      { name: "Alunos com aprendizagem adequada em português e matemática", target: "Sem número único no PNE (o IDEB é a meta)", basis: null, why: "Estar na escola não basta: mede se o aluno está aprendendo.", source: "INEP (SAEB)" },
    ],
  },
  {
    id: "saneamento", name: "Saneamento básico", icon: "🚰", areas: ["saneamento"],
    question: "As casas têm água encanada, esgoto e coleta de lixo?",
    lens: "A falta de água e de esgoto se concentra nos bairros pobres e causa doenças e mortes de crianças.",
    tree: [n("agua-rede", "agua-segura"), n("esgoto-rede", "sem-banheiro"), n("lixo-coletado"), n("mortes-saneamento")],
    gaps: [
      { name: "Esgoto coletado que é tratado", target: "90% coletado e tratado até 2033", basis: "brasil", why: "Esgoto coletado e jogado sem tratamento no rio continua causando doença.", source: "Marco Legal do Saneamento (Lei 14.026/2020) e SINISA", url: "https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa" },
      { name: "Perdas de água na distribuição", target: "Redução progressiva (sem número único)", basis: "brasil", why: "Cerca de um terço da água tratada se perde em vazamentos e ligações irregulares.", source: "SINISA (antigo SNIS)" },
      { name: "Internações por doenças ligadas à falta de saneamento", target: "Sem número fixado", basis: null, why: "Diarreia, hepatite A e outras doenças evitáveis com água e esgoto (as mortes já estão acima).", source: "Ministério da Saúde (SIH/DATASUS)" },
    ],
  },
  {
    id: "seguranca", name: "Segurança", icon: "🛡", areas: ["seguranca publica"],
    question: "As pessoas estão protegidas da violência?",
    lens: "A violência letal atinge mais os bairros periféricos e os jovens negros.",
    tree: [n("homicidios", "homicidios-n")],
    gaps: [
      { name: "Homicídios esclarecidos", target: "Sem número oficial (em países da Europa passa de 80%)", basis: null, why: "Sem esclarecer os crimes, a impunidade alimenta mais violência.", source: "Instituto Sou da Paz (Onde Mora a Impunidade)" },
      { name: "Mortes por intervenção policial", target: "Sem número fixado", basis: null, why: "Mede a letalidade do próprio Estado, concentrada em jovens negros da periferia.", source: "Fórum Brasileiro de Segurança Pública (Anuário)" },
      { name: "Feminicídios por 100 mil mulheres", target: "Zero (ideal)", basis: "ideal", why: "Violência de gênero que costuma ser anunciada e evitável.", source: "Fórum Brasileiro de Segurança Pública (Anuário)" },
    ],
  },
  {
    id: "mobilidade", name: "Mobilidade e trânsito", icon: "🚌", areas: ["transporte", "urbanismo"],
    question: "Dá para se deslocar com segurança e sem perder horas no caminho?",
    lens: "O transporte público é o meio de quem tem menos renda e mora mais longe do trabalho.",
    tree: [n("transito"), n("deslocamento-1h")],
    gaps: [
      { name: "População perto de transporte de média e alta capacidade", target: "Sem número fixado", basis: null, why: "Metrô, trem e corredores de ônibus encurtam a distância até as oportunidades.", source: "ITDP Brasil (indicador PNT)" },
      { name: "Mortes no trânsito pela metade até 2030", target: "−50% em relação a 2020", basis: "internacional", why: "Meta da Década de Ação pela Segurança no Trânsito (ONU) e do Pnatrans brasileiro.", source: "ONU (Resolução A/RES/74/299) e Lei 13.614/2018" },
    ],
  },
  {
    id: "social", name: "Pobreza e desigualdade", icon: "🤝", areas: ["assistencia social", "direitos da cidadania"],
    question: "Menos gente vive na pobreza e a renda está menos concentrada?",
    lens: "É o pilar que mede diretamente a vida de quem está na base da pirâmide.",
    tree: [n("pobreza", "pobreza-int"), n("inseguranca-grave", "inseguranca-alimentar"), n("gini")],
    gaps: [
      { name: "Insegurança alimentar por estado e cidade", target: "Zero até 2030 (Fome Zero)", basis: "internacional", why: "O IBGE publica a fome por estado só em tabelas avulsas; aqui ela aparece para o país.", source: "IBGE (PNAD, Escala Brasileira de Insegurança Alimentar) e ODS 2.1" },
      { name: "Crianças na pobreza", target: "Metade de 2015 até 2030", basis: "internacional", why: "A pobreza na infância deixa marcas para a vida toda.", source: "IBGE (Síntese de Indicadores Sociais) e ODS 1.2" },
      { name: "Famílias pobres do CadÚnico atendidas", target: "100% das elegíveis", basis: "ideal", why: "Mostra se a rede de proteção chega a quem tem direito.", source: "Ministério do Desenvolvimento Social (CadÚnico)" },
    ],
  },
  {
    id: "trabalho", name: "Trabalho e renda", icon: "💼", areas: ["trabalho"],
    question: "Há trabalho, com direitos, e a renda dá para viver?",
    lens: "Para quem não tem patrimônio, o trabalho é a única fonte de renda.",
    tree: [n("desemprego", "subutilizacao", "desalento"), n("informalidade", "previdencia"), n("renda-trabalho", "pobreza-ocupados"), n("salario-minimo"), n("salario-medio", "pessoal-ocupado"), n("trabalho-infantil")],
    gaps: [
      { name: "Diferença de renda entre homens e mulheres, negros e brancos", target: "Igualdade (ideal)", basis: "ideal", why: "Mostra quem fica para trás pelo mesmo trabalho.", source: "IBGE (PNAD Contínua) e Lei 14.611/2023 (igualdade salarial)" },
      { name: "Acidentes de trabalho graves e mortes", target: "Sem número fixado", basis: null, why: "Quem mais se acidenta são os trabalhadores com menos proteção.", source: "Observatório de Segurança e Saúde no Trabalho (MPT/OIT)" },
    ],
  },
  {
    id: "moradia", name: "Moradia", icon: "🏠", areas: ["habitacao"],
    question: "As famílias moram em casas adequadas e que cabem no bolso?",
    lens: "Moradia precária e o peso do aluguel atingem sobretudo as famílias de baixa renda.",
    tree: [n("moradia-precaria"), n("energia")],
    gaps: [
      { name: "Déficit habitacional", target: "Redução contínua (sem número oficial atual)", basis: null, why: "Famílias em moradia precária, coabitação forçada ou aluguel que come a renda.", source: "Fundação João Pinheiro (Déficit Habitacional no Brasil)", url: "https://fjp.mg.gov.br/deficit-habitacional-no-brasil/" },
      { name: "Famílias que gastam mais de 30% da renda com aluguel", target: "Até 30% da renda é a régua de acessibilidade", basis: "internacional", why: "Acima disso falta dinheiro para comida, transporte e saúde.", source: "ONU-Habitat e Fundação João Pinheiro (ônus excessivo com aluguel)" },
      { name: "Moradia precária na cidade", target: "Moradia adequada a todos até 2030", basis: "internacional", why: "O indicador de moradia precária (ODS 11.1) só sai para país e estados; nas cidades, o Censo publica as favelas em tabelas por comunidade.", source: "IBGE (Censo 2022) e ODS 11.1" },
    ],
  },
  {
    id: "economia", name: "Economia", icon: "📈", areas: [],
    question: "A economia cresce com preços estáveis?",
    lens: "Inflação alta corrói primeiro a renda de quem não tem como se proteger; crescimento gera empregos.",
    tree: [n("pib-cresc", "pib-pc"), n("ipca"), n("reservas")],
    gaps: [
      { name: "Crescimento do PIB do estado ou da cidade", target: "Sem meta (os dados do IBGE chegam com 2 anos de atraso)", basis: null, why: "O PIB regional existe, mas em reais correntes; o crescimento real só sai com atraso.", source: "IBGE (Contas Regionais e PIB dos Municípios)" },
    ],
  },
  {
    id: "contas", name: "Contas públicas", icon: "🏛", areas: [],
    question: "O governo tem dinheiro para os serviços sem se afundar em dívida?",
    lens: "Dívida cara tira dinheiro dos serviços; ajustes mal feitos costumam cortar primeiro o gasto social.",
    tree: [n("divida-bruta", "divida-liquida", "divida-liquida-gg"), n("deficit-primario", "deficit-nominal"), n("dcl-rcl"), n("pessoal-rcl"), n("investimento-pct"), n("juros-pct")],
    gaps: [
      { name: "Benefícios fiscais (renúncias de receita)", target: "Sem número fixado (a EC 109/2021 manda reduzir a 2% do PIB)", basis: "brasil", why: "Dinheiro que o governo deixa de arrecadar, muitas vezes de quem tem mais.", source: "Receita Federal (Demonstrativo dos Gastos Tributários)" },
    ],
  },
  {
    id: "familias", name: "Finanças das famílias", icon: "💳", areas: [],
    question: "As famílias conseguem pagar as contas sem se endividar demais?",
    lens: "Juros altos e crédito caro pesam mais em quem já tem a renda apertada.",
    tree: [n("endividamento", "endividamento-sem-habitacao", "comprometimento"), n("inadimplencia", "inadimplencia-total")],
    gaps: [],
  },
  {
    id: "ambiente", name: "Meio ambiente e clima", icon: "🌳", areas: ["gestao ambiental"],
    question: "Estamos protegendo florestas, ar e água para as próximas gerações?",
    lens: "Enchentes, secas e calor extremo atingem primeiro quem mora em áreas de risco.",
    tree: [],
    gaps: [
      { name: "Desmatamento na Amazônia", target: "Desmatamento zero até 2030", basis: "brasil", why: "Compromisso do Brasil; a floresta regula as chuvas de que depende o país.", source: "INPE (PRODES) e Plano de Ação para Prevenção e Controle do Desmatamento", url: "https://terrabrasilis.dpi.inpe.br" },
      { name: "Emissões de gases de efeito estufa", target: "−59% a −67% até 2035 em relação a 2005", basis: "brasil", why: "Meta brasileira no Acordo de Paris (NDC de 2024).", source: "SEEG (Observatório do Clima) e NDC do Brasil" },
      { name: "Qualidade do ar (partículas finas, PM2,5)", target: "5 µg/m³ por ano", basis: "internacional", why: "Poluição do ar mata mais nas periferias perto de vias e indústrias.", source: "OMS (diretrizes de qualidade do ar, 2021)" },
      { name: "Moradores em áreas de risco de enchente e deslizamento", target: "Sem número fixado", basis: null, why: "Quem mora em área de risco é quem não teve outra opção.", source: "CEMADEN e IBGE (População em áreas de risco)" },
    ],
  },
];

/* ───────── cálculo ───────── */

export type Status = "ok" | "perto" | "longe" | "sem-meta" | "contexto";
export type Ref = { label: string; value: number; basis: Basis; text: string; url?: string; approx?: boolean };

export type MetricResult = {
  id: string;
  name: string;
  unit: Unit;
  decimals: number;
  desc: string;
  source: string;
  sourceUrl?: string;
  better?: "up" | "down";
  /** esfera de onde veio o dado (pode ser o estado quando a cidade não tem série) */
  level: Scope;
  year: number;
  value: number;
  series: YearSeries;
  target: Ref | null;
  /** referências adicionais (melhor estado, melhor histórico) quando a meta principal é outra */
  refs: Ref[];
  status: Status;
  /** comparação com ~5 anos antes */
  trend: { year: number; value: number; dir: "melhor" | "pior" | "estavel" } | null;
  children: MetricResult[];
};

export type Spend = { year: number; value: number; perCapita: number | null; share: number; realChange5y: number | null };

export type PillarResult = Omit<PillarDef, "tree"> & {
  metrics: MetricResult[];
  counts: { ok: number; perto: number; longe: number; semMeta: number };
  spend: Spend | null;
  /** sem métricas nesta esfera, mas há métricas para o país (aba Federal) */
  nationalOnly: boolean;
};

export type PillarsReport = { scope: BudgetScope; place: string; pillars: PillarResult[]; pending: number; updated: string };

const fmtYear = (s: YearSeries) => Object.keys(s).map(Number).sort((a, b) => a - b);
const lastOf = (s: YearSeries) => { const y = fmtYear(s).at(-1); return y == null ? null : { year: y, value: s[y] }; };

/** Situação em relação à meta: atingida, perto (até 20% do caminho) ou longe. Metas zero usam tolerância absoluta. */
export function statusOf(value: number, target: number, better: "up" | "down", unit: Unit): Exclude<Status, "sem-meta" | "contexto"> {
  const good = better === "down" ? value <= target : value >= target;
  if (good) return "ok";
  if (target === 0) return Math.abs(value) <= (unit === "pct" ? 1 : 0.5) ? "perto" : "longe";
  const gap = Math.abs(value - target) / Math.abs(target);
  return gap <= 0.2 ? "perto" : "longe";
}

/** Tendência: o último valor contra o de ~5 anos antes (o mais próximo disponível entre 3 e 7 anos). */
export function trendOf(s: YearSeries, better?: "up" | "down"): MetricResult["trend"] {
  const ys = fmtYear(s);
  const last = ys.at(-1);
  if (last == null || !better) return null;
  const prev = [5, 4, 6, 3, 7].map((d) => last - d).find((y) => s[y] != null);
  if (prev == null) return null;
  const a = s[prev], b = s[last];
  const rel = Math.abs(b - a) / Math.max(Math.abs(a), 1e-9);
  const dir = rel < 0.03 ? "estavel" : (better === "down" ? b < a : b > a) ? "melhor" : "pior";
  return { year: prev, value: a, dir };
}

/** Melhor resultado da própria série nos últimos 20 anos (projeção "já fizemos isso"). */
export function bestOwn(s: YearSeries, better: "up" | "down"): { year: number; value: number } | null {
  const ys = fmtYear(s);
  const last = ys.at(-1);
  if (last == null) return null;
  const window = ys.filter((y) => y >= last - 20);
  if (window.length < 5) return null;
  return window.reduce((b, y) => (better === "down" ? s[y] < b.value : s[y] > b.value) ? { year: y, value: s[y] } : b, { year: window[0], value: s[window[0]] });
}

const projectable = (ind: { unit: Unit; better?: string }) => !!ind.better && !["brl", "usd", "count"].includes(ind.unit);

/** Direção "melhor" para indicadores que no catálogo são neutros, mas aqui têm limite (quanto menor, mais folga). */
const BETTER: Record<string, "up" | "down"> = { "pessoal-rcl": "down" };

type Meta = { id: string; name: string; unit: Unit; decimals: number; desc: string; source: string; sourceUrl?: string; better?: "up" | "down"; ind?: Indicator };
const byId = new Map(INDICATORS.map((i) => [i.id, i]));
function metaOf(id: string): Meta | null {
  const d = DERIVED[id];
  if (d) return { id, name: d.name, unit: "pct", decimals: 1, desc: d.desc, source: d.source, better: d.better };
  const ind = byId.get(id);
  if (!ind) return null;
  return { id, name: ind.name, unit: ind.unit, decimals: ind.decimals ?? 1, desc: ind.desc, source: ind.source, sourceUrl: ind.sourceUrl, better: ind.better ?? BETTER[id], ind };
}

/** Todos os ids de indicadores usados nas árvores (inclui os que entram nas métricas calculadas). */
export function pillarIndicatorIds(): string[] {
  const out = new Set<string>();
  const walk = (nodes: Node[]) => nodes.forEach((x) => {
    if (DERIVED[x.id]) { out.add(DERIVED[x.id].num); out.add(DERIVED[x.id].den); } else out.add(x.id);
    const ratio = TARGETS[x.id]?.ratioOf?.id; // meta que depende de outra série (reservas × importações)
    if (ratio) out.add(ratio);
    walk(x.children ?? []);
  });
  PILLARS.forEach((p) => walk(p.tree));
  return [...out];
}

/** Esfera de onde ler um indicador: a pedida, ou o estado quando a cidade não tem a série. */
function levelFor(ind: Indicator, scope: Scope): Scope | null {
  if (ind.fetch[scope]) return scope;
  if (scope === "MUNICIPAL" && ind.fetch.ESTADUAL) return "ESTADUAL";
  return null;
}

/** Valores de todos os estados já guardados no banco (sem buscar nada ao vivo), para achar o "melhor estado". */
async function stateValues(ids: string[]): Promise<Map<string, Record<string, YearSeries>>> {
  const keys: string[] = [];
  const want = ids.map((id) => byId.get(id)).filter((i): i is Indicator => !!i && !!i.fetch.ESTADUAL && projectable(i));
  for (const ind of want) for (const uf of Object.keys(UF_CODE)) keys.push(ind.fed ? `ind:v1:${ind.id}:ESTADUAL:${uf}` : `ind:v7:${ind.id}:ESTADUAL:${uf}`);
  const rows = keys.length ? await db.budgetCache.findMany({ where: { key: { in: keys } }, select: { key: true, data: true } }).catch(() => []) : [];
  const out = new Map<string, Record<string, YearSeries>>();
  for (const r of rows) {
    const [, , id, , uf] = r.key.split(":");
    const m = out.get(id) ?? {};
    m[uf] = r.data as unknown as YearSeries;
    out.set(id, m);
  }
  return out;
}

/** Melhor estado no ano mais recente em que pelo menos 15 estados têm dado. */
export function bestState(all: Record<string, YearSeries> | undefined, better: "up" | "down", upTo: number): { uf: string; year: number; value: number; n: number } | null {
  if (!all) return null;
  const years = new Map<number, number>();
  for (const s of Object.values(all)) for (const y of fmtYear(s)) if (y <= upTo) years.set(y, (years.get(y) ?? 0) + 1);
  const year = [...years.entries()].filter(([, c]) => c >= 15).map(([y]) => y).sort((a, b) => b - a)[0];
  if (year == null) return null;
  let best: { uf: string; year: number; value: number; n: number } | null = null;
  for (const [uf, s] of Object.entries(all)) {
    const v = s[year];
    if (v == null) continue;
    if (!best || (better === "down" ? v < best.value : v > best.value)) best = { uf, year, value: v, n: years.get(year)! };
  }
  return best;
}

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Quanto o governo gasta no pilar (funções do orçamento), por habitante e como parte do total. */
export function spendOf(h: BudgetHistory | null, areas: string[]): Spend | null {
  if (!h || !areas.length || !h.years.length) return null;
  const series = h.expense.filter((s) => !s.parent && areas.some((a) => norm(s.name) === a || norm(s.name).startsWith(a)));
  if (!series.length) return null;
  const year = h.years.at(-1)!;
  const sum = (y: number) => series.reduce((a, s) => a + (s.values[y] ?? 0), 0);
  const value = sum(year);
  const total = h.totals.expense[year];
  if (!value || !total) return null;
  const pop = h.population[year] ?? h.population[year - 1] ?? null;
  const y5 = year - 5;
  const before = sum(y5) * (h.deflator[y5] ?? NaN);
  const now = value * (h.deflator[year] ?? 1);
  return { year, value, perCapita: pop ? value / pop : null, share: value / total, realChange5y: Number.isFinite(before) && before > 0 ? now / before - 1 : null };
}

type Loaded = Map<string, { level: Scope; series: YearSeries }>;

function buildMetric(node: Node, scope: Scope, data: Loaded, states: Map<string, Record<string, YearSeries>>, geoUf = ""): MetricResult | null {
  const meta = metaOf(node.id);
  if (!meta) return null;
  const got = data.get(node.id);
  const children = (node.children ?? []).map((c) => buildMetric(c, scope, data, states, geoUf)).filter((x): x is MetricResult => !!x);
  if (!got) return null;
  const last = lastOf(got.series);
  if (!last) return null;
  const level = got.level;
  const refs: Ref[] = [];
  let target: Ref | null = null;
  const t = TARGETS[node.id];
  const extra = EXTRA_TARGETS[node.id];
  if (t) {
    let value: number | null = t.byScope?.[level] ?? t.value ?? null;
    if (value == null && t.base) { const b = got.series[t.base.year]; value = b != null ? b * t.base.factor : null; }
    if (value == null && t.ratioOf) { const other = data.get(t.ratioOf.id)?.series[last.year]; value = other != null ? other * t.ratioOf.factor : null; }
    // limites legais por esfera não valem para a União
    if (value != null && !(t.byScope && !t.byScope[level] && t.value == null)) target = { label: BASIS[TARGET_BASIS[node.id] ?? "internacional"].label, value, basis: TARGET_BASIS[node.id] ?? "internacional", text: t.ref, url: t.url, approx: t.approx };
  } else if (extra) target = { label: BASIS[extra.basis].label, value: extra.value, basis: extra.basis, text: extra.ref, url: extra.url, approx: extra.approx };

  if (meta.better && meta.ind && projectable(meta)) {
    // contas de município não se comparam com as de estado (limites e receitas diferentes)
    const bs = !(level === "MUNICIPAL" && meta.ind.group === "financas") ? bestState(states.get(node.id), meta.better, last.year) : null;
    const ahead = bs && (meta.better === "down" ? last.value <= bs.value : last.value >= bs.value);
    if (bs && !ahead) refs.push({ label: `Melhor estado (${UFS[bs.uf] ?? bs.uf}, ${bs.year})`, value: bs.value, basis: "estados", text: `Entre ${bs.n} estados com dado em ${bs.year}, o melhor resultado foi o de ${UFS[bs.uf] ?? bs.uf}. É uma vitória que já aconteceu no Brasil e mostra o que é alcançável com as políticas certas.` });
    else if (bs) refs.push({ label: `Melhor estado (${UFS[bs.uf] ?? bs.uf}, ${bs.year})`, value: bs.value, basis: "estados", text: level === "ESTADUAL" && bs.uf === geoUf ? `Este é o melhor resultado entre ${bs.n} estados em ${bs.year}.` : `Este resultado já é igual ou melhor que o do melhor estado em ${bs.year} (${UFS[bs.uf] ?? bs.uf}, entre ${bs.n} com dado).` });
  }
  if (meta.better && projectable(meta)) {
    const bo = bestOwn(got.series, meta.better);
    if (bo && bo.year !== last.year) refs.push({ label: `Melhor resultado aqui (${bo.year})`, value: bo.value, basis: "historico", text: `O melhor valor desta série nos últimos 20 anos foi em ${bo.year}. Se já foi alcançado aqui, pode ser recuperado.` });
  }
  if (!target && refs.length) {
    // sem meta oficial: a projeção vira a meta (o melhor estado vem antes do próprio histórico)
    const better = meta.better;
    const beats = (r: Ref) => (better === "down" ? r.value < last.value : r.value > last.value);
    const pick = refs.find((r) => r.basis === "estados" && beats(r)) ?? refs.find(beats) ?? refs[0];
    target = pick;
    refs.splice(refs.indexOf(pick), 1);
  }
  const status: Status = !meta.better ? "contexto" : target ? statusOf(last.value, target.value, meta.better, meta.unit) : "sem-meta";
  return {
    id: node.id, name: meta.name, unit: meta.unit, decimals: meta.decimals, desc: meta.desc, source: meta.source, sourceUrl: meta.sourceUrl, better: meta.better,
    level, year: last.year, value: last.value, series: Object.fromEntries(fmtYear(got.series).filter((y) => y >= last.year - 20).map((y) => [y, got.series[y]])),
    target, refs, status, trend: trendOf(got.series, meta.better), children: children.filter((c) => c.id !== node.id),
  };
}

/** Árvore de um pilar numa esfera: métricas sem dado somem e, se a principal faltar, as submétricas sobem um nível. */
export function buildTree(tree: Node[], scope: Scope, data: Loaded, states: Map<string, Record<string, YearSeries>>, geoUf = ""): MetricResult[] {
  const out: MetricResult[] = [];
  const seen = new Set<string>();
  const add = (m: MetricResult) => {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    m.children = m.children.filter((c) => !seen.has(c.id));
    m.children.forEach((c) => seen.add(c.id));
    out.push(m);
  };
  for (const node of tree) {
    const m = buildMetric(node, scope, data, states, geoUf);
    if (m) add(m);
    else for (const c of node.children ?? []) { const cm = buildMetric(c, scope, data, states, geoUf); if (cm) add(cm); }
  }
  return out;
}

export function countsOf(metrics: MetricResult[]): PillarResult["counts"] {
  const all = metrics.flatMap((m) => [m, ...m.children]);
  return { ok: all.filter((m) => m.status === "ok").length, perto: all.filter((m) => m.status === "perto").length, longe: all.filter((m) => m.status === "longe").length, semMeta: all.filter((m) => m.status === "sem-meta").length };
}

export async function getPillars(scope: BudgetScope, user: { uf: string; municipalityKey: string; municipality?: string }): Promise<PillarsReport> {
  const ibge = scope === "MUNICIPAL" ? await ibgeIdFor(user.uf, user.municipalityKey).catch(() => null) : null;
  const geo: Geo = { uf: user.uf, ufCode: UF_CODE[user.uf] ?? 0, ibge: String(ibge ?? ""), municipalityKey: user.municipalityKey };
  const ids = pillarIndicatorIds();
  const data: Loaded = new Map();
  let pending = 0;
  await Promise.all(ids.map(async (id) => {
    const ind = byId.get(id);
    if (!ind) return;
    const level = levelFor(ind, scope);
    if (!level || (level === "MUNICIPAL" && !geo.ibge)) return;
    const s = await getSeries(ind, level, geo, { lazy: true }).catch(() => null);
    if (s && Object.keys(s).length) data.set(id, { level, series: s });
    else if (!ind.fed) pending++;
  }));
  // métricas calculadas (razão entre duas séries da mesma esfera)
  for (const [id, d] of Object.entries(DERIVED)) {
    const a = data.get(d.num), b = data.get(d.den);
    if (!a || !b || a.level !== b.level) continue;
    const s: YearSeries = {};
    for (const y of Object.keys(a.series).map(Number)) if (b.series[y]) s[y] = (a.series[y] / b.series[y]) * 100;
    if (Object.keys(s).length) data.set(id, { level: a.level, series: s });
  }
  // na cidade, o analfabetismo do Censo substitui o estadual da PNAD; no estado e no país fica a PNAD (série anual)
  if (scope === "MUNICIPAL" && data.has("analfabetismo-censo")) data.delete("analfabetismo");
  const [states, h] = await Promise.all([stateValues(ids), getBudgetHistory(scope, user).catch(() => null)]);
  const pillars = PILLARS.map(({ tree, ...p }) => {
    const metrics = buildTree(tree, scope, data, states, user.uf);
    const nationalOnly = scope !== "FEDERAL" && !metrics.length && tree.some((x) => byId.get(x.id)?.fetch.FEDERAL);
    return { ...p, metrics, counts: countsOf(metrics), spend: spendOf(h, p.areas), nationalOnly };
  });
  const place = scope === "MUNICIPAL" ? user.municipality ?? "" : scope === "ESTADUAL" ? UFS[user.uf] ?? user.uf : "Brasil";
  return { scope, place, pillars, pending, updated: new Date().toISOString() };
}

/** Para o job de indicadores: séries estaduais usadas na comparação "melhor estado". */
export function benchmarkIndicators(): Indicator[] {
  return pillarIndicatorIds().map((id) => byId.get(id)).filter((i): i is Indicator => !!i && !i.fed && !!i.fetch.ESTADUAL && projectable(i));
}
