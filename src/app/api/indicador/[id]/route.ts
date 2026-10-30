import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { UF_CODE } from "@/lib/budget";
import { db } from "@/lib/db";
import { ibgeIdFor } from "@/lib/ibge";
import { INDICATORS, getSeries } from "@/lib/indicators/catalog";
import type { Scope } from "@/lib/indicators/core";

export const dynamic = "force-dynamic";

/** Detalhes de um indicador (texto da fonte e série), carregados só quando o usuário abre o item no Score. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const ind = INDICATORS.find((i) => i.id === id);
  if (!ind) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const scope = (["FEDERAL", "ESTADUAL", "MUNICIPAL"].includes(new URL(req.url).searchParams.get("scope") ?? "") ? new URL(req.url).searchParams.get("scope") : "FEDERAL") as Scope;
  const uf = user.uf ?? "";
  const geo = { uf, ufCode: UF_CODE[uf] ?? 0, ibge: String((await ibgeIdFor(uf, user.municipalityKey ?? "")) ?? ""), municipalityKey: user.municipalityKey ?? "" };
  const series = (await getSeries(ind, scope, geo, { lazy: true })) ?? {};
  return NextResponse.json({ id: ind.id, name: ind.name, desc: ind.desc, source: ind.source, sourceUrl: ind.sourceUrl ?? null, unit: ind.unit, decimals: ind.decimals ?? null, better: ind.better ?? null, series });
}
