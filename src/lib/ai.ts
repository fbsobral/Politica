import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

let client: Anthropic | null = null;

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
}

export function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/** Tipos de uso, para acompanhar onde os créditos vão. */
export type AiKind = "classify" | "sources" | "tiers" | "summary" | "explain" | "digest" | "other";

/** Lançada quando o orçamento diário de tokens configurado no painel foi atingido. */
export class BudgetError extends Error {
  constructor() {
    super("Orçamento diário de tokens da IA atingido");
    this.name = "BudgetError";
  }
}

let budgetCache: { at: number; used: number; budget: number } | null = null;

/** Tokens (entrada + saída) usados nas últimas 24 h. */
export async function tokensLast24h(): Promise<number> {
  const r = await db.aiUsage.aggregate({ where: { at: { gte: new Date(Date.now() - 24 * 3600 * 1000) } }, _sum: { inputTokens: true, outputTokens: true } });
  return (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0);
}

async function assertBudget(): Promise<void> {
  if (!budgetCache || Date.now() - budgetCache.at > 60_000) {
    const row = await db.setting.findUnique({ where: { key: "aiDailyTokenBudget" } });
    const budget = Number(row?.value) || 0;
    budgetCache = { at: Date.now(), budget, used: budget > 0 ? await tokensLast24h() : 0 };
  }
  if (budgetCache.budget > 0 && budgetCache.used >= budgetCache.budget) throw new BudgetError();
}

/**
 * Chama o modelo e devolve o texto da resposta. Registra o uso de tokens e respeita o orçamento diário
 * (se estourar, lança BudgetError — quem chama já tem fallback sem IA).
 * `cacheSystem`: marca o prompt de sistema para cache (mais barato nas chamadas seguintes, quando o modelo suporta).
 */
export async function ask(system: string, user: string, maxTokens = 4000, kind: AiKind = "other", cacheSystem = false): Promise<string> {
  await assertBudget();
  const res = await getClient().messages.create({
    model: getModel(),
    max_tokens: maxTokens,
    // tarefas de classificação/resumo não precisam de raciocínio estendido (consumiria o orçamento de tokens)
    thinking: { type: "disabled" },
    system: cacheSystem ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] : system,
    messages: [{ role: "user", content: user }],
  });
  const u = res.usage;
  const used = (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  if (budgetCache) budgetCache.used += used;
  db.aiUsage
    .create({ data: { kind, model: getModel(), inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), outputTokens: u.output_tokens ?? 0, cachedTokens: u.cache_read_input_tokens ?? 0 } })
    .catch(() => undefined);
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Extrai o primeiro JSON (objeto ou array) de uma resposta, tolerando cercas de código. */
export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.search(/[\[{]/);
  if (start === -1) throw new Error("Resposta sem JSON");
  const open = cleaned[start];
  const close = open === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(close);
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}
