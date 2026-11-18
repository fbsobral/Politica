import { aiEnabled, ask, extractJson } from "@/lib/ai";
import { db } from "@/lib/db";

/*
 * Rótulos legíveis para proposições citadas por número ("PL 1087/2025", "PEC 45/2019"…):
 * um nome curto (até 8 palavras), usando o nome popular quando existir, gerado uma vez a partir da ementa oficial
 * (Câmara ou Senado) e guardado no banco. Usado na agenda, nas votações, nos resumos por e-mail e no assistente.
 */

/** Tipos de proposição que viram rótulo (requerimentos ficam de fora: tratam de outra proposição). */
const TYPES = "PEC|PLP|PLN|PLV|PDL|PDC|PLC|PLS|PRS|PRC|MPV|MP|PL";
const RE = new RegExp(`\\b(${TYPES})\\s*(?:n[ºo°.]*\\s*)?(\\d{1,3}(?:\\.\\d{3})*|\\d{1,5})\\s*\\/\\s*(\\d{4}|\\d{2})\\b`, "gi");

export type BillRef = { key: string; type: string; number: number; year: number };

const fullYear = (y: string) => (y.length === 4 ? Number(y) : Number(y) > 50 ? 1900 + Number(y) : 2000 + Number(y));

/** Proposições citadas num texto, sem repetição, na forma canônica "PL 1087/2025". */
export function billRefs(text: string): BillRef[] {
  const out = new Map<string, BillRef>();
  for (const m of text.matchAll(RE)) {
    const type = m[1].toUpperCase() === "MP" ? "MPV" : m[1].toUpperCase();
    const number = Number(m[2].replace(/\./g, ""));
    const year = fullYear(m[3]);
    if (!number || year < 1946 || year > new Date().getFullYear() + 1) continue;
    const key = `${type} ${number}/${year}`;
    if (!out.has(key)) out.set(key, { key, type, number, year });
  }
  return [...out.values()];
}

const LABEL_KEY = (k: string) => `bill:v1:${k}`;
const EMENTA_KEY = (k: string) => `bill-ementa:v1:${k}`;
const HEADERS = { Accept: "application/json", "Accept-Language": "pt-BR", "User-Agent": "Mozilla/5.0 (compatible; PoliticaBot/1.0)" };

/** Procura um texto de ementa em qualquer nível de um JSON (as respostas do Senado variam de formato). */
function findEmenta(o: unknown, depth = 0): string | null {
  if (!o || typeof o !== "object" || depth > 8) return null;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (/^ementa$|^EmentaMateria$|^Ementa$/i.test(k) && typeof v === "string" && v.trim().length > 10) return v.trim();
  }
  for (const v of Object.values(o as Record<string, unknown>)) {
    const f = findEmenta(v, depth + 1);
    if (f) return f;
  }
  return null;
}

/** Ementa oficial: Câmara (numeração unificada desde 2019) e, se não achar, Senado. Guardada no banco. */
async function ementaOf(r: BillRef): Promise<string | null> {
  const hit = await db.explanation.findUnique({ where: { key: EMENTA_KEY(r.key) } });
  if (hit) return hit.text || null;
  let ementa: string | null = null;
    if (!["PLS", "PRS", "PLC"].includes(r.type)) {
    try {
      const res = await fetch(`https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=${r.type}&numero=${r.number}&ano=${r.year}`, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const j = (await res.json()) as { dados?: { ementa?: string }[] };
        ementa = j.dados?.find((d) => d.ementa)?.ementa?.trim() ?? null;
      }
    } catch {
      /* tenta o Senado */
    }
  }
  if (!ementa) {
    try {
      const res = await fetch(`https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista?sigla=${r.type}&numero=${r.number}&ano=${r.year}`, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
      if (res.ok) ementa = findEmenta(await res.json());
    } catch {
      /* sem ementa */
    }
  }
  // guarda também o "não achei" (texto vazio) para não consultar de novo a cada página
  await db.explanation.upsert({ where: { key: EMENTA_KEY(r.key) }, create: { key: EMENTA_KEY(r.key), kind: "bill-ementa", text: ementa ?? "" }, update: {} }).catch(() => undefined);
  return ementa;
}

const PROMPT = `Você dá nomes curtos a proposições legislativas brasileiras para leitores leigos.
Para cada item (sigla número/ano e a ementa oficial), escreva um rótulo em português com NO MÁXIMO 8 palavras dizendo do que se trata.
Se a proposição tiver um nome popular amplamente usado pelo governo, pelo Congresso ou pela imprensa (ex.: "PEC da Transição", "Reforma Tributária", "Marco Temporal", "PL das Fake News", "Isenção do IR até R$ 5 mil"), use esse nome.
Seja neutro e factual: sem opinião, sem adjetivos de valor, sem repetir a sigla nem o número. Primeira letra maiúscula, sem ponto final.
Responda SOMENTE um objeto JSON {"<sigla número/ano>": "<rótulo>"}.`;

/** Rótulo de ementa sem IA: as primeiras palavras da ementa. */
const fromEmenta = (e: string) => {
  const w = e.split(/\s+/);
  return w.length > 10 ? `${w.slice(0, 10).join(" ")}…` : e;
};

/**
 * Rótulos das proposições citadas nos textos. Usa o que já está no banco; com `generate`, busca ementas e gera os que
 * faltam (até `max` por chamada e dentro de `budgetMs`), o resto fica para a próxima vez.
 */
export async function billLabels(texts: string[], opts: { generate?: boolean; budgetMs?: number; max?: number } = {}): Promise<Map<string, string>> {
  const refs = new Map<string, BillRef>();
  for (const t of texts) for (const r of billRefs(t)) refs.set(r.key, r);
  const out = new Map<string, string>();
  if (!refs.size) return out;
  const rows = await db.explanation.findMany({ where: { key: { in: [...refs.keys()].map(LABEL_KEY) } } }).catch(() => []);
  for (const r of rows) out.set(r.key.slice(LABEL_KEY("").length), r.text);
  const missing = [...refs.values()].filter((r) => !out.has(r.key)).slice(0, opts.max ?? 15);
  if (!opts.generate || !missing.length) return out;

  const work = (async () => {
    const withEmenta: { r: BillRef; ementa: string }[] = [];
    for (const r of missing) {
      const e = await ementaOf(r);
      if (e) withEmenta.push({ r, ementa: e });
    }
    if (!withEmenta.length) return;
    let labels: Record<string, string> = {};
    if (aiEnabled()) {
      try {
        labels = extractJson<Record<string, string>>(await ask(PROMPT, JSON.stringify(Object.fromEntries(withEmenta.map((x) => [x.r.key, x.ementa.slice(0, 600)]))), 900, "explain"));
      } catch (err) {
        console.warn("[bills] rótulos", (err as Error).message);
      }
    }
    for (const { r, ementa } of withEmenta) {
      const ai = typeof labels[r.key] === "string" ? labels[r.key].trim().replace(/[.;]+$/, "") : "";
      const label = ai && ai.split(/\s+/).length <= 12 ? ai : null;
      if (label) {
        out.set(r.key, label);
        await db.explanation.upsert({ where: { key: LABEL_KEY(r.key) }, create: { key: LABEL_KEY(r.key), kind: "bill", text: label }, update: { text: label } }).catch(() => undefined);
      } else out.set(r.key, fromEmenta(ementa)); // sem IA: mostra o começo da ementa, sem guardar (a IA ainda pode gerar depois)
    }
  })();
  if (opts.budgetMs) await Promise.race([work, new Promise((r) => setTimeout(r, opts.budgetMs))]);
  else await work;
  return out;
}

/** "Aprovado o PL 1087/2025" → "Aprovado o PL 1087/2025 (Isenção do IR até R$ 5 mil)" — só na primeira menção de cada proposição. */
export function annotateBills(text: string, labels: Map<string, string>): string {
  if (!labels.size) return text;
  const seen = new Set<string>();
  return text.replace(RE, (m, t: string, n: string, y: string) => {
    const key = `${t.toUpperCase() === "MP" ? "MPV" : t.toUpperCase()} ${Number(n.replace(/\./g, ""))}/${fullYear(y)}`;
    const label = labels.get(key);
    if (!label || seen.has(key)) return m;
    seen.add(key);
    return `${m} (${label})`;
  });
}

/** Rótulos citados num texto, na ordem em que aparecem (para destacar acima da descrição). */
export function labelsIn(text: string, labels: Map<string, string>): { key: string; label: string }[] {
  return billRefs(text).filter((r) => labels.has(r.key)).map((r) => ({ key: r.key, label: labels.get(r.key)! }));
}
