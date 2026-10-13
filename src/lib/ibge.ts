import { normalize } from "@/lib/text";

export type Municipality = { name: string; key: string };

const cache = new Map<string, { at: number; data: Municipality[] }>();
const TTL = 1000 * 60 * 60 * 24;

/** Municípios de uma UF (API pública do IBGE, com cache em memória). */
export async function listMunicipalities(uf: string): Promise<Municipality[]> {
  const hit = cache.get(uf);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`,
    { next: { revalidate: 86400 } },
  );
  if (!res.ok) throw new Error(`IBGE ${res.status}`);
  const json = (await res.json()) as { nome: string }[];
  const data = json.map((m) => ({ name: m.nome, key: normalize(m.nome) }));
  cache.set(uf, { at: Date.now(), data });
  return data;
}
