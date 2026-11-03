import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { UF_CODE } from "@/lib/budget";
import { db } from "@/lib/db";
import { allow } from "@/lib/rate-limit";
import { ibgeIdFor } from "@/lib/ibge";
import { SCOPE_SLUG } from "@/lib/taxonomy";
import type { Scope } from "@/lib/indicators/core";
import { lastClosedYear, YEARS_BACK } from "@/lib/indicators/core";
import { formatValue } from "@/lib/indicators/format";
import { computeScore, defaultSelection, type ScoreMethod } from "@/lib/indicators/score";

export const dynamic = "force-dynamic";

/** Campo de CSV entre aspas; textos que começam com = + @ ou tab viram texto puro (evita "injeção de fórmula" no Excel). */
const q = (v: string | number | null | undefined) => {
  if (v == null) return "";
  let t = String(v);
  if (/^[=+@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
};

/** Todos os números do score com a fonte de cada um, ano a ano (CSV). */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!allow(`csv:${userId}`, 10, 60_000)) return NextResponse.json({ error: "muitas solicitações" }, { status: 429 });
  const slug = new URL(req.url).searchParams.get("esfera") ?? "federal";
  const scope = (SCOPE_SLUG[slug] as Scope | undefined) ?? "FEDERAL";
  const uf = user.uf ?? "";
  const geo = { uf, ufCode: UF_CODE[uf] ?? 0, ibge: String((await ibgeIdFor(uf, user.municipalityKey ?? "")) ?? ""), municipalityKey: user.municipalityKey ?? "" };
  const cfg = (user.scoreConfig ?? {}) as Record<string, unknown>;
  const custom = cfg[scope] as string[] | undefined;
  const selected = custom?.length ? custom : defaultSelection(scope);
  const method: ScoreMethod = cfg.method === "nivel" ? "nivel" : "nivel-avanco";
  const r = await computeScore(scope, geo, selected, lastClosedYear() - YEARS_BACK + 1, [], (cfg.targets ?? {}) as Record<string, number>, method);
  const lines = [["indicador", "lado", "ano", "valor", "nota_0_a_100", "meta", "tipo_de_meta", "considerado_no_score", "fonte", "link_da_fonte"].join(",")];
  for (const i of r.items) {
    for (const y of Object.keys(i.values).map(Number).sort((a, b) => a - b)) {
      lines.push([
        q(i.name), q(i.side === "economia" ? "econômico" : "social"), y, q(formatValue(i.values[y], i.unit, i.decimals ?? 2)),
        i.notes[y] != null ? Math.round(i.notes[y]) : "", i.target != null ? q(formatValue(i.target, i.unit, i.decimals ?? 2)) : "",
        q(i.targetMode ?? "sem meta"), i.considered ? "sim" : "não", q(i.source), q(i.sourceUrl),
      ].join(","));
    }
  }
  return new NextResponse("﻿" + lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="score-${slug}.csv"` } });
}
