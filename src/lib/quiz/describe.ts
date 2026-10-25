import type { Pillar } from "./data";

/** Frases neutras por faixa de posição (−10…+10) em cada pilar: descrevem o que o partido tende a defender, sem juízo de valor. */
const TEXT: Record<Exclude<Pillar, "estilo">, [string, string, string, string, string]> = {
  economia: [
    "Defende um Estado forte e indutor da economia.",
    "Tende a dar mais papel ao Estado, aos impostos e aos serviços públicos.",
    "Fica no meio: regula o mercado e mantém serviços básicos.",
    "Tende a dar mais espaço ao mercado e à redução de impostos.",
    "Defende Estado mínimo, livre mercado e privatizações.",
  ],
  costumes: [
    "Defende ampliar direitos e pautas de identidade, drogas e aborto.",
    "Tende a apoiar mudanças nos costumes e políticas afirmativas.",
    "Fica no meio: mantém as regras atuais em costumes.",
    "Tende a valorizar a tradição, a família e regras mais rígidas.",
    "Defende valores tradicionais e restrições em drogas e aborto.",
  ],
  seguranca: [
    "Defende restringir armas e priorizar políticas sociais contra a violência.",
    "Tende a priorizar prevenção, inteligência e controle de armas.",
    "Fica no meio: mantém as regras de armas e combina prevenção com policiamento.",
    "Tende a priorizar policiamento, penas mais duras e acesso a armas.",
    "Defende endurecimento de penas e flexibilizar posse e porte de armas.",
  ],
  ambiente: [
    "Coloca a preservação em primeiro, mesmo com custo econômico.",
    "Tende a priorizar a preservação, com limites ao licenciamento.",
    "Fica no meio: crescimento sustentável, com regras claras.",
    "Tende a priorizar o desenvolvimento e flexibilizar o licenciamento.",
    "Coloca o desenvolvimento em primeiro e defende flexibilizar o licenciamento.",
  ],
  educacao: [
    "Defende ensino público forte e mais investimento.",
    "Tende a apostar no ensino público, com gestão e metas.",
    "Fica no meio: gestão por resultados e parcerias com o setor privado.",
    "Tende a ampliar a liberdade de escolha das famílias.",
    "Defende vouchers, escolas cívico-militares e ensino domiciliar.",
  ],
};

export function describePillar(pillar: Exclude<Pillar, "estilo">, pos: number): string {
  const i = pos <= -6 ? 0 : pos <= -2 ? 1 : pos < 2 ? 2 : pos < 6 ? 3 : 4;
  return TEXT[pillar][i];
}

export const POLE_LABEL: Record<Exclude<Pillar, "estilo">, [string, string]> = {
  economia: ["Mais Estado", "Mais mercado"],
  costumes: ["Progressista", "Conservador"],
  seguranca: ["Social e restrição de armas", "Punitiva e armas facilitadas"],
  ambiente: ["Preservação", "Desenvolvimento"],
  educacao: ["Ensino público forte", "Liberdade de escolha"],
};

/** Rótulo curto da posição de alguém num pilar: o polo, ou "meio-termo". */
export function shortBand(pillar: Exclude<Pillar, "estilo">, pos: number): string {
  return pos <= -3.4 ? POLE_LABEL[pillar][0] : pos >= 3.4 ? POLE_LABEL[pillar][1] : "meio-termo";
}

const RADAR_POLES: Record<Exclude<Pillar, "estilo">, [string, string]> = {
  economia: ["Mais Estado", "Mais mercado"],
  costumes: ["Progressista", "Conservador"],
  seguranca: ["Social", "Punitiva"],
  ambiente: ["Preservação", "Desenvolvimento"],
  educacao: ["Ensino público", "Livre escolha"],
};

/** Texto curto para o vértice da teia. */
export function radarBand(pillar: Exclude<Pillar, "estilo">, pos: number): string {
  return pos <= -3.4 ? RADAR_POLES[pillar][0] : pos >= 3.4 ? RADAR_POLES[pillar][1] : "Meio-termo";
}

/** Posição de −10 a +10 com sinal e vírgula (ex.: "−3,2", "+4,0"). */
export function fmtPos(n: number): string {
  const v = Math.round(n * 10) / 10;
  const abs = Math.abs(v).toFixed(1).replace(".", ",");
  return v < 0 ? `−${abs}` : v > 0 ? `+${abs}` : "0,0";
}
