import { db } from "@/lib/db";

export const SETTING_DEFAULTS = {
  /** idade máxima (dias) das notícias nacionais aceitas; 0 = sem limite */
  maxAgeDays: "0",
  /** idade máxima (dias) para notícias locais (estaduais/municipais); 0 = sem limite */
  localMaxAgeDays: "0",
  /** dias até apagar notícias antigas; 0 = nunca apagar (guarda todo o histórico) */
  retentionDays: "0",
  /** "1" liga a busca no Google News por estado/município/federal */
  googleNews: "1",
  /** "1" classifica com Claude (quando há ANTHROPIC_API_KEY); "0" usa só regras */
  aiClassify: "1",
  /** modelo do Claude para classificar e resumir */
  aiModel: "",
  /** veículos prioritários (domínios separados por vírgula ou linha): ganham buscas próprias por esfera no Google News */
  priorityOutlets: "cnnbrasil.com.br",
  /** buscas do Google News por esfera e poder. Placeholders: {estado}, {cidade}, {uf} */
  queryFederalLegislativo: '("Câmara dos Deputados" OR Senado OR "Congresso Nacional" OR "projeto de lei" OR PEC OR CPI) -esporte',
  queryFederalExecutivo: '("governo federal" OR Planalto OR "presidente Lula" OR ministério OR "ministro da" OR "medida provisória") política',
  queryFederalJudiciario: '(STF OR STJ OR TSE OR "Supremo Tribunal Federal" OR "Polícia Federal" OR PGR OR "Ministério Público Federal")',
  queryStateLegislativo: '("Assembleia Legislativa" OR "deputado estadual" OR "deputados estaduais") "{estado}"',
  queryStateExecutivo: '("governador" OR "governo do estado" OR "secretaria estadual" OR "secretário de estado") "{estado}"',
  queryStateJudiciario: '("Tribunal de Justiça" OR "Ministério Público" OR "Justiça Eleitoral" OR "Tribunal de Contas") "{estado}"',
  queryCityLegislativo: '("câmara municipal" OR "câmara de vereadores" OR vereador OR vereadora OR vereadores OR "presidente da câmara" OR "sessão da câmara") "{cidade}"',
  queryCityExecutivo: '(prefeito OR prefeita OR prefeitura OR "secretaria municipal" OR "gestão municipal") "{cidade}"',
  queryCityJudiciario: '("Ministério Público" OR promotoria OR Justiça OR "Tribunal de Contas" OR TCE OR "Polícia Civil") "{cidade}" (prefeitura OR prefeito OR vereador OR câmara OR eleição)',
  /** buscas sobre eleições (Google News): nacional e por estado. Placeholders: {estado}, {uf} */
  queryElectionFederal: '("segundo turno" OR "eleições 2026" OR "pesquisa eleitoral" OR Datafolha OR Quaest OR AtlasIntel OR debate) presidente',
  queryElectionState: '("segundo turno" OR "pesquisa eleitoral" OR Datafolha OR Quaest OR debate OR candidato) governador "{estado}"',
  /** buscas locais de checagem de fatos (Google News). Placeholders: {estado}, {cidade}, {uf} */
  queryFactCheckState: '("checagem" OR "fato ou fake" OR "é falso" OR "boato" OR desinformação OR verificamos) "{estado}" (política OR eleição OR governo OR candidato)',
  queryFactCheckCity: '("checagem" OR "fato ou fake" OR "é falso" OR "boato" OR desinformação OR verificamos) "{cidade}" (prefeitura OR prefeito OR vereador OR eleição OR candidato)',
} as const;

export type Settings = Record<keyof typeof SETTING_DEFAULTS, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  const out: Settings = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in out && r.value !== "") (out as Record<string, string>)[r.key] = r.value;
  return out;
}

export async function saveSettings(values: Partial<Settings>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    if (!(key in SETTING_DEFAULTS)) continue;
    await db.setting.upsert({ where: { key }, create: { key, value: value ?? "" }, update: { value: value ?? "" } });
  }
}

export function fillTemplate(tpl: string, vars: { estado?: string; cidade?: string; uf?: string }): string {
  return tpl.replace(/\{(estado|cidade|uf)\}/g, (_, k: "estado" | "cidade" | "uf") => vars[k] ?? "");
}
