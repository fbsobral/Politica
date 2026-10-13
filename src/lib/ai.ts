import Anthropic from "@anthropic-ai/sdk";

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

/** Chama o modelo e devolve o texto da resposta. */
export async function ask(system: string, user: string, maxTokens = 4000): Promise<string> {
  const res = await getClient().messages.create({
    model: getModel(),
    max_tokens: maxTokens,
    // tarefas de classificação/resumo não precisam de raciocínio estendido (consumiria o orçamento de tokens)
    thinking: { type: "disabled" },
    system,
    messages: [{ role: "user", content: user }],
  });
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
