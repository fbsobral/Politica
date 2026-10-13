import type { PoliticianRole } from "@prisma/client";
import { db } from "@/lib/db";

type Row = {
  externalKey: string;
  name: string;
  ballotName?: string | null;
  role: PoliticianRole;
  uf?: string | null;
  party?: string | null;
  photoUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  profileUrl?: string | null;
  mandate?: string | null;
};

async function replaceRole(role: PoliticianRole, prefix: string, rows: Row[]) {
  for (const r of rows) {
    await db.politician.upsert({ where: { externalKey: r.externalKey }, create: r, update: r });
  }
  await db.politician.deleteMany({
    where: { role, externalKey: { startsWith: prefix, notIn: rows.map((r) => r.externalKey) } },
  });
}

/** Deputados federais em exercício (API Dados Abertos da Câmara). */
export async function syncDeputadosFederais(): Promise<number> {
  const rows: Row[] = [];
  for (let page = 1; page < 20; page++) {
    const res = await fetch(`https://dadosabertos.camara.leg.br/api/v2/deputados?itens=100&pagina=${page}&ordem=ASC&ordenarPor=nome`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Câmara ${res.status}`);
    const json = (await res.json()) as { dados: any[] };
    if (!json.dados.length) break;
    for (const d of json.dados) {
      rows.push({
        externalKey: `camara:${d.id}`,
        name: d.nome,
        role: "DEPUTADO_FEDERAL",
        uf: d.siglaUf,
        party: d.siglaPartido,
        photoUrl: d.urlFoto,
        email: d.email,
        profileUrl: `https://www.camara.leg.br/deputado/${d.id}`,
        mandate: "2023–2027",
      });
    }
    if (json.dados.length < 100) break;
  }
  if (rows.length < 400) throw new Error(`Câmara retornou só ${rows.length} deputados; abortando para não apagar dados`);
  await replaceRole("DEPUTADO_FEDERAL", "camara:", rows);
  return rows.length;
}

/** Senadores em exercício (API Dados Abertos do Senado). */
export async function syncSenadores(): Promise<number> {
  const res = await fetch("https://legis.senado.leg.br/dadosabertos/senador/lista/atual", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Senado ${res.status}`);
  const json = (await res.json()) as any;
  const list: any[] = json.ListaParlamentarEmExercicio.Parlamentares.Parlamentar;
  const rows: Row[] = list.map((p) => {
    const i = p.IdentificacaoParlamentar;
    const tel = i.Telefones?.Telefone;
    return {
      externalKey: `senado:${i.CodigoParlamentar}`,
      name: i.NomeCompletoParlamentar ?? i.NomeParlamentar,
      ballotName: i.NomeParlamentar,
      role: "SENADOR" as const,
      uf: i.UfParlamentar,
      party: i.SiglaPartidoParlamentar,
      photoUrl: i.UrlFotoParlamentar?.replace("http://", "https://"),
      email: i.EmailParlamentar,
      phone: Array.isArray(tel) ? tel[0]?.NumeroTelefone : tel?.NumeroTelefone,
      profileUrl: i.UrlPaginaParlamentar?.replace("http://", "https://"),
    };
  });
  if (rows.length < 60) throw new Error(`Senado retornou só ${rows.length}; abortando`);
  await replaceRole("SENADOR", "senado:", rows);
  return rows.length;
}

/** Presidente e vice: cadastro fixo (mandato 2023–2026). Ajuste aqui se mudar. */
export async function syncPresidencia(): Promise<number> {
  const rows: Row[] = [
    {
      externalKey: "manual:presidente",
      name: "Luiz Inácio Lula da Silva",
      ballotName: "Lula",
      role: "PRESIDENTE",
      party: "PT",
      profileUrl: "https://www.gov.br/planalto/pt-br/conheca-a-presidencia/presidente",
      mandate: "2023–2026",
    },
    {
      externalKey: "manual:vice-presidente",
      name: "Geraldo José Rodrigues Alckmin Filho",
      ballotName: "Geraldo Alckmin",
      role: "VICE_PRESIDENTE",
      party: "PSB",
      profileUrl: "https://www.gov.br/planalto/pt-br/conheca-a-presidencia/vice-presidente",
      mandate: "2023–2026",
    },
  ];
  for (const r of rows) await db.politician.upsert({ where: { externalKey: r.externalKey }, create: r, update: r });
  return rows.length;
}
