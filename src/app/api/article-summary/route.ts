import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { summarizeArticle } from "@/lib/article-content";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await auth()).userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = ((await req.json().catch(() => ({}))) ?? {}) as { id?: string };
  if (!id || typeof id !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const result = await summarizeArticle(id);
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(result);
}
