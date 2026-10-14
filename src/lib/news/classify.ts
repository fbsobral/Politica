import type { Branch, ElectionOffice, NewsCategory, Scope, SourceCategory } from "@prisma/client";
import { z } from "zod";
import { aiEnabled, ask, BudgetError, extractJson } from "@/lib/ai";
import { normalize, truncate } from "@/lib/text";
import { BRANCH_VALUES, NEWS_CATEGORY_VALUES, SOURCE_CATEGORY_VALUES, UFS } from "@/lib/taxonomy";

export type ClassifyInput = {
  id: string;
  title: string;
  description?: string | null;
  source: string;
  scopeHint: Scope;
  /** true quando o escopo vem de uma busca por cidade/UF e não deve mudar */
  scopeLocked: boolean;
  /** poder sugerido pela origem (busca/feed), quando houver */
  branchHint?: Branch | null;
  /** local esperado (ex: "Campinas, SP" ou "estado de São Paulo") quando a busca foi local */
  locationHint?: string;
  /** assunto (mesma história em vários veículos): itens equivalentes são classificados uma vez só */
  clusterKey?: string;
};

export type ClassifyOutput = {
  id: string;
  political: boolean;
  scope: Scope;
  uf: string | null;
  category: NewsCategory;
  branch: Branch | null;
  cargo: ElectionOffice | null;
  poll: boolean;
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

let aiOn = true;
/** Permite desligar a IA pela configuração do robô. */
export function setAiEnabled(on: boolean) {
  aiOn = on;
}

const BRANCH_RULES: [Branch, RegExp][] = [
  ["JUDICIARIO", /\bstf\b|\bstj\b|\btse\b|\btre\b|\btjsp?\b|tribunal|juiz|juiza|desembargador|ministro do supremo|supremo|policia federal|\bpf\b|\bpgr\b|ministerio publico|promotor|\bmpf\b|\bmpsp\b|denuncia|condena|\bpreso\b|operacao/],
  ["LEGISLATIVO", /camara dos deputados|\bsenado|\bsenador|deputad|vereador|camara municipal|assembleia legislativa|alesp|plenario|\bcpi\b|projeto de lei|\bpec\b|\bpl\b|congresso|relator|sessao/],
  ["EXECUTIVO", /president[ea]|planalto|\bministr|ministerio|governador|governo|prefeit|secretari|decreto|medida provisoria|palacio/],
];

const CARGO_RULES: [ElectionOffice, RegExp][] = [
  ["PRESIDENTE", /president[ea]\b|planalto|\blula\b|bolsonaro|corrida presidencial/],
  ["GOVERNADOR", /governador|governo do estado|candidat[oa] ao governo/],
  ["SENADOR", /senador|senado|vaga no senado/],
  ["DEPUTADO", /deputad[oa]|camara dos deputados|assembleia legislativa/],
];
const POLL_RE = /pesquisa (eleitoral|datafolha|quaest|atlas|ipec|genial|ipespe|paraná)|datafolha|quaest|atlasintel|\bipec\b|intencao de voto|intencoes de voto|margem de erro/;

export function classifyByRules(i: ClassifyInput): ClassifyOutput {
  const text = normalize(`${i.title} ${i.description ?? ""}`);
  const category = KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? "OUTROS";
  const branch = i.branchHint ?? BRANCH_RULES.find(([, re]) => re.test(text))?.[0] ?? null;
  const election = category === "ELEICOES" || /eleic|candidat|segundo turno|urna/.test(text);
  const cargo = election ? (CARGO_RULES.find(([, re]) => re.test(text))?.[0] ?? null) : null;
  return { id: i.id, political: true, scope: i.scopeHint, uf: null, category, branch, cargo, poll: POLL_RE.test(text) };
}

/* ───────── Classificação com IA (formato compacto para gastar poucos tokens) ───────── */

const SC = { M: "MUNICIPAL", E: "ESTADUAL", F: "FEDERAL" } as const;
const BR = { L: "LEGISLATIVO", E: "EXECUTIVO", J: "JUDICIARIO" } as const;
const CG = { P: "PRESIDENTE", G: "GOVERNADOR", S: "SENADOR", D: "DEPUTADO" } as const;
const CAT: Record<string, NewsCategory> = { ECO: "ECONOMIA", SAU: "SAUDE", SEG: "SEGURANCA", EDU: "EDUCACAO", ELE: "ELEICOES", JUS: "JUSTICA_CORRUPCAO", INF: "INFRAESTRUTURA", AMB: "MEIO_AMBIENTE", SOC: "SOCIAL", LEG: "LEGISLATIVO", ADM: "ADMINISTRACAO", INT: "INTERNACIONAL", OUT: "OUTROS" };
const SCOPE_CODE: Record<Scope, string> = { MUNICIPAL: "M", ESTADUAL: "E", FEDERAL: "F" };
const BRANCH_CODE: Record<Branch, string> = { LEGISLATIVO: "L", EXECUTIVO: "E", JUDICIARIO: "J" };

// [i, político(0/1), noLocal(0/1), esfera, uf, categoria(código de 3 letras), poder, cargo, pesquisa(0/1)]
const rowSchema = z.tuple([z.number(), z.number(), z.number().nullable(), z.string(), z.string().nullable(), z.string(), z.string().nullable(), z.string().nullable(), z.number().nullable()]);

const SYSTEM = `Você classifica notícias brasileiras de política para um app. Entrada: array de itens [i, título, descrição, veículo, esfera_sugerida, travada, local, poder_sugerido].
Para cada item responda uma linha [i, politico, no_local, esfera, uf, categoria, poder, cargo, pesquisa]:
- politico: 1 se trata de política, governo, legislativo, judiciário, eleições, políticas públicas ou agentes públicos; 0 para esporte, celebridades, crimes comuns sem relação com poder público etc.
- no_local: só vale se "local" não for vazio. 1 se o fato acontece nesse estado/município ou envolve o governo, o legislativo, a justiça ou políticos dele (vereadores, prefeito, deputados, governador); 0 se o foco claro é outro estado/município ou só disputa nacional sem relação local. Sem "local", use 1.
- esfera: F (presidência, ministérios, Congresso, STF/STJ/TSE, assuntos nacionais), E (governo do estado, assembleia, secretarias estaduais) ou M (prefeitura, câmara de vereadores, assuntos da cidade). Se "travada"=1, repita a esfera_sugerida.
- uf: sigla (ex. "SP") só se esfera=E e o estado estiver explícito; senão null.
- categoria (código): ECO=economia/finanças/impostos, SAU=saúde, SEG=segurança pública, EDU=educação, ELE=eleições/candidatos/campanha/pesquisas, JUS=justiça/corrupção/investigações/processos, INF=obras/transportes/infraestrutura, AMB=meio ambiente/clima, SOC=políticas sociais/direitos/previdência, LEG=trâmite legislativo (projetos, votações, CPIs, sessões), ADM=gestão pública/administração/servidores, INT=assuntos internacionais, OUT=outros. Escolha o assunto central da notícia.
- poder: L (Congresso, assembleias, câmaras de vereadores, leis, CPIs, parlamentares), E (presidente, governadores, prefeitos, ministérios, secretarias, decretos, gestão pública) ou J (STF, STJ, TSE, tribunais, juízes, MP, PF, processos); null se não houver poder claro (ex.: eleição em geral). "poder_sugerido" vem da origem da busca: confirme ou corrija.
- cargo: só em notícia de eleições, o cargo em disputa: P (presidente), G (governador), S (senador) ou D (deputado federal/estadual); senão null.
- pesquisa: 1 se for principalmente sobre pesquisa eleitoral (Datafolha, Quaest, AtlasIntel, Ipec etc.) ou intenção de voto.
Responda SOMENTE o array JSON de linhas, sem texto extra. Ex.: [[0,1,1,"F",null,"ECO","E",null,0]]`;

const BATCH = 30;

/** Agrupa itens equivalentes (mesmo assunto, mesmo contexto) para classificar uma vez só e replicar o resultado. */
function groupKey(i: ClassifyInput): string | null {
  return i.clusterKey ? `${i.clusterKey}|${i.scopeHint}|${i.scopeLocked ? 1 : 0}|${i.locationHint ?? ""}` : null;
}

/** Classifica com Claude Haiku (em lotes, formato compacto); cai para regras se a IA estiver indisponível. */
export async function classifyArticles(items: ClassifyInput[]): Promise<ClassifyOutput[]> {
  if (!items.length) return [];
  if (!aiOn || !aiEnabled()) return items.map(classifyByRules);

  // um representante por grupo de itens equivalentes
  const reps: ClassifyInput[] = [];
  const members = new Map<string, ClassifyInput[]>();
  for (const it of items) {
    const k = groupKey(it);
    if (k === null) {
      reps.push(it);
      continue;
    }
    const list = members.get(k);
    if (list) list.push(it);
    else {
      members.set(k, [it]);
      reps.push(it);
    }
  }

  const batches: ClassifyInput[][] = [];
  for (let i = 0; i < reps.length; i += BATCH) batches.push(reps.slice(i, i + BATCH));

  async function runBatch(batch: ClassifyInput[]): Promise<ClassifyOutput[]> {
    const payload = batch.map((b, i) => [i, truncate(b.title, 180), truncate(b.description ?? "", 140), b.source, SCOPE_CODE[b.scopeHint], b.scopeLocked ? 1 : 0, b.locationHint ?? "", b.branchHint ? BRANCH_CODE[b.branchHint] : ""]);
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      let text = "";
      try {
        text = await ask(SYSTEM, JSON.stringify(payload), 40 + batch.length * 34, "classify", true);
        const rows = z.array(z.array(z.unknown())).parse(extractJson(text));
        const byIndex = new Map<number, z.infer<typeof rowSchema>>();
        for (const r of rows) {
          const parsed = rowSchema.safeParse(r);
          if (parsed.success) byIndex.set(parsed.data[0], parsed.data);
        }
        return batch.map((item, i) => {
          const r = byIndex.get(i);
          if (!r) return classifyByRules(item);
          const [, pol, onLoc, sc, ufRaw, catIdx, br, cg, pl] = r;
          const category = CAT[catIdx] ?? classifyByRules(item).category;
          const uf = ufRaw && ufRaw.toUpperCase() in UFS ? ufRaw.toUpperCase() : null;
          const branch = br && br in BR ? BR[br as keyof typeof BR] : (item.branchHint ?? null);
          const cargo = cg && cg in CG ? CG[cg as keyof typeof CG] : null;
          const scope = item.scopeLocked ? item.scopeHint : sc in SC ? SC[sc as keyof typeof SC] : item.scopeHint;
          return { id: item.id, political: pol === 1 && !(item.locationHint && onLoc === 0), scope, uf, category, branch, cargo, poll: pl === 1 };
        });
      } catch (err) {
        lastErr = err as Error;
        if (err instanceof BudgetError) break; // sem orçamento: não adianta tentar de novo
        console.warn(`[classify] tentativa ${attempt + 1} falhou: ${lastErr.message} | resposta: ${JSON.stringify(text.slice(0, 200))}`);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    console.warn("[classify] lote caiu para regras:", lastErr?.message);
    return batch.map(classifyByRules);
  }

  const byRep = new Map<string, ClassifyOutput>();
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, batches.length) }, async () => {
      while (next < batches.length) {
        for (const out of await runBatch(batches[next++])) byRep.set(out.id, out);
      }
    }),
  );

  // replica o resultado do representante para os demais itens do grupo
  const results: ClassifyOutput[] = [];
  for (const it of items) {
    const k = groupKey(it);
    const rep = k === null ? it : members.get(k)![0];
    const out = byRep.get(rep.id) ?? classifyByRules(it);
    results.push({ ...out, id: it.id });
  }
  return results;
}

const srcSchema = z.record(z.string(), z.string());

/** Categoriza veículos desconhecidos (nome → categoria). */
export async function classifySources(names: string[]): Promise<Record<string, SourceCategory>> {
  const out: Record<string, SourceCategory> = {};
  if (!names.length || !aiOn || !aiEnabled()) return out;
  const system = `Você categoriza veículos de comunicação brasileiros. Categorias possíveis: ${SOURCE_CATEGORY_VALUES.join(", ")}.
PORTAL_NACIONAL = portal/site de notícias de alcance nacional; JORNAL = jornal (impresso/digital); REVISTA; TV; RADIO; AGENCIA_NOTICIAS; ORGAO_OFICIAL = site de governo, câmara, tribunal; REGIONAL = veículo local/regional; BLOG_INDEPENDENTE = blog ou mídia independente; OUTRO.
Responda SOMENTE um objeto JSON {"nome do veículo":"CATEGORIA"}.`;
  try {
    const text = await ask(system, JSON.stringify(names.slice(0, 80)), 1200, "sources");
    const parsed = srcSchema.parse(extractJson(text));
    for (const [name, cat] of Object.entries(parsed)) {
      if ((SOURCE_CATEGORY_VALUES as string[]).includes(cat)) out[name] = cat as SourceCategory;
    }
  } catch (err) {
    console.warn("[classifySources] falhou:", (err as Error).message);
  }
  return out;
}
