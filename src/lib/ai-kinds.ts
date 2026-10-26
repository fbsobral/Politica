/** Onde o app usa IA. Cada uso pode ter um modelo próprio (Admin → Robô → Modelos de IA). */
export const AI_KINDS = [
  { kind: "classify", label: "Classificar notícias", hint: "Esfera, categoria e poder de cada notícia (volume alto: prefira um modelo barato)." },
  { kind: "sources", label: "Tipo dos veículos", hint: "Descobre se um veículo novo é jornal, TV, blog…" },
  { kind: "tiers", label: "Nível (tier) dos veículos", hint: "Sugere o tier 1, 2 ou 3 de veículos desconhecidos." },
  { kind: "summary", label: "Resumos de notícias", hint: "Resumo curto de cada matéria aberta pelo usuário." },
  { kind: "explain", label: "“O que é isso?”", hint: "Explicações de votações, eventos e itens do orçamento." },
  { kind: "digest", label: "Resumos por e-mail", hint: "Parágrafos dos resumos diário, semanal e mensal." },
  { kind: "chat", label: "Agente de conversa", hint: "Conversa com o usuário, com contexto e ferramentas." },
  { kind: "other", label: "Outros usos", hint: "Qualquer chamada sem tipo definido." },
] as const;

export type AiKind = (typeof AI_KINDS)[number]["kind"];

export const AI_MODEL_SUGGESTIONS = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5-1"];

export const modelSettingKey = (kind: AiKind) => `aiModel_${kind}` as const;
