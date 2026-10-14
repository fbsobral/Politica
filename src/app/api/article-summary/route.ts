import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { summarizeArticle } from "@/lib/article-content";
import { allow } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!allow(`summary:${userId}`, 120)) return NextResponse.json({ error: "muitas solicitações" }, { status: 429 });
  const { id } = ((await req.json().catch(() => ({}))) ?? {}) as { id?: string };
  if (!id || typeof id !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const result = await summarizeArticle(id);
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(result);
}
