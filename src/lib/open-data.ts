import { ibgeIdFor } from "@/lib/ibge";

const HEADERS = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; PoliticaBot/1.0)" };
const HOUR = 60 * 60;

async function getJson<T>(url: string, revalidate = 6 * HOUR): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, next: { revalidate }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/* ───────── Câmara dos Deputados ───────── */
const CAMARA = "https://dadosabertos.camara.leg.br/api/v2";

export type Bill = { id: string; title: string; ementa: string; year: number | null; url: string };

export async function camaraBills(deputyId: string): Promise<Bill[]> {
  const j = await getJson<{ dados: any[] }>(`${CAMARA}/proposicoes?idDeputadoAutor=${deputyId}&itens=40&ordem=DESC&ordenarPor=id`);
  return j.dados
    .filter((p) => !/^(RQ|REQ|RPD|INC|REL)/i.test(p.siglaTipo)) // só projetos (não requerimentos)
    .slice(0, 10)
    .map((p) => ({
      id: String(p.id),
      title: `${p.siglaTipo} ${p.numero}/${p.ano}`,
      ementa: p.ementa,
      year: p.ano || null,
      url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
    }));
}

export type Spending = { year: number; total: number; byType: { type: string; total: number }[]; count: number };

/** Gastos da cota parlamentar do ano; devolve null se a API não tiver dados. */
export async function camaraSpending(deputyId: string): Promise<Spending | null> {
  const year = new Date().getFullYear();
  for (const y of [year, year - 1]) {
    const all: { tipoDespesa: string; valorLiquido: number }[] = [];
    for (let page = 1; page <= 5; page++) {
      const j = await getJson<{ dados: any[] }>(`${CAMARA}/deputados/${deputyId}/despesas?ano=${y}&itens=100&pagina=${page}`, 12 * HOUR);
      all.push(...j.dados);
      if (j.dados.length < 100) break;
    }
    if (!all.length) continue;
    const by = new Map<string, number>();
    let total = 0;
    for (const d of all) {
      total += d.valorLiquido;
      by.set(d.tipoDespesa, (by.get(d.tipoDespesa) ?? 0) + d.valorLiquido);
    }
    return { year: y, total, count: all.length, byType: [...by.entries()].map(([type, t]) => ({ type, total: t })).sort((a, b) => b.total - a.total).slice(0, 6) };
  }
  return null;
}

export type AgendaEvent = { id: number; start: string; type: string; description: string; situation: string; place: string | null; organ: string | null };

export async function camaraAgenda(days = 10): Promise<AgendaEvent[]> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const from = new Date();
  const to = new Date(Date.now() + days * 86400000);
  const j = await getJson<{ dados: any[] }>(`${CAMARA}/eventos?dataInicio=${fmt(from)}&dataFim=${fmt(to)}&itens=100&ordem=ASC&ordenarPor=dataHoraInicio`, HOUR);
  return j.dados
    .filter((e) => !/cancelad/i.test(e.situacao))
    .map((e) => ({
      id: e.id,
      start: e.dataHoraInicio,
      type: e.descricaoTipo,
      description: e.descricao,
      situation: e.situacao,
      place: e.localCamara?.nome ?? e.localExterno ?? null,
      organ: e.orgaos?.[0]?.sigla ?? null,
    }));
}

export type PlenaryVote = { id: string; date: string; description: string; approved: boolean | null; organ: string };

export async function camaraVotes(days = 45): Promise<PlenaryVote[]> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const j = await getJson<{ dados: any[] }>(
    `${CAMARA}/votacoes?dataInicio=${fmt(new Date(Date.now() - days * 86400000))}&dataFim=${fmt(new Date())}&itens=40&ordem=DESC&ordenarPor=dataHoraRegistro`,
    HOUR,
  );
  return j.dados
    .filter((v) => v.siglaOrgao === "PLEN" && v.descricao)
    .slice(0, 15)
    .map((v) => ({ id: v.id, date: v.dataHoraRegistro, description: v.descricao, approved: v.aprovacao === 1 ? true : v.aprovacao === 0 ? false : null, organ: v.siglaOrgao }));
}

/* ───────── Senado ───────── */
export async function senadoBills(code: string): Promise<Bill[]> {
  const j = await getJson<any>(`https://legis.senado.leg.br/dadosabertos/senador/${code}/autorias?v=7`);
  const raw = j.MateriasAutoriaParlamentar?.Parlamentar?.Autorias?.Autoria;
  const list: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list
    .map((a) => a.Materia)
    .filter((m) => m && /^(PL|PLS|PLP|PEC|PDL|PLC|PRS)$/i.test(m.Sigla))
    .sort((a, b) => Number(b.Ano) - Number(a.Ano) || Number(b.Numero) - Number(a.Numero))
    .slice(0, 10)
    .map((m) => ({
      id: String(m.Codigo),
      title: m.DescricaoIdentificacao,
      ementa: m.Ementa,
      year: Number(m.Ano) || null,
      url: `https://www25.senado.leg.br/web/atividade/materias/-/materia/${m.Codigo}`,
    }));
}

/* ───────── Querido Diário (Diários Oficiais municipais) ───────── */
export type Gazette = { date: string; edition: string | null; url: string; excerpts: string[]; extra: boolean };

export async function diarioOficial(uf: string, municipalityKey: string, query?: string): Promise<Gazette[]> {
  const ibge = await ibgeIdFor(uf, municipalityKey);
  if (!ibge) throw new Error("município não encontrado no IBGE");
  const params = new URLSearchParams({ territory_ids: String(ibge), size: "15", sort_by: "descending_date", excerpt_size: "300", number_of_excerpts: "3" });
  if (query) params.set("querystring", query);
  const j = await getJson<{ gazettes: any[] }>(`https://api.queridodiario.ok.org.br/gazettes?${params}`, HOUR);
  return j.gazettes.map((g) => ({
    date: g.date,
    edition: g.edition ?? null,
    url: g.txt_url?.replace(/\.txt$/, ".pdf") ?? g.url,
    excerpts: (g.excerpts ?? []).map((e: string) => e.replace(/\s+/g, " ").trim()),
    extra: Boolean(g.is_extra_edition),
  }));
}
