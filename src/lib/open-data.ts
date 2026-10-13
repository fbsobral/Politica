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

export type AgendaEvent = { id: string; house: "Câmara" | "Senado"; link?: string; start: string; type: string; description: string; situation: string; place: string | null; organ: string | null };

export async function camaraAgenda(days = 10): Promise<AgendaEvent[]> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const from = new Date();
  const to = new Date(Date.now() + days * 86400000);
  const j = await getJson<{ dados: any[] }>(`${CAMARA}/eventos?dataInicio=${fmt(from)}&dataFim=${fmt(to)}&itens=100&ordem=ASC&ordenarPor=dataHoraInicio`, HOUR);
  return j.dados
    .filter((e) => !/cancelad/i.test(e.situacao))
    .map((e) => ({
      id: `c${e.id}`,
      house: "Câmara" as const,
      start: e.dataHoraInicio,
      type: e.descricaoTipo,
      description: e.descricao,
      situation: e.situacao,
      place: e.localCamara?.nome ?? e.localExterno ?? null,
      organ: e.orgaos?.[0]?.sigla ?? null,
    }));
}

export type PlenaryVote = { id: string; house: "Câmara" | "Senado"; link?: string; date: string; description: string; approved: boolean | null; organ: string };

export async function camaraVotes(days = 45): Promise<PlenaryVote[]> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const j = await getJson<{ dados: any[] }>(
    `${CAMARA}/votacoes?dataInicio=${fmt(new Date(Date.now() - days * 86400000))}&dataFim=${fmt(new Date())}&itens=100&ordem=DESC&ordenarPor=dataHoraRegistro`,
    HOUR,
  );
  return j.dados
    .filter((v) => v.siglaOrgao === "PLEN" && v.descricao)
    .slice(0, 25)
    .map((v) => ({ id: `c${v.id}`, house: "Câmara" as const, date: v.dataHoraRegistro, description: v.descricao, approved: v.aprovacao === 1 ? true : v.aprovacao === 0 ? false : null, organ: v.siglaOrgao }));
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

const SENADO = "https://legis.senado.leg.br/dadosabertos";
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const asArray = <T,>(x: T | T[] | undefined): T[] => (Array.isArray(x) ? x : x ? [x] : []);

/** Sessões do Plenário e reuniões de comissões do Senado nos próximos dias. */
export async function senadoAgenda(days = 10): Promise<AgendaEvent[]> {
  const from = new Date();
  const to = new Date(Date.now() + days * 86400000);
  const [plen, com] = await Promise.allSettled([
    getJson<any>(`${SENADO}/plenario/agenda/mes/${ymd(from)}`, HOUR),
    getJson<any>(`${SENADO}/comissao/agenda/${ymd(from)}/${ymd(to)}`, HOUR),
  ]);
  const out: AgendaEvent[] = [];
  if (plen.status === "fulfilled") {
    for (const s of asArray<any>(plen.value.AgendaPlenario?.Sessoes?.Sessao)) {
      if (!s.Data || s.Data < from.toISOString().slice(0, 10) || s.Data > to.toISOString().slice(0, 10)) continue;
      if (/cancelad/i.test(s.SituacaoSessao ?? "")) continue;
      out.push({
        id: `s${s.CodigoSessao}`,
        house: "Senado",
        start: `${s.Data}T${s.Hora ?? "00:00"}`,
        type: String(s.TipoSessao ?? "Sessão").trim().toLowerCase().replace(/^./, (c: string) => c.toUpperCase()),
        description: s.Evento?.DescricaoEvento || (s.Casa === "CN" ? "Sessão do Congresso Nacional" : "Sessão do Plenário do Senado"),
        situation: s.SituacaoSessao ?? "",
        place: s.LocalSessao ?? null,
        organ: s.Casa === "CN" ? "CN" : "PLEN",
      });
    }
  }
  if (com.status === "fulfilled") {
    for (const r of asArray<any>(com.value.AgendaReuniao?.reunioes?.reuniao)) {
      if (!r.dataInicio || /cancelad|suspens/i.test(r.situacao ?? "")) continue;
      out.push({
        id: `r${r.codigo}`,
        house: "Senado",
        start: String(r.dataInicio).slice(0, 16),
        type: r.titulo ?? "Reunião de comissão",
        description: r.colegiadoCriador?.nome ?? r.descricao ?? "",
        situation: r.situacao ?? "",
        place: r.local ?? null,
        organ: r.colegiadoCriador?.sigla ?? null,
        link: r.urlUltimaPautaSimplesPublicada || undefined,
      });
    }
  }
  if (plen.status === "rejected" && com.status === "rejected") throw new Error("Senado indisponível");
  return out;
}

export async function senadoVotes(days = 45): Promise<PlenaryVote[]> {
  const j = await getJson<any>(`${SENADO}/plenario/lista/votacao/${ymd(new Date(Date.now() - Math.min(days, 59) * 86400000))}/${ymd(new Date())}`, HOUR);
  return asArray<any>(j.ListaVotacoes?.Votacoes?.Votacao)
    .sort((a, b) => String(b.DataSessao).localeCompare(String(a.DataSessao)))
    .slice(0, 15)
    .map((v) => ({
      id: `s${v.CodigoSessaoVotacao ?? v.CodigoVotacaoSve}`,
      house: "Senado" as const,
      date: `${v.DataSessao}T${v.HoraInicio ?? "00:00"}`,
      description: `${v.DescricaoIdentificacaoMateria ? v.DescricaoIdentificacaoMateria + " — " : ""}${v.DescricaoVotacao}${v.TotalVotosSim ? ` (${v.TotalVotosSim} sim, ${v.TotalVotosNao} não)` : ""}`,
      approved: v.Resultado === "A" ? true : v.Resultado === "R" ? false : null,
      organ: "PLEN",
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
