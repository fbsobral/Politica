import { db } from "@/lib/db";

export const SETTING_DEFAULTS = {
  /** idade máxima (dias) das notícias aceitas */
  maxAgeDays: "3",
  /** dias até apagar notícias antigas (favoritas são mantidas) */
  retentionDays: "90",
  /** "1" liga a busca no Google News por estado/município/federal */
  googleNews: "1",
  /** "1" classifica com Claude (quando há ANTHROPIC_API_KEY); "0" usa só regras */
  aiClassify: "1",
  /** modelo do Claude para classificar e resumir */
  aiModel: "",
  /** buscas do Google News por esfera e poder. Placeholders: {estado}, {cidade}, {uf} */
  queryFederalLegislativo: '("Câmara dos Deputados" OR Senado OR "Congresso Nacional" OR "projeto de lei" OR PEC OR CPI) -esporte',
  queryFederalExecutivo: '("governo federal" OR Planalto OR "presidente Lula" OR ministério OR "ministro da" OR "medida provisória") política',
  queryFederalJudiciario: '(STF OR STJ OR TSE OR "Supremo Tribunal Federal" OR "Polícia Federal" OR PGR OR "Ministério Público Federal")',
  queryStateLegislativo: '("Assembleia Legislativa" OR "deputado estadual" OR "deputados estaduais") "{estado}"',
  queryStateExecutivo: '("governador" OR "governo do estado" OR "secretaria estadual" OR "secretário de estado") "{estado}"',
  queryStateJudiciario: '("Tribunal de Justiça" OR "Ministério Público" OR "Justiça Eleitoral" OR "Tribunal de Contas") "{estado}"',
  queryCityLegislativo: '("câmara municipal" OR vereador OR vereadores OR "câmara de vereadores") "{cidade}" {estado}',
  queryCityExecutivo: '(prefeito OR prefeitura OR "secretaria municipal" OR "gestão municipal") "{cidade}" {estado}',
  queryCityJudiciario: '("Ministério Público" OR promotoria OR "Justiça" OR "Tribunal de Contas" OR TCE) "{cidade}" {estado} (prefeitura OR prefeito OR vereador OR câmara)',
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
