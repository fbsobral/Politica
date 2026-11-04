import { auth } from "@clerk/nextjs/server";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { aiEnabled, ask } from "@/lib/ai";
import { db } from "@/lib/db";
import { getIbovespa, THEMES } from "@/lib/ibovespa";
import { allow } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const PROMPT = `Você é um analista que explica a cidadãos leigos por que a bolsa brasileira (Ibovespa) subiu ou caiu num dia. Recebe a variação do dia, sinais objetivos (dólar, decisões do Copom) e as manchetes publicadas entre o fechamento anterior e o fim do pregão.
Escreva em português, 3 a 4 frases simples e neutras, sem markdown:
1) o provável motivo, apoiado SOMENTE nas manchetes e sinais recebidos (cite o assunto das manchetes que sustentam a inferência);
2) o grau de confiança (alto, médio ou baixo) e por quê;
3) se as manchetes não explicarem o movimento, diga claramente que não há evidência suficiente nas notícias coletadas e cite fatores comuns sem afirmar que ocorreram.
Não invente números, empresas ou fatos que não estejam no texto. Não dê recomendação de investimento.`;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!allow(`ibov:${userId}`, 60)) return NextResponse.json({ error: "muitas solicitações" }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { d?: string } | null;
  const d = body?.d ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const data = await getIbovespa();
  const m = data?.moves.find((x) => x.d === d);
  if (!m) return NextResponse.json({ error: "dia não encontrado" }, { status: 404 });

  const key = createHash("sha1").update(`ibov:${d}:${m.articles.map((a) => a.id).join(",")}:${m.signals.map((s) => s.text).join("|")}`).digest("hex");
  const hit = await db.explanation.findUnique({ where: { key } });
  if (hit) return NextResponse.json({ text: hit.text });
  if (!aiEnabled()) return NextResponse.json({ error: "IA indisponível" }, { status: 503 });

  const name = (id: string) => THEMES.find((t) => t.id === id)?.name ?? id;
  const text = [
    `Data: ${d}. Ibovespa: ${m.ret >= 0 ? "+" : ""}${m.ret.toFixed(2)}% (fechou em ${m.close.toLocaleString("pt-BR")} pontos).`,
    m.signals.length ? `Sinais: ${m.signals.map((s) => s.text).join("; ")}.` : "Sinais: nenhum sinal objetivo forte (dólar estável, sem decisão do Copom).",
    m.articles.length ? `Manchetes (fonte):\n${m.articles.map((a) => `- ${a.title} (${a.source})${a.themes.length ? ` [temas: ${a.themes.map(name).join(", ")}]` : ""}`).join("\n")}` : "Manchetes: nenhuma matéria de economia ou mercado coletada nessa janela.",
  ].join("\n");
  try {
    const out = (await ask(PROMPT, text, 400, "explain")).trim();
    if (!out) throw new Error("vazio");
    await db.explanation.upsert({ where: { key }, create: { key, kind: "ibov", text: out }, update: {} });
    return NextResponse.json({ text: out });
  } catch (err) {
    console.warn("[ibov:explain]", (err as Error).message);
    return NextResponse.json({ error: "falha ao gerar" }, { status: 502 });
  }
}
