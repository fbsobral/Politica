import { getBudgetHistory, UF_CODE, type BudgetHistory, type BudgetScope } from "@/lib/budget";
import { db } from "@/lib/db";
import { ibgeIdFor } from "@/lib/ibge";
import { getSeries, INDICATORS, type Indicator } from "@/lib/indicators/catalog";
import { partialOf, type Geo, type PartialInfo, type Scope, type YearSeries } from "@/lib/indicators/core";
import type { Unit } from "@/lib/indicators/format";
import { TARGETS } from "@/lib/indicators/targets";
import { UFS } from "@/lib/taxonomy";

/*
 * Pilares: o governo dividido por área de resultado (saúde, educação, saneamento…), cada uma com uma árvore de
 * métricas e submétricas, o nosso resultado, a meta e — sempre documentado — de onde a meta vem:
 * referência internacional, meta brasileira (lei ou plano), ideal declarado, ou projeção quando não há meta
 * (o melhor estado do país, uma "vitória isolada" que mostra o que é possível, ou o melhor resultado já alcançado aqui).
 */

import { BASIS, statusOf, type Basis } from "@/lib/pillar-basis";

export { BASIS, statusOf, type Basis };

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
  "vacinacao-dtp": "internacional", "vacinacao-sarampo": "internacional", pm25: "internacional", "pobreza-criancas": "internacional", "esgoto-tratado": "brasil", "gasto-educacao-pib": "brasil", "renda-negros": "ideal",
  "moradia-precaria": "internacional", "inseguranca-grave": "internacional", "inseguranca-alimentar": "internacional", "trabalho-infantil": "internacional",
};

/** Metas próprias do pilar para indicadores que não têm meta no score. */
const EXTRA_TARGETS: Record<string, { value: number; basis: Basis; ref: string; url?: string; approx?: boolean }> = {
  "salario-minimo": { value: 7107, basis: "brasil", ref: "Salário mínimo necessário calculado pelo DIEESE (R$ 7.107 em dez/2025, família de 4 pessoas), a referência do art. 7º, IV, da Constituição (moradia, alimentação, educação, saúde, lazer, vestuário, higiene, transporte e previdência)", url: "https://www.dieese.org.br/analisecestabasica/salarioMinimo.html" },
};

/**
 * Médias internacionais (OCDE, ou o mundo quando a OCDE não tem o dado), conferidas na fonte em nov/2026.
 * Entram como meta quando o indicador não tem meta oficial e, nos demais, como referência adicional ("Média internacional").
 */
const WB = (code: string) => `https://data.worldbank.org/indicator/${code}`;
export const INTL: Record<string, { value: number; label: string; ref: string; url: string; approx?: boolean; /** meta de outro bloco de países, não média */ goal?: boolean }> = {
  "mortalidade-5": { value: 6.7, label: "Média da OCDE (2024)", ref: "Média dos países da OCDE em 2024: 6,7 mortes de menores de 5 anos por mil nascidos vivos (estimativas da ONU, Banco Mundial SH.DYN.MORT)", url: WB("SH.DYN.MORT") },
  "mortalidade-neonatal": { value: 3.9, label: "Média da OCDE (2024)", ref: "Média dos países da OCDE em 2024: 3,9 mortes no primeiro mês por mil nascidos vivos (Banco Mundial SH.DYN.NMRT)", url: WB("SH.DYN.NMRT") },
  "mortalidade-materna": { value: 17, label: "Média da OCDE (2023)", ref: "Média dos países da OCDE em 2023: 17 mortes maternas por 100 mil nascidos vivos (OMS/ONU, Banco Mundial SH.STA.MMRT)", url: WB("SH.STA.MMRT") },
  "gravidez-adolescente": { value: 16.9, label: "Média da OCDE (2024)", ref: "Média dos países da OCDE em 2024: 16,9 nascimentos por mil mulheres de 15 a 19 anos (ONU, Banco Mundial SP.ADO.TFRT)", url: WB("SP.ADO.TFRT") },
  "mortalidade-cronicas": { value: 11.8, label: "Média da OCDE (2021)", ref: "Média dos países da OCDE em 2021: 11,8% de probabilidade de morrer entre 30 e 70 anos por doença cardiovascular, câncer, diabetes ou respiratória crônica (OMS, Banco Mundial SH.DYN.NCOM.ZS)", url: WB("SH.DYN.NCOM.ZS") },
  suicidio: { value: 12.5, label: "Média da OCDE (2021)", ref: "Média dos países da OCDE em 2021: 12,5 suicídios por 100 mil habitantes (OMS, Banco Mundial SH.STA.SUIC.P5)", url: WB("SH.STA.SUIC.P5") },
  homicidios: { value: 4.5, label: "Média da OCDE (2015)", ref: "Média dos países da OCDE: 4,5 homicídios por 100 mil habitantes (UNODC, Banco Mundial VC.IHR.PSRC.P5; último ano com o agregado da OCDE)", url: WB("VC.IHR.PSRC.P5") },
  "homicidios-mulheres": { value: 2.1, label: "Média mundial (2023)", ref: "Média mundial em 2023: 2,1 homicídios de mulheres por 100 mil mulheres (UNODC, Banco Mundial VC.IHR.PSRC.FE.P5; não há agregado da OCDE)", url: WB("VC.IHR.PSRC.FE.P5") },
  transito: { value: 8.2, label: "Média da OCDE (2019)", ref: "Média dos países da OCDE em 2019: 8,2 mortes no trânsito por 100 mil habitantes (OMS, Banco Mundial SH.STA.TRAF.P5)", url: WB("SH.STA.TRAF.P5") },
  "mortes-saneamento": { value: 3.7, label: "Média da OCDE (2019)", ref: "Média dos países da OCDE em 2019: 3,7 mortes por 100 mil atribuídas a água e saneamento inseguros e falta de higiene (OMS, Banco Mundial SH.STA.WASH.P5)", url: WB("SH.STA.WASH.P5") },
  "sem-banheiro": { value: 0.1, label: "Média da OCDE (2024)", ref: "Média dos países da OCDE em 2024: 0,1% da população sem banheiro, fazendo as necessidades a céu aberto (OMS/Unicef, Banco Mundial SH.STA.ODFC.ZS)", url: WB("SH.STA.ODFC.ZS") },
  energia: { value: 99.9, label: "Média da OCDE (2024)", ref: "Média dos países da OCDE em 2024: 99,9% da população com energia elétrica (Banco Mundial EG.ELC.ACCS.ZS)", url: WB("EG.ELC.ACCS.ZS") },
  "conclusao-fund": { value: 93.6, label: "Média da OCDE (2024)", ref: "Média dos países da OCDE em 2024: 93,6% de conclusão do segundo ciclo do fundamental (UNESCO, Banco Mundial SE.SEC.CMPT.LO.ZS; a idade de referência é próxima, não idêntica)", url: WB("SE.SEC.CMPT.LO.ZS"), approx: true },
  "nem-nem": { value: 13.1, label: "Média da OCDE (2025)", ref: "Média dos países da OCDE em 2025: 13,1% dos jovens de 15 a 24 anos sem estudar, trabalhar ou se capacitar (OIT, Banco Mundial SL.UEM.NEET.ZS)", url: WB("SL.UEM.NEET.ZS") },
  "expectativa-vida": { value: 80.4, label: "Média da OCDE (2024)", ref: "Média dos países da OCDE em 2024: 80,4 anos de expectativa de vida ao nascer (Banco Mundial SP.DYN.LE00.IN)", url: WB("SP.DYN.LE00.IN") },
  "moradia-precaria": { value: 3.7, label: "Média da OCDE (2022)", ref: "Média dos países da OCDE em 2022: 3,7% da população urbana em favelas ou moradia precária (ONU-Habitat, Banco Mundial EN.POP.SLUM.UR.ZS; o critério da ONU-Habitat é diferente do usado pelo IBGE, por isso a comparação é aproximada)", url: WB("EN.POP.SLUM.UR.ZS"), approx: true },
  "vacinacao-dtp": { value: 91.8, label: "Média da OCDE (2024)", ref: "Média dos países da OCDE em 2024: 91,8% das crianças com as três doses da tríplice (OMS/Unicef, Banco Mundial SH.IMM.IDPT)", url: WB("SH.IMM.IDPT") },
  "vacinacao-sarampo": { value: 91.4, label: "Média da OCDE (2024)", ref: "Média dos países da OCDE em 2024: 91,4% das crianças vacinadas contra o sarampo (OMS/Unicef, Banco Mundial SH.IMM.MEAS)", url: WB("SH.IMM.MEAS") },
  pm25: { value: 12, label: "Média da OCDE (2023)", ref: "Média dos países da OCDE em 2023: 12 µg/m³ de partículas finas (Banco Mundial EN.ATM.PM25.MC.M3)", url: WB("EN.ATM.PM25.MC.M3") },
  "gasto-saude-pib": { value: 8, label: "Média da OCDE (2023)", ref: "Média dos países da OCDE em 2023: gasto público em saúde de 8,0% do PIB (OMS, Banco Mundial SH.XPD.GHED.GD.ZS)", url: WB("SH.XPD.GHED.GD.ZS") },
  "gasto-educacao-pib": { value: 5.1, label: "Média da OCDE (2022)", ref: "Média dos países da OCDE em 2022: gasto público em educação de 5,1% do PIB (UNESCO, Banco Mundial SE.XPD.TOTL.GD.ZS)", url: WB("SE.XPD.TOTL.GD.ZS") },
  creche: { value: 45, goal: true, label: "Meta da União Europeia (2030)", ref: "Metas de Barcelona (Recomendação do Conselho da União Europeia, dez/2022): pelo menos 45% das crianças de até 3 anos na educação infantil até 2030", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022H1220(01)" },
  "pre-escola": { value: 96, goal: true, label: "Meta da União Europeia (2030)", ref: "Meta da União Europeia para 2030: pelo menos 96% das crianças de 3 anos até a idade escolar obrigatória na educação infantil (Espaço Europeu da Educação)", url: "https://education.ec.europa.eu/about-eea/the-eea-explained" },
  "agua-rede": { value: 100, goal: true, label: "ODS 6.1 (ONU, 2030)", ref: "ODS 6.1 (ONU): acesso universal e equitativo a água potável segura até 2030", url: "https://brasil.un.org/pt-br/sdgs/6" },
  "agua-segura": { value: 100, goal: true, label: "ODS 6.1 (ONU, 2030)", ref: "ODS 6.1 (ONU): acesso universal e equitativo a água potável segura até 2030", url: "https://brasil.un.org/pt-br/sdgs/6" },
  "esgoto-rede": { value: 100, goal: true, label: "ODS 6.2 (ONU, 2030)", ref: "ODS 6.2 (ONU): acesso a saneamento adequado e equitativo para todos até 2030", url: "https://brasil.un.org/pt-br/sdgs/6" },
  "lixo-coletado": { value: 100, goal: true, label: "ODS 11.6 (ONU, 2030)", ref: "ODS 11.6.1 (ONU): coleta regular e destinação adequada de todo o lixo urbano", url: "https://brasil.un.org/pt-br/sdgs/11" },
  "escola-15-17": { value: 100, goal: true, label: "ODS 4.1 (ONU, 2030)", ref: "ODS 4.1 (ONU): que todos os jovens completem o ensino médio, gratuito e de qualidade, até 2030", url: "https://brasil.un.org/pt-br/sdgs/4" },
  "conclusao-medio": { value: 100, goal: true, label: "ODS 4.1 (ONU, 2030)", ref: "ODS 4.1 (ONU): que todos os jovens completem o ensino médio até 2030", url: "https://brasil.un.org/pt-br/sdgs/4" },
  "renda-mulheres": { value: 89.9, label: "Média da OCDE (2024)", ref: "Na OCDE, a diferença salarial entre homens e mulheres foi de 10,1% em 2024 (salário mediano de quem trabalha em tempo integral): as mulheres recebem cerca de 90% do que os homens recebem", url: "https://www.oecd.org/en/data/indicators/gender-wage-gap.html" },
};

/** Metas internacionais calculadas a partir da própria série (ex.: "reduzir à metade em relação a 2020"). */
const ALT: Record<string, { base: { year: number; factor: number }; label: string; ref: string; url?: string; /** aplica o fator ao que falta para 100% (ex.: metade do esgoto não tratado) */ gap?: boolean }> = {
  "esgoto-tratado": { base: { year: 2015, factor: 0.5 }, gap: true, label: "ODS 6.3 (ONU, 2030)", ref: "ODS 6.3 (ONU): reduzir à metade, até 2030, a proporção de esgoto não tratado, tomando 2015 como base", url: "https://brasil.un.org/pt-br/sdgs/6" },
  transito: { base: { year: 2020, factor: 0.5 }, label: "Meta da ONU para 2030", ref: "Década de Ação pela Segurança no Trânsito (ONU, Resolução A/RES/74/299) e Plano Nacional (Pnatrans, Lei 13.614/2018): reduzir as mortes no trânsito à metade até 2030, tomando 2020 como base", url: "https://www.who.int/teams/social-determinants-of-health/safety-and-mobility/decade-of-action-for-road-safety-2021-2030" },
};

/** Números de contexto: ajudam a ler os outros, mas não têm meta (contagens e valores em reais). */
const CONTEXT = new Set(["homicidios-n", "homicidios-mulheres-n", "pessoal-ocupado", "pib-pc", "salario-medio"]);

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
    tree: [n("mortalidade-5", "mortalidade-neonatal"), n("mortalidade-infantil", "mortalidade-neonatal"), n("mortalidade-materna"), n("expectativa-vida"), n("vacinacao-dtp", "vacinacao-sarampo"), n("gravidez-adolescente"), n("mortalidade-cronicas"), n("suicidio"), n("gasto-saude-pib")],
    gaps: [
      { name: "Cobertura da atenção primária", target: "100% da população", basis: "ideal", why: "A porta de entrada do SUS resolve a maior parte dos problemas de saúde perto de casa.", source: "Ministério da Saúde (e-Gestor AB)", url: "https://egestorab.saude.gov.br" },
    ],
  },
  {
    id: "educacao", name: "Educação", icon: "📚", areas: ["educacao"],
    question: "Todo mundo aprende a ler e os jovens estão estudando ou trabalhando?",
    lens: "8 em cada 10 alunos estão na escola pública; creche e ensino básico pesam mais para as famílias pobres.",
    tree: [n("creche"), n("pre-escola"), n("escola-15-17"), n("conclusao-medio", "conclusao-fund"), n("analfabetismo"), n("analfabetismo-censo"), n("nem-nem"), n("gasto-educacao-pib")],
    gaps: [
      { name: "IDEB dos anos iniciais", target: "6,0", basis: "brasil", why: "Mede aprendizagem e aprovação juntas; o número é a meta do Plano Nacional de Educação.", source: "INEP (IDEB) e PNE 2014–2024, meta 7", url: "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb" },
      { name: "Alunos em tempo integral", target: "25% dos alunos (50% das escolas)", basis: "brasil", why: "Mais tempo na escola, com alimentação e proteção.", source: "PNE 2014–2024, meta 6", url: "https://pne.mec.gov.br" },
      { name: "Alunos de 15 anos com o aprendizado mínimo em matemática (PISA nível 2)", target: "69%, a média da OCDE no PISA 2022 (o Brasil teve 27%)", basis: "internacional", why: "Estar na escola não basta: mede se o aluno está aprendendo (indicador 4.1.1 dos ODS).", source: "OCDE (PISA 2022) e INEP", url: "https://www.oecd.org/en/about/programmes/pisa.html" },
    ],
  },
  {
    id: "saneamento", name: "Saneamento básico", icon: "🚰", areas: ["saneamento"],
    question: "As casas têm água encanada, esgoto e coleta de lixo?",
    lens: "A falta de água e de esgoto se concentra nos bairros pobres e causa doenças e mortes de crianças.",
    tree: [n("agua-rede", "agua-segura"), n("esgoto-rede", "sem-banheiro"), n("esgoto-tratado"), n("lixo-coletado"), n("mortes-saneamento")],
    gaps: [
    ],
  },
  {
    id: "seguranca", name: "Segurança", icon: "🛡", areas: ["seguranca publica"],
    question: "As pessoas estão protegidas da violência?",
    lens: "A violência letal atinge mais os bairros periféricos e os jovens negros.",
    tree: [n("homicidios", "homicidios-n"), n("homicidios-mulheres", "homicidios-mulheres-n")],
    gaps: [
    ],
  },
  {
    id: "mobilidade", name: "Mobilidade e trânsito", icon: "🚌", areas: ["transporte", "urbanismo"],
    question: "Dá para se deslocar com segurança e sem perder horas no caminho?",
    lens: "O transporte público é o meio de quem tem menos renda e mora mais longe do trabalho.",
    tree: [n("transito"), n("deslocamento-1h")],
    gaps: [
    ],
  },
  {
    id: "social", name: "Pobreza e desigualdade", icon: "🤝", areas: ["assistencia social", "direitos da cidadania"],
    question: "Menos gente vive na pobreza e a renda está menos concentrada?",
    lens: "É o pilar que mede diretamente a vida de quem está na base da pirâmide.",
    tree: [n("pobreza", "pobreza-int"), n("pobreza-criancas"), n("inseguranca-grave", "inseguranca-alimentar"), n("gini"), n("renda-mulheres"), n("renda-negros")],
    gaps: [
      { name: "Insegurança alimentar por estado e cidade", target: "Zero até 2030 (Fome Zero)", basis: "internacional", why: "O IBGE publica a fome por estado só em tabelas avulsas; aqui ela aparece para o país.", source: "IBGE (PNAD, Escala Brasileira de Insegurança Alimentar) e ODS 2.1" },
      { name: "Famílias pobres do CadÚnico atendidas", target: "100% das elegíveis", basis: "ideal", why: "Mostra se a rede de proteção chega a quem tem direito.", source: "Ministério do Desenvolvimento Social (CadÚnico)" },
    ],
  },
  {
    id: "trabalho", name: "Trabalho e renda", icon: "💼", areas: ["trabalho"],
    question: "Há trabalho, com direitos, e a renda dá para viver?",
    lens: "Para quem não tem patrimônio, o trabalho é a única fonte de renda.",
    tree: [n("desemprego", "subutilizacao", "desalento"), n("informalidade", "previdencia"), n("renda-trabalho", "pobreza-ocupados"), n("salario-minimo"), n("salario-medio", "pessoal-ocupado"), n("trabalho-infantil")],
    gaps: [
    ],
  },
  {
    id: "moradia", name: "Moradia", icon: "🏠", areas: ["habitacao"],
    question: "As famílias moram em casas adequadas e que cabem no bolso?",
    lens: "Moradia precária e o peso do aluguel atingem sobretudo as famílias de baixa renda.",
    tree: [n("moradia-precaria"), n("energia")],
    gaps: [
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
    ],
  },
  {
    id: "contas", name: "Contas públicas", icon: "🏛", areas: [],
    question: "O governo tem dinheiro para os serviços sem se afundar em dívida?",
    lens: "Dívida cara tira dinheiro dos serviços; ajustes mal feitos costumam cortar primeiro o gasto social.",
    tree: [n("divida-bruta", "divida-liquida", "divida-liquida-gg"), n("deficit-primario", "deficit-nominal"), n("dcl-rcl"), n("pessoal-rcl"), n("investimento-pct"), n("juros-pct")],
    gaps: [
      { name: "Benefícios fiscais (renúncias de receita)", target: "No máximo 2% do PIB (EC 109/2021)", basis: "brasil", why: "Dinheiro que o governo deixa de arrecadar, muitas vezes de quem tem mais.", source: "Receita Federal (Demonstrativo dos Gastos Tributários)" },
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
    tree: [n("floresta"), n("pm25")],
    gaps: [
      { name: "Desmatamento na Amazônia", target: "Desmatamento zero até 2030", basis: "brasil", why: "Compromisso do Brasil; a floresta regula as chuvas de que depende o país.", source: "INPE (PRODES) e Plano de Ação para Prevenção e Controle do Desmatamento", url: "https://terrabrasilis.dpi.inpe.br" },
      { name: "Emissões de gases de efeito estufa", target: "−59% a −67% até 2035 em relação a 2005", basis: "brasil", why: "Meta brasileira no Acordo de Paris (NDC de 2024).", source: "SEEG (Observatório do Clima) e NDC do Brasil" },
    ],
  },
];

/* ───────── cálculo ───────── */

export type Status = "ok" | "perto" | "longe" | "sem-meta" | "contexto";
export type Ref = { label: string; value: number; basis: Basis; text: string; url?: string; approx?: boolean; /** média de outros países (OCDE ou mundo) */ avg?: boolean };

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
  /** ano corrente incompleto: período coberto e valor do mesmo período do ano anterior */
  partial: PartialInfo | null;
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
  if (id === "homicidios-mulheres") return { id, name: "Homicídios de mulheres (por 100 mil mulheres)", unit: "rate", decimals: 1, desc: "Mulheres mortas por agressão por 100 mil mulheres, incluindo os feminicídios (que a fonte não separa). Calculado com o número do Atlas da Violência e a população feminina estimada (a proporção de mulheres do Censo 2022 aplicada à população de cada ano).", source: "IPEA, Atlas da Violência (SIM/DATASUS) e IBGE", sourceUrl: "https://www.ipea.gov.br/atlasviolencia/", better: "down" };
  const d = DERIVED[id];
  if (d) return { id, name: d.name, unit: "pct", decimals: 1, desc: d.desc, source: d.source, better: d.better };
  const ind = byId.get(id);
  if (!ind) return null;
  return { id, name: ind.name, unit: ind.unit, decimals: ind.decimals ?? 1, desc: ind.desc, source: ind.source, sourceUrl: ind.sourceUrl, better: CONTEXT.has(id) ? undefined : ind.better ?? BETTER[id], ind };
}

/** Todos os ids de indicadores usados nas árvores (inclui os que entram nas métricas calculadas). */
export function pillarIndicatorIds(): string[] {
  const out = new Set<string>();
  const walk = (nodes: Node[]) => nodes.forEach((x) => {
    if (DERIVED[x.id]) { out.add(DERIVED[x.id].num); out.add(DERIVED[x.id].den); } else out.add(x.id);
    if (x.id === "homicidios-mulheres") ["homicidios-mulheres-n", "populacao", "mulheres-pop"].forEach((i) => out.add(i));
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
  for (const ind of want) for (const uf of Object.keys(UF_CODE)) keys.push(...(ind.fed ? [`ind:v1:${ind.id}:ESTADUAL:${uf}`] : [`ind:v8:${ind.id}:ESTADUAL:${uf}`, `ind:v7:${ind.id}:ESTADUAL:${uf}`]));
  const rows = keys.length ? await db.budgetCache.findMany({ where: { key: { in: keys } }, select: { key: true, data: true } }).catch(() => []) : [];
  const out = new Map<string, Record<string, YearSeries>>();
  // a versão nova do cache (v8) vem antes da anterior
  rows.sort((a, b) => (a.key < b.key ? -1 : 1));
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
  const partial = partialOf(got.series);
  const refs: Ref[] = [];
  let target: Ref | null = null;
  const t = TARGETS[node.id];
  const extra = EXTRA_TARGETS[node.id];
  if (t) {
    let value: number | null = t.byScope?.[level] ?? t.value ?? null;
    if (value == null && t.base) { const b = got.series[t.base.year]; value = b != null ? b * t.base.factor : null; }
    if (value == null && t.ratioOf) {
      // a série de comparação (ex.: importações do ano) só vale para ano fechado: no ano corrente, usa o último fechado
      const os = data.get(t.ratioOf.id)?.series ?? {};
      const y = last.year === new Date().getFullYear() ? Math.max(...Object.keys(os).map(Number).filter((k) => k < last.year)) : last.year;
      const other = os[y];
      value = other != null ? other * t.ratioOf.factor : null;
    }
    // limites legais por esfera não valem para a União
    if (value != null && !(t.byScope && !t.byScope[level] && t.value == null)) target = { label: BASIS[TARGET_BASIS[node.id] ?? "internacional"].label, value, basis: TARGET_BASIS[node.id] ?? "internacional", text: t.ref, url: t.url, approx: t.approx };
  } else if (extra) target = { label: BASIS[extra.basis].label, value: extra.value, basis: extra.basis, text: extra.ref, url: extra.url, approx: extra.approx };
  if (meta.better) {
    // metas internacionais calculadas (ex.: metade de 2020) e médias de outros países: antes de qualquer projeção
    const alt = ALT[node.id];
    const altBase = alt ? got.series[alt.base.year] : undefined;
    const altRef: Ref | null = alt && altBase != null ? { label: alt.label, value: alt.gap ? 100 - (100 - altBase) * alt.base.factor : altBase * alt.base.factor, basis: "internacional", text: alt.ref, url: alt.url } : null;
    const i = INTL[node.id];
    const avgRef: Ref | null = i ? { label: i.label, value: i.value, basis: "internacional", text: i.ref, url: i.url, approx: i.approx, avg: !i.goal } : null;
    for (const r of [altRef, avgRef]) if (r) { if (!target) target = r; else refs.push(r); }
  }

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
    target, refs, status, partial,
    // tendência de 5 anos só com anos fechados (o parcial tem a sua comparação com o mesmo período do ano anterior)
    trend: trendOf(partial ? Object.fromEntries(Object.entries(got.series).filter(([y]) => Number(y) !== partial.year)) : got.series, meta.better),
    children: children.filter((c) => c.id !== node.id),
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
  // séries que ainda não estavam no banco: busca ao vivo, dentro de um limite de tempo (o resto fica para a próxima visita)
  const missing = ids.map((id) => byId.get(id)).filter((ind): ind is Indicator => !!ind && !ind.fed && !data.has(ind.id) && !!levelFor(ind, scope) && !(levelFor(ind, scope) === "MUNICIPAL" && !geo.ibge));
  if (missing.length) {
    const deadline = new Promise<void>((r) => setTimeout(r, 6000));
    await Promise.race([deadline, Promise.all(missing.map(async (ind) => {
      const level = levelFor(ind, scope)!;
      const s = await getSeries(ind, level, geo).catch(() => null);
      if (s && Object.keys(s).length) { data.set(ind.id, { level, series: s }); pending--; }
    }))]);
  }
  // homicídios de mulheres por 100 mil mulheres: número do Atlas ÷ população feminina (proporção do Censo 2022 × população do ano)
  {
    const n = data.get("homicidios-mulheres-n"), pop = data.get("populacao"), share = data.get("mulheres-pop");
    const sh = share ? lastOf(share.series)?.value : null;
    if (n && pop && sh && n.level === pop.level) {
      const popAt = (y: number) => pop.series[y] ?? pop.series[y - 1] ?? pop.series[y + 1];
      const s: YearSeries = {};
      for (const y of Object.keys(n.series).map(Number)) { const p = popAt(y); if (p) s[y] = Math.round((n.series[y] / (p * (sh / 100))) * 1e6) / 10; }
      if (Object.keys(s).length) data.set("homicidios-mulheres", { level: n.level, series: s });
    }
  }
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
    const ind = (x: Node) => byId.get(x.id);
    const local = (x: Node) => !!ind(x)?.fetch[scope] || (scope === "MUNICIPAL" && !!ind(x)?.fetch.ESTADUAL);
    const nationalOnly = scope !== "FEDERAL" && !metrics.length && tree.length > 0 && !tree.some(local) && tree.some((x) => !!ind(x)?.fetch.FEDERAL);
    return { ...p, metrics, counts: countsOf(metrics), spend: spendOf(h, p.areas), nationalOnly };
  });
  const place = scope === "MUNICIPAL" ? user.municipality ?? "" : scope === "ESTADUAL" ? UFS[user.uf] ?? user.uf : "Brasil";
  return { scope, place, pillars, pending, updated: new Date().toISOString() };
}

/** Para o job de indicadores: séries estaduais usadas na comparação "melhor estado". */
export function benchmarkIndicators(): Indicator[] {
  return pillarIndicatorIds().map((id) => byId.get(id)).filter((i): i is Indicator => !!i && !i.fed && !!i.fetch.ESTADUAL && projectable(i));
}
