import { UF_CODE } from "@/lib/budget";
import { db } from "@/lib/db";
import { clip, lastClosedYear, YEARS_BACK, type YearSeries } from "./core";

/** Séries do IPEA (Ipeadata, OData) que o job grava no banco, por local. */
export const IPEA_SERIES = [
  { id: "homicidios", code: "AVIOL12_THOMIC" },
  { id: "homicidios-n", code: "AVIOL12_HOMIC" },
  { id: "pobreza", code: "PNADCA_TXPNUF" },
  { id: "pobreza-int", code: "PNADCA_TXPIUF" },
  { id: "analfabetismo", code: "PNADCA_TXA15MUF" },
  { id: "mortalidade-infantil", code: "DEPIS_TMI" },
] as const;

type Row = { VALDATA: string; VALVALOR: number | null; NIVNOME: string; TERCODIGO: string };

const SIGLA_BY_CODE = Object.fromEntries(Object.entries(UF_CODE).map(([sigla, code]) => [String(code), sigla]));

async function download(code: string): Promise<Row[]> {
  // o IPEA não filtra no servidor: o arquivo vem inteiro (até ~70 MB e mais de 1 minuto); por isso só o job baixa
  const res = await fetch(`http://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='${code}')`, { signal: AbortSignal.timeout(240000), headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`IPEA ${code}: HTTP ${res.status}`);
  return ((await res.json()) as { value: Row[] }).value;
}

async function put(key: string, data: YearSeries) {
  if (!Object.keys(data).length) return;
  await db.budgetCache.upsert({ where: { key }, create: { key, data: data as never }, update: { data: data as never, fetchedAt: new Date() } });
}

/** Baixa as séries do IPEA e grava Brasil, todas as UFs e os municípios pedidos. Devolve quantas chaves gravou. */
export async function refreshIpea(municipalities: string[], only?: string[]): Promise<{ written: number; failed: string[] }> {
  const from = lastClosedYear() - YEARS_BACK + 1;
  const to = lastClosedYear() + 1;
  const wanted = new Set(municipalities);
  let written = 0;
  const failed: string[] = [];
  for (const s of IPEA_SERIES.filter((x) => !only || only.includes(x.id))) {
    try {
      const rows = await download(s.code);
      const by = new Map<string, YearSeries>();
      for (const r of rows) {
        if (r.VALVALOR === null || r.VALVALOR === undefined) continue;
        let place: string | null = null;
        if (r.NIVNOME === "Brasil" || r.NIVNOME === "" || r.NIVNOME === null) place = `FEDERAL:br`;
        else if (r.NIVNOME === "Estados" && SIGLA_BY_CODE[r.TERCODIGO]) place = `ESTADUAL:${SIGLA_BY_CODE[r.TERCODIGO]}`;
        else if (r.NIVNOME === "Municípios" && wanted.has(r.TERCODIGO)) place = `MUNICIPAL:${r.TERCODIGO}`;
        if (!place) continue;
        const year = Number(r.VALDATA.slice(0, 4));
        const m = by.get(place) ?? {};
        m[year] = r.VALVALOR;
        by.set(place, m);
      }
      for (const [place, series] of by) {
        await put(`ind:v1:${s.id}:${place}`, clip(series, from, to));
        written++;
      }
    } catch (err) {
      console.warn("[indicators:ipea]", s.code, (err as Error).message);
      failed.push(s.id);
    }
  }
  return { written, failed };
}
