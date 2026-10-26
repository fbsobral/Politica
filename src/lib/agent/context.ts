import type { PoliticianRole, User } from "@prisma/client";
import { db } from "@/lib/db";
import { brlShort, peekBudget, type BudgetData } from "@/lib/budget";
import { partyBySigla } from "@/lib/parties";
import { PILLARS, SEAL_LABEL, type Pillar } from "@/lib/quiz/data";
import { computeResult, partyPositions, type Answers, type Weights } from "@/lib/quiz/calc";
import { radarBand, fmtPos } from "@/lib/quiz/describe";
import { ROLE_LABEL, UFS } from "@/lib/taxonomy";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const who = (p: { name: string; ballotName: string | null; party: string | null }) => `${p.ballotName ?? p.name}${p.party ? ` (${p.party})` : ""}`;

function budgetLine(label: string, b: BudgetData | null): string | null {
  const a = b?.annual;
  if (!b || !a) return null;
  const top = a.expense.filter((x) => x.code !== "outros").slice(0, 3).map((x) => `${x.name} ${pct(x.share)}`).join(", ");
  const perCap = b.population ? ` (${brlShort(a.expenseTotal / b.population)}/hab.)` : "";
  return `${label} ${a.year}: despesa ${brlShort(a.expenseTotal)}${perCap}; receita ${brlShort(a.revenueTotal)}; maiores gastos: ${top}.`;
}

/**
 * Resumo compacto do usuário para o agente (em torno de 500 a 800 tokens). Só o essencial e estável: o resto o agente busca com ferramentas.
 * A ordem das linhas é fixa para o prompt poder ser reaproveitado do cache.
 */
export async function buildUserContext(user: User): Promise<string> {
  const lines: string[] = [];
  const uf = user.uf ?? "";
  lines.push(`USUÁRIO: mora em ${user.municipality ?? "?"} - ${uf} (${UFS[uf] ?? uf}).`);

  const mine = user.party && user.party !== "NONE" ? partyBySigla(user.party) : undefined;
  if (mine) {
    const pos = partyPositions().find((p) => p.party.sigla === mine.sigla);
    lines.push(`Partido do usuário: ${mine.sigla} (${mine.nome})${mine.federacao ? `, federação ${mine.federacao}` : ""}${mine.seal ? `, estilo "${SEAL_LABEL[mine.seal]}"` : ""}${pos && mine.box === null ? `; posição estimada do partido: economia ${fmtPos(pos.economia)}, costumes ${fmtPos(pos.costumes)}` : ""}.`);
  } else lines.push(user.party === "NONE" ? "O usuário disse que não tem partido." : "Partido do usuário: não informado.");

  if (user.quizAnswers && user.quizWeights) {
    const answers = Object.fromEntries(Object.entries(user.quizAnswers as Record<string, string>).map(([k, v]) => [Number(k), v])) as Answers;
    const weights = user.quizWeights as unknown as Weights;
    const r = computeResult(answers, weights);
    const pr = r.profile;
    const themes = PILLARS.filter((p) => p.id !== "estilo" && weights[p.id] > 0).map((p) => `${p.label} ${fmtPos(pr.pillars[p.id as Exclude<Pillar, "estilo">] ?? 0)} (${radarBand(p.id as Exclude<Pillar, "estilo">, pr.pillars[p.id as Exclude<Pillar, "estilo">] ?? 0)})`);
    const prio = PILLARS.filter((p) => weights[p.id] === 3).map((p) => p.label);
    lines.push(`Perfil no quiz (escala −10 a +10): ${pr.boxName}; ${themes.join("; ")}${pr.seal ? `; estilo: ${SEAL_LABEL[pr.seal]}` : ""}${prio.length ? `; prioridades: ${prio.join(", ")}` : ""}.`);
    if (r.ranking.length) lines.push(`Partidos mais próximos do perfil: ${r.ranking.slice(0, 3).map((s) => `${s.pos.party.sigla} ${s.total.toFixed(1)}`).join(", ")}.`);
  } else lines.push("O usuário ainda não fez o quiz de perfil político (pode sugerir em /perfil).");

  // quem ocupa os cargos que mais importam para ele
  const roles: PoliticianRole[] = ["PRESIDENTE", "VICE_PRESIDENTE", "GOVERNADOR", "VICE_GOVERNADOR", "SENADOR", "PREFEITO", "VICE_PREFEITO"];
  const [holders, vereadores, deputados, follows] = await Promise.all([
    db.politician.findMany({
      where: { role: { in: roles }, OR: [{ role: { in: ["PRESIDENTE", "VICE_PRESIDENTE"] } }, { role: { in: ["GOVERNADOR", "VICE_GOVERNADOR", "SENADOR"] }, uf }, { role: { in: ["PREFEITO", "VICE_PREFEITO"] }, uf, municipalityKey: user.municipalityKey ?? "" }] },
      select: { name: true, ballotName: true, party: true, role: true },
    }),
    db.politician.groupBy({ by: ["party"], where: { role: "VEREADOR", uf, municipalityKey: user.municipalityKey ?? "" }, _count: true }),
    db.politician.count({ where: { role: "DEPUTADO_FEDERAL", uf } }),
    db.follow.findMany({ where: { userId: user.id }, include: { politician: { select: { name: true, ballotName: true, party: true, role: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const byRole = (r: PoliticianRole) => holders.filter((h) => h.role === r).map(who).join(", ");
  const cargos = roles.map((r) => (byRole(r) ? `${ROLE_LABEL[r].replace("(a)", "")}: ${byRole(r)}` : null)).filter(Boolean);
  if (cargos.length) lines.push(`Cargos: ${cargos.join("; ")}.`);
  if (vereadores.length) lines.push(`Câmara de ${user.municipality}: ${vereadores.reduce((a, v) => a + v._count, 0)} vereadores (${vereadores.sort((a, b) => b._count - a._count).slice(0, 5).map((v) => `${v.party ?? "s/p"} ${v._count}`).join(", ")}). Bancada federal do estado: ${deputados} deputados.`);
  if (follows.length) lines.push(`Políticos que segue: ${follows.map((f) => `${who(f.politician)}, ${ROLE_LABEL[f.politician.role].replace("(a)", "")}`).join("; ")}.`);

  const [mun, est, fed] = await Promise.all([
    user.uf && user.municipalityKey ? peekBudget("MUNICIPAL", { uf: user.uf, municipalityKey: user.municipalityKey }) : Promise.resolve(null),
    user.uf && user.municipalityKey ? peekBudget("ESTADUAL", { uf: user.uf, municipalityKey: user.municipalityKey }) : Promise.resolve(null),
    user.uf && user.municipalityKey ? peekBudget("FEDERAL", { uf: user.uf, municipalityKey: user.municipalityKey }) : Promise.resolve(null),
  ]);
  for (const l of [budgetLine(`Orçamento de ${user.municipality}`, mun), budgetLine(`Orçamento de ${UFS[uf] ?? uf}`, est), budgetLine("Orçamento da União", fed)]) if (l) lines.push(l);
  return lines.join("\n");
}

/** O que o usuário está vendo no app (para respostas como "esse partido"). */
export async function describePage(path: string | undefined): Promise<string | null> {
  if (!path) return null;
  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  let m = pathname.match(/^\/partidos\/([^/]+)/);
  if (m) {
    const { partyBySlug } = await import("@/lib/parties");
    const p = partyBySlug(m[1]);
    return p ? `página do partido ${p.sigla} (${p.nome})` : null;
  }
  m = pathname.match(/^\/representantes\/([^/]+)/);
  if (m) {
    const p = await db.politician.findUnique({ where: { id: m[1] }, select: { name: true, ballotName: true, party: true, role: true, uf: true } });
    return p ? `página de ${who(p)}, ${ROLE_LABEL[p.role]}${p.uf ? ` (${p.uf})` : ""}` : null;
  }
  if (pathname.startsWith("/orcamento")) return `tela de Orçamento (esfera: ${params.get("esfera") ?? "municipal"})`;
  if (pathname.startsWith("/partidos")) return "lista de notícias dos partidos";
  if (pathname.startsWith("/perfil")) return "tela Você (perfil político e quiz)";
  if (pathname.startsWith("/agenda")) return "agenda do Congresso";
  if (pathname.startsWith("/eleicoes")) return "tela de Eleições";
  if (pathname.startsWith("/checagens")) return "checagem de fatos";
  if (pathname.startsWith("/representantes")) return "lista de representantes";
  if (pathname === "/") return "feed de notícias";
  return null;
}

