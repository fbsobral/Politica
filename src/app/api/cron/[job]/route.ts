import { NextResponse } from "next/server";
import { JOBS, runJob, type JobName } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Gatilho HTTP para agendadores externos (ex.: Scheduled Task do Coolify): Authorization: Bearer $CRON_SECRET */
export async function POST(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
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
