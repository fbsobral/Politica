import type { Branch, NewsCategory, PoliticianRole, Scope, SourceCategory } from "@prisma/client";

export const SCOPE_LABEL: Record<Scope, string> = {
  MUNICIPAL: "Municipal",
  ESTADUAL: "Estadual",
  FEDERAL: "Federal",
};

export const SCOPE_SLUG: Record<string, Scope> = {
  municipal: "MUNICIPAL",
  estadual: "ESTADUAL",
  federal: "FEDERAL",
};

export const SOURCE_CATEGORY_LABEL: Record<SourceCategory, string> = {
  PORTAL_NACIONAL: "Portal nacional",
  JORNAL: "Jornal",
  REVISTA: "Revista",
  TV: "TV",
  RADIO: "Rádio",
  AGENCIA_NOTICIAS: "Agência de notícias",
  ORGAO_OFICIAL: "Órgão oficial",
  PARTIDO: "Site de partido",
  REGIONAL: "Veículo regional",
  BLOG_INDEPENDENTE: "Independente / blog",
  OUTRO: "Outros",
};

export const NEWS_CATEGORY_LABEL: Record<NewsCategory, string> = {
  ECONOMIA: "Economia",
  SAUDE: "Saúde",
  SEGURANCA: "Segurança",
  EDUCACAO: "Educação",
  ELEICOES: "Eleições",
  JUSTICA_CORRUPCAO: "Justiça e corrupção",
  INFRAESTRUTURA: "Infraestrutura",
  MEIO_AMBIENTE: "Meio ambiente",
  SOCIAL: "Social",
  LEGISLATIVO: "Legislativo",
  ADMINISTRACAO: "Administração",
  INTERNACIONAL: "Internacional",
  OUTROS: "Outros",
};

export const ROLE_LABEL: Record<PoliticianRole, string> = {
  PRESIDENTE: "Presidente",
  VICE_PRESIDENTE: "Vice-presidente",
  SENADOR: "Senador(a)",
  DEPUTADO_FEDERAL: "Deputado(a) federal",
  GOVERNADOR: "Governador(a)",
  VICE_GOVERNADOR: "Vice-governador(a)",
  DEPUTADO_ESTADUAL: "Deputado(a) estadual",
  PREFEITO: "Prefeito(a)",
  VICE_PREFEITO: "Vice-prefeito(a)",
  VEREADOR: "Vereador(a)",
};

export const BRANCH_LABEL: Record<Branch, string> = {
  LEGISLATIVO: "Legislativo",
  EXECUTIVO: "Executivo",
  JUDICIARIO: "Judiciário",
};
export const BRANCH_VALUES = Object.keys(BRANCH_LABEL) as Branch[];

export const SCOPE_VALUES = Object.keys(SCOPE_LABEL) as Scope[];
export const SOURCE_CATEGORY_VALUES = Object.keys(SOURCE_CATEGORY_LABEL) as SourceCategory[];
export const NEWS_CATEGORY_VALUES = Object.keys(NEWS_CATEGORY_LABEL) as NewsCategory[];

export const UFS: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
  PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};
