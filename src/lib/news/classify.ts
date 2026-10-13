import type { NewsCategory, Scope, SourceCategory } from "@prisma/client";
import { z } from "zod";
import { aiEnabled, ask, extractJson } from "@/lib/ai";
import { normalize, truncate } from "@/lib/text";
import { NEWS_CATEGORY_VALUES, SOURCE_CATEGORY_VALUES, UFS } from "@/lib/taxonomy";

export type ClassifyInput = {
  id: string;
  title: string;
  description?: string | null;
  source: string;
  scopeHint: Scope;
  /** true quando o escopo vem de uma busca por cidade/UF e não deve mudar */
  scopeLocked: boolean;
  /** local esperado (ex: "Campinas, SP" ou "estado de São Paulo") quando a busca foi local */
  locationHint?: string;
};

export type ClassifyOutput = {
  id: string;
  political: boolean;
  scope: Scope;
  uf: string | null;
  category: NewsCategory;
};

const KEYWORDS: [NewsCategory, RegExp][] = [
  ["ELEICOES", /eleic|candidat|urna|tse|campanha|voto|pesquisa eleitoral|segundo turno/],
  ["JUSTICA_CORRUPCAO", /corrup|propina|stf|stj|tribunal|juiz|ministro do supremo|policia federal|operacao|denuncia|processo|investig|preso|condena|improbidade|mpf|ministerio publico/],
  ["ECONOMIA", /econom|inflacao|juros|selic|pib|imposto|orcamento|fiscal|tarifa|dolar|reforma tributaria|arrecada|divida|emprego|salario/],
  ["SAUDE", /saude|sus\b|hospital|vacina|medic|dengue|ubs|upa\b|epidemia/],
  ["EDUCACAO", /educa|escola|enem|universidade|professor|ensino|merenda|creche/],
  ["SEGURANCA", /seguranca|violencia|policia militar|crime|homicidio|facc|trafico|guarda municipal|presidio/],
  ["INFRAESTRUTURA", /obra|infraestrutura|rodovia|asfalto|transporte|metro|onibus|saneamento|moradia|habitacao|energia|ponte/],
  ["MEIO_AMBIENTE", /ambient|desmat|queimada|clima|amazonia|poluicao|licenciamento/],
  ["SOCIAL", /bolsa familia|assistencia social|desigualdade|fome|pobreza|beneficio|inss|previdencia|direitos|indigen/],
  ["LEGISLATIVO", /camara dos deputados|senado|vereador|deputad|projeto de lei|\bpl\b|\bpec\b|sessao|plenario|cpi|comissao|assembleia/],
  ["INTERNACIONAL", /eua|trump|china|russia|ucrania|onu|mercosul|argentina|europa|diplomac|itamaraty/],
  ["ADMINISTRACAO", /prefeitura|prefeito|governo|secretar|licitacao|concurso|servidor|gestao|decreto/],
];

export function classifyByRules(i: ClassifyInput): ClassifyOutput {
  const text = normalize(`${i.title} ${i.description ?? ""}`);
  const category = KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? "OUTROS";
  return { id: i.id, political: true, scope: i.scopeHint, uf: null, category };
}

const outSchema = z.array(
  z.object({
    id: z.string(),
    political: z.boolean(),
    onLocation: z.boolean().nullable().optional(),
    scope: z.enum(["MUNICIPAL", "ESTADUAL", "FEDERAL"]),
    uf: z.string().nullable().optional(),
    category: z.string(),
  }),
);

const SYSTEM = `Você classifica notícias brasileiras sobre política para um app de acompanhamento político.
Para cada notícia devolva:
- political: true se trata de política, governo, legislativo, judiciário, eleições, políticas públicas ou agentes públicos; false para esporte, celebridades, crimes comuns sem relação com poder público, etc.
- scope: "FEDERAL" (presidência, ministérios, Congresso Nacional, STF/STJ/TSE, assuntos nacionais), "ESTADUAL" (governo do estado, assembleia legislativa, secretarias estaduais) ou "MUNICIPAL" (prefeitura, câmara de vereadores, assuntos da cidade). Quando "scopeLocked" for true, mantenha exatamente o "scopeHint".
- onLocation: só quando "locationHint" existir. true SOMENTE se o fato principal da notícia acontece nesse estado/município ou envolve diretamente o governo/poder público dele. false se o foco é outro estado, outro município ou o plano nacional (ex.: eleição para governador do Acre quando o local é São Paulo; apoio a candidato a presidente; disputa nacional). Na dúvida, false.
- uf: sigla do estado (ex: "SP") apenas se scope for ESTADUAL e o estado estiver explícito no texto; senão null.
- category: uma de ${NEWS_CATEGORY_VALUES.join(", ")}.
Responda SOMENTE com um array JSON: [{"id":"...","political":true,"onLocation":true,"scope":"FEDERAL","uf":null,"category":"ECONOMIA"}].`;

const BATCH = 25;

/** Classifica com Claude Haiku (em lotes); cai para regras se a IA estiver indisponível. */
export async function classifyArticles(items: ClassifyInput[]): Promise<ClassifyOutput[]> {
  if (!items.length) return [];
  if (!aiEnabled()) return items.map(classifyByRules);

  const batches: ClassifyInput[][] = [];
  for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));

  async function runBatch(batch: ClassifyInput[]): Promise<ClassifyOutput[]> {
    const payload = batch.map((b) => ({
      id: b.id,
      title: truncate(b.title, 200),
      description: truncate(b.description ?? "", 280),
      source: b.source,
      scopeHint: b.scopeHint,
      scopeLocked: b.scopeLocked,
      locationHint: b.locationHint,
    }));
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      let text = "";
      try {
        text = await ask(SYSTEM, JSON.stringify(payload), 6000);
        const parsed = outSchema.parse(extractJson(text));
        const byId = new Map(parsed.map((p) => [p.id, p]));
        return batch.map((item) => {
          const p = byId.get(item.id);
          if (!p) return classifyByRules(item);
          const category = (NEWS_CATEGORY_VALUES as string[]).includes(p.category) ? (p.category as NewsCategory) : classifyByRules(item).category;
          const uf = p.uf && p.uf.toUpperCase() in UFS ? p.uf.toUpperCase() : null;
          return { id: item.id, political: p.political && !(item.locationHint && p.onLocation === false), scope: item.scopeLocked ? item.scopeHint : (p.scope as Scope), uf, category };
        });
      } catch (err) {
        lastErr = err as Error;
        console.warn(`[classify] tentativa ${attempt + 1} falhou: ${lastErr.message} | resposta: ${JSON.stringify(text.slice(0, 200))}`);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    console.warn("[classify] lote caiu para regras:", lastErr?.message);
    return batch.map(classifyByRules);
  }

  const results: ClassifyOutput[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, batches.length) }, async () => {
      while (next < batches.length) {
        const i = next++;
        results.push(...(await runBatch(batches[i])));
      }
    }),
  );
  return results;
}

const srcSchema = z.record(z.string(), z.string());

/** Categoriza veículos desconhecidos (nome → categoria). */
export async function classifySources(names: string[]): Promise<Record<string, SourceCategory>> {
  const out: Record<string, SourceCategory> = {};
  if (!names.length || !aiEnabled()) return out;
  const system = `Você categoriza veículos de comunicação brasileiros. Categorias possíveis: ${SOURCE_CATEGORY_VALUES.join(", ")}.
PORTAL_NACIONAL = portal/site de notícias de alcance nacional; JORNAL = jornal (impresso/digital); REVISTA; TV; RADIO; AGENCIA_NOTICIAS; ORGAO_OFICIAL = site de governo, câmara, tribunal; REGIONAL = veículo local/regional; BLOG_INDEPENDENTE = blog ou mídia independente; OUTRO.
Responda SOMENTE um objeto JSON {"nome do veículo":"CATEGORIA"}.`;
  try {
    const text = await ask(system, JSON.stringify(names.slice(0, 80)), 2000);
    const parsed = srcSchema.parse(extractJson(text));
    for (const [name, cat] of Object.entries(parsed)) {
      if ((SOURCE_CATEGORY_VALUES as string[]).includes(cat)) out[name] = cat as SourceCategory;
    }
  } catch (err) {
    console.warn("[classifySources] falhou:", (err as Error).message);
  }
  return out;
}
