import { db } from "@/lib/db";
import { electedHeads } from "@/lib/politicians/tse";
import type { Geo, Scope } from "./core";

export type TermName = { from: number; to: number; name: string; party: string | null };

const GOV_YEARS = [2006, 2010, 2014, 2018, 2022];
const MAYOR_YEARS = [2004, 2008, 2012, 2016, 2020, 2024];

const key = (scope: Scope, place: string) => `terms:v1:${scope}:${place}`;

/** Nomes dos eleitos já gravados pelo job (nunca baixa nada durante a visita). */
export async function getTermNames(scope: Scope, geo: Geo): Promise<TermName[]> {
  if (scope === "FEDERAL") return [];
  const hit = await db.budgetCache.findUnique({ where: { key: key(scope, scope === "ESTADUAL" ? geo.uf : geo.ibge) } });
  return (hit?.data as unknown as TermName[] | undefined) ?? [];
}

async function put(k: string, data: TermName[]) {
  if (!data.length) return;
  await db.budgetCache.upsert({ where: { key: k }, create: { key: k, data: data as never }, update: { data: data as never, fetchedAt: new Date() } });
}

/** Governadores (por UF) e prefeitos (por município) eleitos desde 2004, a partir dos arquivos de candidaturas do TSE. O mandato vai de janeiro do ano seguinte à eleição por 4 anos. */
export async function refreshMandates(geos: Geo[]): Promise<{ written: number; failed: string[] }> {
  let written = 0;
  const failed: string[] = [];
  const ufs = [...new Set(geos.map((g) => g.uf))];
  for (const uf of ufs) {
    const list: TermName[] = [];
    for (const year of GOV_YEARS) {
      try {
        for (const h of await electedHeads(year, uf, "GOVERNADOR")) list.push({ from: year + 1, to: year + 4, name: h.name, party: h.party });
      } catch (err) {
        failed.push(`gov:${uf}:${year}`);
        console.warn("[mandates]", uf, year, (err as Error).message);
      }
    }
    await put(key("ESTADUAL", uf), list);
    if (list.length) written++;
    const mayors = geos.filter((g) => g.uf === uf);
    const byMun = new Map<string, TermName[]>();
    for (const year of MAYOR_YEARS) {
      try {
        const heads = await electedHeads(year, uf, "PREFEITO");
        for (const g of mayors) for (const h of heads.filter((x) => x.municipalityKey === g.municipalityKey)) byMun.set(g.ibge, [...(byMun.get(g.ibge) ?? []), { from: year + 1, to: year + 4, name: h.name, party: h.party }]);
      } catch (err) {
        failed.push(`pref:${uf}:${year}`);
        console.warn("[mandates]", uf, year, (err as Error).message);
      }
    }
    for (const [ibge, l] of byMun) {
      await put(key("MUNICIPAL", ibge), l);
      written++;
    }
  }
  return { written, failed };
}
