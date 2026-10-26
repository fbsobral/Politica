import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { aiEnabled, BudgetError } from "@/lib/ai";
import { db } from "@/lib/db";
import { allow } from "@/lib/rate-limit";
import { runAgent, type ChatMessage } from "@/lib/agent/run";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function dayStartSP(): Date {
  const ymd = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return new Date(`${ymd}T00:00:00-03:00`);
}

async function remainingToday(userId: string, limit: number): Promise<number | null> {
  if (limit <= 0) return null;
  const used = await db.chatTurn.count({ where: { userId, at: { gte: dayStartSP() } } });
  return Math.max(0, limit - used);
}

/** GET: quantas mensagens ainda restam hoje. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cfg = await getSettings();
  return NextResponse.json({ enabled: aiEnabled(), remaining: await remainingToday(user.id, Number(cfg.chatDailyLimit) || 0) });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!aiEnabled()) return NextResponse.json({ error: "O assistente está indisponível agora." }, { status: 503 });
  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!allow(`agent:${userId}`, 12, 60_000)) return NextResponse.json({ error: "Muitas mensagens seguidas. Espere um pouco." }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { message?: string; history?: ChatMessage[]; page?: string; focus?: string } | null;
  const message = String(body?.message ?? "").trim().slice(0, 1000);
  if (message.length < 2) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const history = (Array.isArray(body?.history) ? body!.history : [])
    .filter((m): m is ChatMessage => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .slice(-8);

  const cfg = await getSettings();
  const limit = Number(cfg.chatDailyLimit) || 0;
  const left = await remainingToday(user.id, limit);
  if (left !== null && left <= 0) return NextResponse.json({ error: `Você usou as ${limit} mensagens de hoje. Volte amanhã.`, remaining: 0 }, { status: 429 });

  try {
    const r = await runAgent(user, history, message, typeof body?.page === "string" ? body.page.slice(0, 200) : undefined, typeof body?.focus === "string" ? body.focus.slice(0, 2800) : undefined);
    return NextResponse.json({ text: r.text, sources: r.sources, remaining: left === null ? null : Math.max(0, left - 1) });
  } catch (err) {
    if (err instanceof BudgetError) return NextResponse.json({ error: "O limite diário de IA do app foi atingido. Tente mais tarde." }, { status: 503 });
    console.warn("[agent]", (err as Error).message);
    return NextResponse.json({ error: "Falha ao responder. Tente de novo." }, { status: 502 });
  }
}
