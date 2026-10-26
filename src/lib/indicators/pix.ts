import { db } from "@/lib/db";
import { lastClosedYear, type Geo, type YearSeries } from "./core";

const BASE = "https://olinda.bcb.gov.br/olinda/servico/Pix_DadosAbertos/versao/v1/odata";
const FIRST_YEAR = 2021; // o Pix começou em novembro de 2020; o primeiro ano completo é 2021

async function olinda<T>(path: string): Promise<T[]> {
  const res = await fetch(`${BASE}/${path}`, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PoliticaBot/1.0)" }, signal: AbortSignal.timeout(240000) });
  if (!res.ok) throw new Error(`Olinda HTTP ${res.status}`);
  return ((await res.json()) as { value: T[] }).value;
}

async function put(key: string, data: unknown) {
  await db.budgetCache.upsert({ where: { key }, create: { key, data: data as never }, update: { data: data as never, fetchedAt: new Date() } });
}

const sum = (rows: { year: number; v: number; q: number }[]) => {
  const v: YearSeries = {};
  const q: YearSeries = {};
  for (const r of rows) {
    v[r.year] = (v[r.year] ?? 0) + r.v;
    q[r.year] = (q[r.year] ?? 0) + r.q;
  }
  return { v, q };
};

/** Total nacional de um mês (guardado para sempre: mês fechado não muda). */
async function nationalMonth(ym: number): Promise<{ v: number; q: number } | null> {
  const key = `ind:v1:pixm:${ym}`;
  const hit = await db.budgetCache.findUnique({ where: { key } });
  if (hit) return hit.data as unknown as { v: number; q: number };
  const rows = await olinda<{ VALOR: number; QUANTIDADE: number }>(`EstatisticasTransacoesPix(Database=@Database)?@Database='${ym}'&$format=json&$filter=AnoMes%20eq%20${ym}&$top=500000`);
  if (!rows.length) return null;
  const out = { v: rows.reduce((a, r) => a + r.VALOR, 0), q: rows.reduce((a, r) => a + r.QUANTIDADE, 0) };
  await put(key, out);
  return out;
}

type MuniRow = { AnoMes: number; VL_PagadorPF: number; VL_PagadorPJ: number; QT_PagadorPF: number; QT_PagadorPJ: number };

const fromMuni = (rows: MuniRow[], to: number) =>
  sum(rows.map((r) => ({ year: Math.floor(r.AnoMes / 100), v: r.VL_PagadorPF + r.VL_PagadorPJ, q: r.QT_PagadorPF + r.QT_PagadorPJ })).filter((r) => r.year >= FIRST_YEAR && r.year <= to));

/** Pix por ano: Brasil (soma dos meses), estados e municípios (base por município do BCB). */
export async function refreshPix(geos: Geo[]): Promise<{ written: number; failed: string[] }> {
  const to = lastClosedYear();
  let written = 0;
  const failed: string[] = [];
  try {
    const rows: { year: number; v: number; q: number }[] = [];
    for (let y = FIRST_YEAR; y <= to; y++) {
      for (let m = 1; m <= 12; m++) {
        const t = await nationalMonth(y * 100 + m);
        if (t) rows.push({ year: y, ...t });
      }
    }
    const { v, q } = sum(rows);
    await put("ind:v1:pix:FEDERAL:br", v);
    await put("ind:v1:pix-n:FEDERAL:br", q);
    written += 2;
  } catch (err) {
    console.warn("[indicators:pix] Brasil", (err as Error).message);
    failed.push("pix:FEDERAL");
  }
  const ufs = [...new Set(geos.map((g) => g.uf))];
  for (const uf of ufs) {
    const geo = geos.find((g) => g.uf === uf)!;
    try {
      const rows = await olinda<MuniRow>(`TransacoesPixPorMunicipio(DataBase=@DataBase)?@DataBase='${FIRST_YEAR}01'&$format=json&$filter=Estado_Ibge%20eq%20${geo.ufCode}&$top=500000`);
      const { v, q } = fromMuni(rows, to);
      await put(`ind:v1:pix:ESTADUAL:${uf}`, v);
      await put(`ind:v1:pix-n:ESTADUAL:${uf}`, q);
      written += 2;
    } catch (err) {
      console.warn("[indicators:pix]", uf, (err as Error).message);
      failed.push(`pix:ESTADUAL:${uf}`);
    }
  }
  for (const g of geos) {
    try {
      const rows = await olinda<MuniRow>(`TransacoesPixPorMunicipio(DataBase=@DataBase)?@DataBase='${FIRST_YEAR}01'&$format=json&$filter=Municipio_Ibge%20eq%20${g.ibge}`);
      const { v, q } = fromMuni(rows, to);
      await put(`ind:v1:pix:MUNICIPAL:${g.ibge}`, v);
      await put(`ind:v1:pix-n:MUNICIPAL:${g.ibge}`, q);
      written += 2;
    } catch (err) {
      console.warn("[indicators:pix]", g.ibge, (err as Error).message);
      failed.push(`pix:MUNICIPAL:${g.ibge}`);
    }
  }
  return { written, failed };
}
