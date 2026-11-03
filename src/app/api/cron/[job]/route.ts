import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { allow } from "@/lib/rate-limit";
import { JOBS, runJob, type JobName } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Gatilho HTTP para agendadores externos (ex.: Scheduled Task do Coolify): Authorization: Bearer $CRON_SECRET */
export async function POST(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (!allow(`cron:${ip}`, 30, 60_000)) return NextResponse.json({ error: "muitas tentativas" }, { status: 429 });
  const secret = process.env.CRON_SECRET;
  // compara hashes (mesmo tamanho) em tempo constante, para não vazar o segredo por diferença de tempo
  const sent = createHash("sha256").update(req.headers.get("authorization") ?? "").digest();
  const want = createHash("sha256").update(`Bearer ${secret ?? ""}`).digest();
  if (!secret || !timingSafeEqual(sent, want)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { job } = await params;
  if (!(job in JOBS)) return NextResponse.json({ error: "job desconhecido" }, { status: 404 });
  try {
    return NextResponse.json({ result: await runJob(job as JobName) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
