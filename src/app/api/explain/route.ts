import { auth } from "@clerk/nextjs/server";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { aiEnabled, ask } from "@/lib/ai";
import { db } from "@/lib/db";
import { allow } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const PROMPTS: Record<string, string> = {
  budget: `Você explica a cidadãos leigos o orçamento público brasileiro. A partir do texto abaixo (um item do orçamento — função, subfunção, fonte de receita, tributo ou tipo de gasto — e o nível de governo), escreva 2 a 3 frases simples e neutras em português: o que é esse item, o que entra nele e por que importa para o cidadão. Explique o conceito em geral; NÃO invente detalhes sobre o município, estado ou governo específico e não dê opinião. Sem markdown.`,
  vote: `Você explica a cidadãos leigos o que foi uma votação no Congresso Nacional do Brasil. A partir do texto abaixo, escreva 2 a 4 frases simples e neutras em português: o que estava sendo votado, para que serve e o que o resultado significa. Defina siglas (PL, PLP, PEC, PDL, MPV, REQ...) em palavras comuns. Não invente detalhes que não estejam no texto e não dê opinião. Sem markdown.`,
  event: `Você explica a cidadãos leigos o que é um evento da agenda do Congresso Nacional (sessão, audiência pública, reunião de comissão). A partir do texto abaixo, escreva 2 a 3 frases simples e neutras em português: o que é esse tipo de evento, o que será discutido e por que importa. Defina siglas. Não invente detalhes que não estejam no texto e não dê opinião. Sem markdown.`,
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!allow(`explain:${userId}`, 120)) return NextResponse.json({ error: "muitas solicitações" }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { kind?: string; text?: string } | null;
  const kind = body?.kind ?? "";
  const text = (body?.text ?? "").trim().slice(0, 900);
  if (!(kind in PROMPTS) || text.length < 8) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const key = createHash("sha1").update(`${kind}:${text}`).digest("hex");
  const hit = await db.explanation.findUnique({ where: { key } });
  if (hit) return NextResponse.json({ text: hit.text });
  if (!aiEnabled()) return NextResponse.json({ error: "IA indisponível" }, { status: 503 });

  try {
    const out = (await ask(PROMPTS[kind], text, 350, "explain")).trim();
    if (!out) throw new Error("vazio");
    await db.explanation.upsert({ where: { key }, create: { key, kind, text: out }, update: {} });
    return NextResponse.json({ text: out });
  } catch (err) {
    console.warn("[explain]", (err as Error).message);
    return NextResponse.json({ error: "falha ao gerar" }, { status: 502 });
  }
}
