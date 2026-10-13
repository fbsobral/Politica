import { z } from "zod";
import { aiEnabled, ask, extractJson } from "@/lib/ai";
import { db } from "@/lib/db";
import { normalize } from "@/lib/text";

export { TIER_LEGEND } from "@/lib/tier-legend";

const T1 = [
  "g1", "g1 politica", "folha de s paulo", "folha de sao paulo", "o estado de s paulo", "estadao", "o globo", "cnn brasil", "uol", "agencia brasil",
  "bbc news brasil", "valor economico", "correio braziliense", "globo news", "band", "bandnews fm", "cbn", "record news", "reuters", "tv globo",
  "agencia camara", "agencia senado", "camara dos deputados", "senado federal", "noticias do stf", "stf", "tse", "planalto", "agencia gov", "gov br",
];
const T2 = [
  "poder360", "metropoles", "jota", "gazeta do povo", "conjur", "congresso em foco", "cartacapital", "carta capital", "veja", "nexo jornal", "terra",
  "terra politica", "agencia publica", "agencia lupa", "aos fatos", "projeto comprova", "brasil de fato", "revista oeste", "the intercept brasil",
  "o antagonista", "revista forum", "brasil 247", "infomoney", "exame", "istoe", "epoca", "piaui", "jovem pan", "r7", "sbt", "migalhas", "dw",
  "zero hora", "o tempo", "estado de minas", "diario de pernambuco", "a tarde", "o povo", "correio do povo", "folha de pernambuco", "diario do nordeste",
  "gazeta do povo", "o dia", "extra", "lance", "correio", "tribuna",
];
const CURATED = new Map<string, 1 | 2>([...T1.map((n) => [n, 1 as const]), ...T2.map((n) => [n, 2 as const])] as [string, 1 | 2][]);

const schema = z.record(z.string(), z.number());

/** Sugere o tier (1-3) de veículos desconhecidos com o Claude. */
async function suggestTiers(names: string[]): Promise<Record<string, 1 | 2 | 3>> {
  const out: Record<string, 1 | 2 | 3> = {};
  if (!names.length || !aiEnabled()) return out;
  const system = `Você classifica veículos de comunicação brasileiros por ALCANCE e TIPO — nunca por qualidade ou posição política.
1 = grande alcance nacional (grandes jornais, TVs, portais, agências de notícias) ou fonte oficial FEDERAL (Presidência, ministérios, Câmara, Senado, STF, STJ, TSE, PGR, Polícia Federal).
2 = nacional menor ou especializado (política, economia, direito), veículo regional forte (principal jornal/TV/rádio de um estado ou grande cidade) e fontes oficiais ESTADUAIS (governo do estado, assembleia legislativa, tribunal de justiça, ministério público estadual, TCE).
3 = blogs, sites pequenos ou locais, agregadores, esportes/entretenimento e fontes oficiais MUNICIPAIS (prefeituras, câmaras de vereadores).
Na dúvida, use 3. Responda SOMENTE um objeto JSON {"nome do veículo": 1|2|3}.`;
  try {
    const parsed = schema.parse(extractJson(await ask(system, JSON.stringify(names.slice(0, 80)), 2000)));
    for (const [name, t] of Object.entries(parsed)) if (t === 1 || t === 2 || t === 3) out[name] = t;
  } catch (err) {
    console.warn("[tiers] sugestão falhou:", (err as Error).message);
  }
  return out;
}

/** Define o tier dos veículos sem tier: lista curada primeiro, depois sugestão da IA (o admin pode corrigir). */
export async function applyTiers(): Promise<void> {
  const pending = await db.source.findMany({ where: { tier: null }, select: { id: true, name: true } });
  if (!pending.length) return;
  const unknown: typeof pending = [];
  for (const s of pending) {
    const t = CURATED.get(normalize(s.name));
    if (t) await db.source.update({ where: { id: s.id }, data: { tier: t, tierBy: "default" } });
    else unknown.push(s);
  }
  for (let i = 0; i < unknown.length; i += 60) {
    const batch = unknown.slice(i, i + 60);
    const ai = await suggestTiers(batch.map((s) => s.name));
    for (const s of batch) {
      const t = ai[s.name];
      if (t) await db.source.update({ where: { id: s.id }, data: { tier: t, tierBy: "ai" } });
      else if (!aiEnabled()) await db.source.update({ where: { id: s.id }, data: { tier: 3, tierBy: "default" } });
      // se a IA falhou, deixa sem tier para tentar de novo na próxima coleta
    }
  }
}
