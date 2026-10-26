import type Anthropic from "@anthropic-ai/sdk";
import type { Prisma, Scope, User } from "@prisma/client";
import { db } from "@/lib/db";
import { brlShort, getBudget, type BudgetScope } from "@/lib/budget";
import { collapseClusters, scopeWhere } from "@/lib/feed";
import { camaraAgenda, camaraVotes, senadoAgenda, senadoVotes } from "@/lib/open-data";
import { partyBySigla, politicianPartyValues } from "@/lib/parties";
import { PILLARS, SEAL_LABEL, type Pillar } from "@/lib/quiz/data";
import { partyPositions } from "@/lib/quiz/calc";
import { fmtPos, radarBand } from "@/lib/quiz/describe";
import { ROLE_LABEL } from "@/lib/taxonomy";
import { normalize } from "@/lib/text";

export type Source = { title: string; url: string; source: string };

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "buscar_noticias",
    description: "Busca notícias recentes no app por assunto (nomes, temas, partidos). Use para qualquer pergunta sobre fatos recentes. Devolve até 6 manchetes.",
    input_schema: {
      type: "object",
      properties: {
        consulta: { type: "string", description: "Palavras-chave (ex.: 'reforma tributária', 'prefeito', 'PSB')." },
        escopo: { type: "string", enum: ["local", "estado", "nacional", "todas"], description: "local = cidade do usuário; estado; nacional. Padrão: todas." },
        dias: { type: "integer", description: "Janela em dias (padrão 7, máximo 60)." },
      },
      required: ["consulta"],
    },
  },
  {
    name: "ver_politico",
    description: "Dados de um político eleito (cargo, partido, mandato) pelo nome, mais manchetes recentes sobre ele.",
    input_schema: { type: "object", properties: { nome: { type: "string" } }, required: ["nome"] },
  },
  {
    name: "ver_partido",
    description: "Perfil de um partido: federação, posições estimadas por tema, estilo, número de eleitos e manchetes recentes. Use a sigla (PT, PL, União Brasil…).",
    input_schema: { type: "object", properties: { sigla: { type: "string" } }, required: ["sigla"] },
  },
  {
    name: "orcamento",
    description: "Orçamento público detalhado (despesa por função, receitas, por habitante, execução do ano) de uma esfera.",
    input_schema: { type: "object", properties: { esfera: { type: "string", enum: ["municipal", "estadual", "federal"] } }, required: ["esfera"] },
  },
  {
    name: "agenda_congresso",
    description: "Próximas sessões e votações recentes de plenário da Câmara e do Senado.",
    input_schema: { type: "object", properties: {} },
  },
];

const fmtDate = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(d);

async function news(where: Prisma.ArticleWhereInput, take: number, sources: Source[]): Promise<string[]> {
  const rows = await db.article.findMany({
    where: { classified: true, ...where },
    include: { source: { select: { name: true } } },
    orderBy: { publishedAt: "desc" },
    take: take * 4,
  });
  return collapseClusters(rows).slice(0, take).map((a) => {
    sources.push({ title: a.title, url: a.url, source: a.source.name });
    return `- ${a.title} (${a.source.name}, ${fmtDate(a.publishedAt)})`;
  });
}

async function buscarNoticias(user: User, input: { consulta?: string; escopo?: string; dias?: number }, sources: Source[]): Promise<string> {
  const words = normalize(String(input.consulta ?? "")).split(" ").filter((w) => w.length >= 3).slice(0, 5);
  if (!words.length) return "Consulta vazia.";
  const days = Math.min(60, Math.max(1, Math.round(input.dias ?? 7)));
  const u = { id: user.id, uf: user.uf ?? "", municipalityKey: user.municipalityKey ?? "" };
  const scopes: Record<string, Prisma.ArticleWhereInput> = {
    local: scopeWhere(u, "MUNICIPAL"),
    estado: scopeWhere(u, "ESTADUAL"),
    nacional: scopeWhere(u, "FEDERAL"),
    todas: { OR: (["MUNICIPAL", "ESTADUAL", "FEDERAL"] as Scope[]).map((s) => scopeWhere(u, s)) },
  };
  const lines = await news({ publishedAt: { gte: new Date(Date.now() - days * 86400000) }, AND: [scopes[input.escopo ?? "todas"] ?? scopes.todas, ...words.map((w) => ({ searchText: { contains: w } }))] }, 6, sources);
  return lines.length ? lines.join("\n") : `Nenhuma notícia encontrada nos últimos ${days} dias.`;
}

async function verPolitico(user: User, input: { nome?: string }, sources: Source[]): Promise<string> {
  const q = String(input.nome ?? "").trim();
  if (q.length < 3) return "Informe o nome.";
  const rows = await db.politician.findMany({
    where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { ballotName: { contains: q, mode: "insensitive" } }] },
    orderBy: [{ role: "asc" }],
    take: 4,
  });
  if (!rows.length) return "Nenhum político encontrado com esse nome na base de eleitos.";
  const out: string[] = [];
  for (const p of rows) {
    const where = [p.ballotName, p.name].filter(Boolean).map((n) => normalize(n!)).filter((n) => n.length >= 5);
    const lines = where.length ? await news({ OR: where.map((n) => ({ searchText: { contains: n } })) }, 3, sources) : [];
    out.push(`${p.ballotName ?? p.name} — ${ROLE_LABEL[p.role]}, ${p.party ?? "sem partido"}${p.uf ? `, ${p.uf}` : ""}${p.municipality ? `, ${p.municipality}` : ""}${p.mandate ? `, mandato ${p.mandate}` : ""}.${lines.length ? `\n${lines.join("\n")}` : ""}`);
  }
  return out.join("\n\n");
}

async function verPartido(user: User, input: { sigla?: string }, sources: Source[]): Promise<string> {
  const q = normalize(String(input.sigla ?? ""));
  const { PARTIES } = await import("@/lib/quiz/data");
  const party = PARTIES.find((p) => normalize(p.sigla) === q || normalize(p.nome) === q) ?? partyBySigla(String(input.sigla));
  if (!party) return "Partido não encontrado na base.";
  const pos = partyPositions().find((p) => p.party.sigla === party.sigla)!;
  const counts = await db.politician.groupBy({ by: ["role"], where: { party: { in: politicianPartyValues(party.sigla) } }, _count: true });
  const themes = party.box === "undefined" ? "perfil pouco definido" : PILLARS.filter((p) => p.id !== "estilo").map((p) => `${p.label} ${fmtPos(pos.pillars[p.id as Exclude<Pillar, "estilo">] ?? 0)} (${radarBand(p.id as Exclude<Pillar, "estilo">, pos.pillars[p.id as Exclude<Pillar, "estilo">] ?? 0)})`).join("; ");
  const lines = await news({ parties: { has: party.sigla } }, 4, sources);
  return [
    `${party.sigla} — ${party.nome}${party.federacao ? `; federação ${party.federacao}` : ""}.`,
    `Posições estimadas pelo app (−10 a +10; confiança ${party.conf}): ${themes}${party.seal ? `; estilo ${SEAL_LABEL[party.seal]}` : ""}.`,
    `Eleitos no cadastro: ${counts.map((c) => `${c._count} ${ROLE_LABEL[c.role].replace("(a)", "")}`).join(", ") || "nenhum"}.`,
    lines.length ? `Manchetes:\n${lines.join("\n")}` : "Sem manchetes recentes.",
  ].join("\n");
}

async function orcamento(user: User, input: { esfera?: string }): Promise<string> {
  const scope = (({ municipal: "MUNICIPAL", estadual: "ESTADUAL", federal: "FEDERAL" }) as Record<string, BudgetScope>)[String(input.esfera)] ?? "MUNICIPAL";
  const b = await getBudget(scope, { uf: user.uf ?? "", municipalityKey: user.municipalityKey ?? "" });
  const a = b?.annual;
  if (!b || !a) return "Dados de orçamento indisponíveis agora.";
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const lines = [
    `${b.entity} — ano fechado ${a.year}: despesa ${brlShort(a.expenseTotal)}, receita ${brlShort(a.revenueTotal)}${b.population ? `, ${brlShort(a.expenseTotal / b.population)} por habitante` : ""}.`,
    `Despesa por função: ${a.expense.slice(0, 8).map((x) => `${x.name} ${brlShort(x.value)} (${pct(x.share)})`).join("; ")}.`,
    `Receita por origem: ${a.revenue.slice(0, 5).map((x) => `${x.name} ${brlShort(x.value)} (${pct(x.share)})`).join("; ")}.`,
  ];
  if (a.nature?.length) lines.push(`Por tipo de gasto: ${a.nature.map((x) => `${x.name} ${pct(x.share)}`).join("; ")}.`);
  if (b.current) lines.push(`${b.current.year} até o ${b.current.period}º bimestre: despesa empenhada ${brlShort(b.current.expense.committed)} de ${brlShort(b.current.expense.updated)} previstos; receita ${brlShort(b.current.revenue.realized)} de ${brlShort(b.current.revenue.updated)}.`);
  return lines.join("\n");
}

async function agendaCongresso(): Promise<string> {
  const ok = <T,>(r: PromiseSettledResult<T[]>): T[] => (r.status === "fulfilled" ? r.value : []);
  const [ca, sa, cv, sv] = await Promise.allSettled([camaraAgenda(7), senadoAgenda(7), camaraVotes(7), senadoVotes(7)]);
  const events = [...ok(ca), ...ok(sa)].filter((e) => /delibera/i.test(e.type) && !/n[ãa]o delibera/i.test(e.type)).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 5);
  const votes = [...ok(cv), ...ok(sv)].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const cut = (t: string) => (t.length > 160 ? `${t.slice(0, 159)}…` : t);
  return [
    events.length ? `Próximas sessões deliberativas:\n${events.map((e) => `- ${e.start.slice(8, 10)}/${e.start.slice(5, 7)} ${e.start.slice(11, 16)} ${e.house}: ${e.type}`).join("\n")}` : "Sem sessões deliberativas marcadas nos próximos dias.",
    votes.length ? `Votações recentes:\n${votes.map((v) => `- ${v.house}: ${cut(v.description)}${v.approved === true ? " (aprovada)" : v.approved === false ? " (rejeitada)" : ""}`).join("\n")}` : "Sem votações de plenário recentes.",
  ].join("\n\n");
}

/** Executa uma ferramenta pedida pelo modelo. Erros viram texto para o modelo se explicar, nunca derrubam a conversa. */
export async function runTool(user: User, name: string, input: Record<string, unknown>, sources: Source[]): Promise<string> {
  try {
    const out =
      name === "buscar_noticias" ? await buscarNoticias(user, input, sources)
      : name === "ver_politico" ? await verPolitico(user, input, sources)
      : name === "ver_partido" ? await verPartido(user, input, sources)
      : name === "orcamento" ? await orcamento(user, input)
      : name === "agenda_congresso" ? await agendaCongresso()
      : "Ferramenta desconhecida.";
    return out.length > 3500 ? `${out.slice(0, 3499)}…` : out;
  } catch (err) {
    console.warn("[agent:tool]", name, (err as Error).message);
    return "Não consegui buscar isso agora.";
  }
}
