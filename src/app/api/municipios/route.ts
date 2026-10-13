import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { listMunicipalities } from "@/lib/ibge";
import { UFS } from "@/lib/taxonomy";

export async function GET(req: Request) {
  if (!(await auth()).userId) return NextResponse.json([], { status: 401 });
  const uf = new URL(req.url).searchParams.get("uf")?.toUpperCase() ?? "";
  if (!(uf in UFS)) return NextResponse.json([], { status: 400 });
  try {
    return NextResponse.json((await listMunicipalities(uf)).map((m) => m.name));
  } catch {
    return NextResponse.json([], { status: 502 });
  }
}
