import { UF_CODE } from "@/lib/budget";
import { db } from "@/lib/db";
import { ibgeIdFor } from "@/lib/ibge";
import { INDICATORS, getSeries } from "./catalog";
import type { Geo, Scope } from "./core";
import { refreshIpea } from "./ipea";

/** Atualiza os indicadores de todos os locais usados: baixa os arquivos grandes do IPEA e aquece o cache das demais fontes. */
export async function refreshIndicators(): Promise<{ places: number; ipeaKeys: number; series: number; failed: string[] }> {
  const users = await db.user.findMany({ where: { uf: { not: null }, municipalityKey: { not: null } }, select: { uf: true, municipalityKey: true }, distinct: ["uf", "municipalityKey"] });
  const geos: Geo[] = [];
  for (const u of users) {
    const ibge = await ibgeIdFor(u.uf!, u.municipalityKey!);
    if (ibge) geos.push({ uf: u.uf!, ufCode: UF_CODE[u.uf!] ?? 0, ibge: String(ibge), municipalityKey: u.municipalityKey! });
  }
  const ipea = await refreshIpea(geos.map((g) => g.ibge));
  const failed = [...ipea.failed];
  let series = 0;
  const doneStates = new Set<string>();
  let federalDone = false;
  for (const geo of geos) {
    for (const ind of INDICATORS.filter((i) => !i.fed)) {
      for (const scope of ["FEDERAL", "ESTADUAL", "MUNICIPAL"] as Scope[]) {
        if (!ind.fetch[scope]) continue;
        if (scope === "FEDERAL" && federalDone) continue;
        if (scope === "ESTADUAL" && doneStates.has(`${ind.id}:${geo.uf}`)) continue;
        try {
          if (await getSeries(ind, scope, geo, { force: true })) series++;
          else failed.push(`${ind.id}:${scope}`);
        } catch (err) {
          failed.push(`${ind.id}:${scope}`);
          console.warn("[indicators:job]", ind.id, scope, (err as Error).message);
        }
        if (scope === "ESTADUAL") doneStates.add(`${ind.id}:${geo.uf}`);
      }
    }
    federalDone = true;
  }
  // as fontes (principalmente o Banco Central) falham em rajadas: uma segunda passada, depois de uma pausa, recupera quase tudo
  if (failed.some((f) => f.includes(":"))) {
    await new Promise((r) => setTimeout(r, 30_000));
    for (const f of [...failed]) {
      const [id, scope] = f.split(":") as [string, Scope];
      const ind = INDICATORS.find((i) => i.id === id);
      const geo = geos[0];
      if (!ind || !scope || !geo) continue;
      try {
        if (await getSeries(ind, scope, geo, { force: true })) {
          series++;
          failed.splice(failed.indexOf(f), 1);
        }
      } catch {
        /* continua falhando */
      }
    }
  }
  return { places: geos.length, ipeaKeys: ipea.written, series, failed: failed.slice(0, 20) };
}
