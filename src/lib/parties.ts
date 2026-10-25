import { PARTIES, type Party } from "@/lib/quiz/data";

export type { Party };

export const slugOf = (sigla: string) => sigla.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const partyBySigla = (sigla: string | null | undefined): Party | undefined => PARTIES.find((p) => p.sigla === sigla);
export const partyBySlug = (slug: string): Party | undefined => PARTIES.find((p) => slugOf(p.sigla) === slug);

const key = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "");

// o TSE e a Câmara escrevem algumas siglas de outro jeito
const PARTY_ALIASES: Record<string, string> = {
  UNIAO: "União Brasil", PODE: "Podemos", PCDOB: "PCdoB", PC: "PCdoB", MISSAO: "Missão", PATRIOTA: "PRD", PTB: "PRD", SD: "Solidariedade",
};

/** Sigla padronizada (a deste app) a partir do texto de partido dos cadastros de políticos; null se não for um dos partidos conhecidos. */
export function normalizeParty(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const k = key(raw);
  if (!k || k === "SPARTIDO") return null;
  const direct = PARTIES.find((p) => key(p.sigla) === k);
  return direct?.sigla ?? PARTY_ALIASES[k] ?? null;
}

/** Valores de "partido" que, no cadastro de políticos, correspondem à sigla (para filtrar no banco). */
export function politicianPartyValues(sigla: string): string[] {
  const out = new Set<string>([sigla, sigla.toUpperCase()]);
  for (const [alias, target] of Object.entries(PARTY_ALIASES)) if (target === sigla) out.add(alias);
  if (sigla === "PCdoB") out.add("PC do B");
  if (sigla === "União Brasil") out.add("UNIÃO");
  if (sigla === "Podemos") out.add("PODE");
  if (sigla === "Missão") out.add("MISSÃO");
  return [...out];
}

/* ───────── Detecção de partidos em notícias ───────── */

const FED = "(?:partido|legenda|sigla|bancada|federa[cç][aã]o|deputad[oa]s?|senador(?:a|es)?|vereador(?:a|es)?|prefeit[oa]s?|governador(?:a)?|presidente|líder|lider)";
const UFS = "(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)";

/** Regras por partido, sensíveis a maiúsculas. Siglas curtas e palavras comuns exigem contexto para evitar falsos positivos. */
const RULES: Record<string, RegExp[]> = {
  PT: [/\bPT\b(?!\s?\d)/, /Partido dos Trabalhadores/],
  PSOL: [/\bPSOL\b/, /Partido Socialismo e Liberdade/],
  PCdoB: [/\bPCdoB\b/, /\bPC do B\b/, /Partido Comunista do Brasil/],
  UP: [/Unidade Popular/, new RegExp(`\\bUP[-/(]${UFS}\\b`)],
  PSTU: [/\bPSTU\b/],
  PCB: [/\bPCB\b/, /Partido Comunista Brasileiro/],
  PSB: [/\bPSB\b/, /Partido Socialista Brasileiro/],
  PV: [/\bPV\b/, /Partido Verde/],
  Rede: [/Rede Sustentabilidade/, /\b[Pp]artido Rede\b/, new RegExp(`\\bRede[-/(]${UFS}\\b`)],
  Cidadania: [/PSDB[-/ ]Cidadania/, new RegExp(`${FED} (?:do |da )?Cidadania\\b`), new RegExp(`\\bCidadania[-/(]${UFS}\\b`), /\(Cidadania\)/],
  PDT: [/\bPDT\b/, /Partido Democrático Trabalhista/],
  PCO: [/\bPCO\b/, /Partido da Causa Oper[aá]ria/],
  Solidariedade: [new RegExp(`${FED} (?:do |da )?Solidariedade\\b`), new RegExp(`\\bSolidariedade[-/(]${UFS}\\b`), /\(Solidariedade\)/],
  PSDB: [/\bPSDB\b/, /Partido da Social Democracia Brasileira/],
  Novo: [/Partido Novo/, new RegExp(`${FED} (?:do )?Novo\\b`), new RegExp(`\\bNovo[-/(]${UFS}\\b`), /\(Novo\)/],
  Missão: [/Partido Miss[aã]o/, new RegExp(`\\bMiss[aã]o[-/(]${UFS}\\b`)],
  PP: [/\bPP\b/, /\bProgressistas\b/],
  PRD: [/\bPRD\b/, /Partido Renovação Democrática/],
  Republicanos: [/\bRepublicanos\b/],
  DC: [/Democracia Crist[aã]/, new RegExp(`\\bDC[-/(]${UFS}\\b`)],
  PL: [/\bPL\b(?!\s?\d)(?!\s?(?:da|do|das|dos|que|n[ºo]))/, /Partido Liberal/],
  PRTB: [/\bPRTB\b/],
  Agir: [/Partido Agir/, new RegExp(`${FED} (?:do )?Agir\\b`), new RegExp(`\\bAgir[-/(]${UFS}\\b`)],
  MDB: [/\bMDB\b/, /Movimento Democrático Brasileiro/],
  PSD: [/\bPSD\b/, /Partido Social Democrático/],
  "União Brasil": [/União Brasil/, new RegExp(`\\bUnião[-/(]${UFS}\\b`)],
  Podemos: [/\bPodemos\b(?=[-/(])/, new RegExp(`${FED} (?:do )?Podemos\\b`), /\bPODE\b/, new RegExp(`\\bPodemos[-/(]${UFS}\\b`)],
  Avante: [new RegExp(`${FED} (?:do )?Avante\\b`), new RegExp(`\\bAvante[-/(]${UFS}\\b`), /Partido Avante/],
  Mobiliza: [/\bMobiliza\b/],
  PMB: [/\bPMB\b/, /Partido da Mulher Brasileira/],
};

export function detectParties(text: string): string[] {
  const found: string[] = [];
  for (const [sigla, rules] of Object.entries(RULES)) if (rules.some((r) => r.test(text))) found.push(sigla);
  // "PSDB-Cidadania" e "PSOL-Rede" são federações: cita os dois
  return found;
}

/** Texto de busca (Google News) de cada partido, usado para coletar notícias específicas. */
export function searchQueryFor(p: Party): string {
  const hard = ["PT", "PL", "PP", "PV", "UP", "DC", "PSD"];
  const name = `"${p.nome}"`;
  return hard.includes(p.sigla) || p.sigla.length > 3 ? `${name} OR "${p.sigla}" partido` : `${name} OR ${p.sigla} partido`;
}
