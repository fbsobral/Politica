import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { modelSettingKey, type AiKind } from "@/lib/ai-kinds";

let client: Anthropic | null = null;

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const DEFAULT_MODEL = "claude-haiku-5-5";

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

let modelCache: { at: number; map: Record<string, string> } | null = null;

/** Modelo de um uso da IA: o escolhido para ele no admin, senão o padrão do admin, senão ANTHROPIC_MODEL, senão Haiku. */
export async function getModelFor(kind: AiKind): Promise<string> {
  if (!modelCache || Date.now() - modelCache.at > 60_000) {
    const rows = await db.setting.findMany({ where: { key: { startsWith: "aiModel" } } });
    modelCache = { at: Date.now(), map: Object.fromEntries(rows.map((r) => [r.key, r.value.trim()])) };
  }
  return modelCache.map[modelSettingKey(kind)] || modelCache.map.aiModel || getModel();
}

/** Zera o cache de modelos (chamado ao salvar as configurações). */
export function resetModelCache(): void {
  modelCache = null;
}

export function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export type { AiKind };

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
  const model = await getModelFor(kind);
  const res = await getClient().messages.create({
    model,
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
    .create({ data: { kind, model, inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), outputTokens: u.output_tokens ?? 0, cachedTokens: u.cache_read_input_tokens ?? 0 } })
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

export type ChatResult = { message: Anthropic.Message; model: string };

/**
 * Uma volta de conversa com ferramentas (usada pelo agente). Respeita o orçamento diário e o modelo escolhido para o uso "chat" no admin.
 * O uso de tokens é devolvido em `message.usage` e registrado em AiUsage.
 */
export async function chatCompletion(params: { system: Anthropic.TextBlockParam[]; tools: Anthropic.Tool[]; messages: Anthropic.MessageParam[]; maxTokens?: number }): Promise<ChatResult> {
  await assertBudget();
  const model = await getModelFor("chat");
  const message = await getClient().messages.create({
    model,
    max_tokens: params.maxTokens ?? 800,
    thinking: { type: "disabled" },
    system: params.system,
    tools: params.tools,
    messages: params.messages,
  });
  const u = message.usage;
  const used = (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  if (budgetCache) budgetCache.used += used;
  db.aiUsage
    .create({ data: { kind: "chat", model, inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), outputTokens: u.output_tokens ?? 0, cachedTokens: u.cache_read_input_tokens ?? 0 } })
    .catch(() => undefined);
  return { message, model };
}
