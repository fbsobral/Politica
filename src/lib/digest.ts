import type { Prisma, Scope } from "@prisma/client";
import { aiEnabled, ask } from "@/lib/ai";
import { db } from "@/lib/db";
import { appUrl, escapeHtml, layout, sendEmail } from "@/lib/email";
import { followedNeedles } from "@/lib/feed";
import { camaraAgenda, camaraVotes, senadoAgenda, senadoVotes, type AgendaEvent, type PlenaryVote } from "@/lib/open-data";
import { NEWS_CATEGORY_LABEL, SCOPE_LABEL, UFS } from "@/lib/taxonomy";

export type DigestKind = "daily" | "weekly" | "monthly";

const PERIOD: Record<DigestKind, { days: number; take: number; label: string; noun: string }> = {
  daily: { days: 1, take: 5, label: "Resumo do dia", noun: "nas últimas 24 horas" },
  weekly: { days: 7, take: 7, label: "Resumo da semana", noun: "nos últimos 7 dias" },
  monthly: { days: 30, take: 9, label: "Resumo do mês", noun: "nos últimos 30 dias" },
};

type Item = { title: string; url: string; source: string; tag: string };
type Block = { items: Item[]; summary: string | null };
type Cache = Map<string, Promise<Block>>;

const TZ = "America/Sao_Paulo";
const fmt = (opts: Intl.DateTimeFormatOptions, d = new Date()) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...opts }).format(d);

export function todayKey(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date());
}

/** assuntos cobertos por mais veículos pesam mais; veículos tier 1 e 2 dão um bônus */
const weight = (c: { source: { tier: number | null } }[]) => c.length + c.reduce((n, r) => n + (r.source.tier === 1 ? 1 : r.source.tier === 2 ? 0.4 : 0), 0);

/** tiers aceitos no resumo; veículos sem tier contam como Tier 3 */
function tierWhere(tiers: number[]): Prisma.ArticleWhereInput {
  if (tiers.length >= 3) return {};
  return { source: { OR: [{ tier: { in: tiers } }, ...(tiers.includes(3) ? [{ tier: null }] : [])] } };
}

export function parseTiers(raw: string | null | undefined): number[] {
  const t = (raw ?? "1,2,3").split(",").map(Number).filter((n) => [1, 2, 3].includes(n));
  return t.length ? [...new Set(t)].sort() : [1, 2, 3];
}

async function topNews(where: Prisma.ArticleWhereInput, since: Date, take: number, tiers: number[] = [1, 2, 3]): Promise<Item[]> {
  const rows = await db.article.findMany({
    where: { classified: true, publishedAt: { gte: since }, ...where, AND: [tierWhere(tiers)] },
    include: { source: true },
    orderBy: { publishedAt: "desc" },
    take: take * 10,
  });
  // prioriza assuntos cobertos por mais veículos
  const clusters = new Map<string, typeof rows>();
  for (const r of rows) clusters.set(r.clusterKey, [...(clusters.get(r.clusterKey) ?? []), r]);
  return [...clusters.values()]
    .sort((a, b) => weight(b) - weight(a) || +b[0].publishedAt - +a[0].publishedAt)
    .slice(0, take)
    .map((c) => ({ title: c[0].title, url: c[0].url, source: c[0].source.name, tag: NEWS_CATEGORY_LABEL[c[0].category] }));
}

async function summarize(kind: DigestKind, label: string, lines: string[]): Promise<string | null> {
  if (!aiEnabled() || lines.length < 3) return null;
  try {
    const text = await ask(
      `Você escreve o ${PERIOD[kind].label.toLowerCase()} de um app de notícias políticas brasileiras. Em português, escreva 2 a 4 frases corridas, objetivas e neutras, resumindo os principais assuntos da lista (${PERIOD[kind].noun}). Sem listas, sem markdown, sem opinião.`,
      `Seção: ${label}\n` + lines.map((l) => `- ${l}`).join("\n"),
      450,
      "digest",
    );
    return text.trim() || null;
  } catch (err) {
    console.warn("[digest] resumo IA falhou:", (err as Error).message);
    return null;
  }
}

function cached(cache: Cache, key: string, build: () => Promise<Block>): Promise<Block> {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key)!;
}

const newsBlock = (kind: DigestKind, cache: Cache, key: string, label: string, where: Prisma.ArticleWhereInput, since: Date, tiers: number[]) =>
  cached(cache, `${kind}:${tiers.join("")}:${key}`, async () => {
    const items = await topNews({ factCheck: false, ...where }, since, PERIOD[kind].take, tiers);
    return { items, summary: await summarize(kind, label, items.map((i) => `${i.title} (${i.source})`)) };
  });

/* ───────── Congresso: votações + próximas sessões ───────── */
type Congress = { votes: PlenaryVote[]; upcoming: AgendaEvent[]; summary: string | null };

const congressBlock = (kind: DigestKind, cache: Map<string, Promise<Congress>>): Promise<Congress> => {
  const key = `${kind}:congress`;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const days = PERIOD[kind].days;
        const [cv, sv, ca, sa] = await Promise.allSettled([camaraVotes(days), senadoVotes(days), camaraAgenda(7), senadoAgenda(7)]);
        const ok = <T,>(r: PromiseSettledResult<T[]>): T[] => (r.status === "fulfilled" ? r.value : []);
        const since = Date.now() - days * 86400000;
        const votes = [...ok(cv), ...ok(sv)]
          .filter((v) => new Date(v.date.length === 16 ? `${v.date}:00-03:00` : v.date).getTime() >= since)
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, kind === "daily" ? 5 : kind === "weekly" ? 8 : 10);
        const upcoming = [...ok(ca), ...ok(sa)]
          .filter((e) => /delibera/i.test(e.type) && !/n[ãa]o delibera/i.test(e.type))
          .sort((a, b) => a.start.localeCompare(b.start))
          .slice(0, 5);
        const summary = await summarize(kind, "Votações no Congresso Nacional", votes.map((v) => `${v.house}: ${v.description}${v.approved === true ? " (aprovada)" : v.approved === false ? " (rejeitada)" : ""}`));
        return { votes, upcoming, summary };
      })(),
    );
  }
  return cache.get(key)!;
};

/* ───────── HTML ───────── */
const H2 = (t: string) => `<h2 style="font-size:16px;margin:26px 0 8px;border-bottom:1px solid #e4e4e7;padding-bottom:6px">${escapeHtml(t)}</h2>`;
const P = (t: string | null) => (t ? `<p style="margin:0 0 12px;line-height:1.55">${escapeHtml(t)}</p>` : "");
const A = (i: Item) =>
  `<li style="margin:0 0 10px"><a href="${escapeHtml(i.url)}" style="color:#1d4ed8;text-decoration:none">${escapeHtml(i.title)}</a><br><span style="font-size:12px;color:#71717a">${escapeHtml(i.source)} · ${escapeHtml(i.tag)}</span></li>`;

function newsSection(label: string, b: Block): string {
  return b.items.length ? `${H2(label)}${P(b.summary)}<ul style="padding-left:18px;margin:0">${b.items.map(A).join("")}</ul>` : "";
}

function congressSection(c: Congress, kind: DigestKind): string {
  if (!c.votes.length && !c.upcoming.length) return "";
  const badge = (v: PlenaryVote) =>
    v.approved === null ? "" : `<span style="font-size:11px;font-weight:700;padding:1px 7px;border-radius:99px;background:${v.approved ? "#dcfce7;color:#166534" : "#fee2e2;color:#991b1b"}">${v.approved ? "Aprovada" : "Rejeitada"}</span> `;
  const votes = c.votes
    .map((v) => `<li style="margin:0 0 9px;line-height:1.45">${badge(v)}<span style="font-size:12px;color:#71717a">${escapeHtml(v.house)} · ${escapeHtml(fmt({ day: "2-digit", month: "short" }, new Date(v.date.length === 16 ? `${v.date}:00-03:00` : v.date)))}</span><br>${escapeHtml(v.description.length > 200 ? v.description.slice(0, 199) + "…" : v.description)}</li>`)
    .join("");
  const upcoming = c.upcoming
    .map((e) => `<li style="margin:0 0 7px"><b>${escapeHtml(fmt({ weekday: "short", day: "2-digit", month: "short" }, new Date(`${e.start.slice(0, 10)}T12:00:00-03:00`)))} ${escapeHtml(e.start.slice(11, 16))}</b> · ${escapeHtml(e.house)} — ${escapeHtml(e.type)}</li>`)
    .join("");
  return (
    H2(kind === "daily" ? "No Congresso: votações recentes" : "No Congresso: votações do período") +
    P(c.summary) +
    (votes ? `<ul style="padding-left:18px;margin:0">${votes}</ul>` : `<p style="color:#71717a;margin:0">Nenhuma votação de plenário no período.</p>`) +
    (upcoming ? `<p style="margin:16px 0 6px;font-weight:600">Próximas sessões deliberativas</p><ul style="padding-left:18px;margin:0">${upcoming}</ul>` : "")
  );
}

type DigestUser = { id: string; email: string; uf: string | null; municipality: string | null; municipalityKey: string | null; digestTiersDaily?: string; digestTiersWeekly?: string; digestTiersMonthly?: string };

async function buildAndSend(user: DigestUser, kind: DigestKind, cache: Cache, congressCache: Map<string, Promise<Congress>>): Promise<boolean | "empty"> {
  const since = new Date(Date.now() - PERIOD[kind].days * 86400000);
  const uf = user.uf!;
  const local = user.municipalityKey ? { uf, municipalityKey: user.municipalityKey } : null;
  const needles = await followedNeedles(user.id);
  const tiers = parseTiers(kind === "daily" ? user.digestTiersDaily : kind === "weekly" ? user.digestTiersWeekly : user.digestTiersMonthly);

  const [mun, est, fed, congress, checks, follows] = await Promise.all([
    local ? newsBlock(kind, cache, `mun:${uf}:${user.municipalityKey}`, `Municipal — ${user.municipality}`, { scope: "MUNICIPAL", ...local }, since, tiers) : Promise.resolve({ items: [], summary: null } as Block),
    newsBlock(kind, cache, `est:${uf}`, `Estadual — ${UFS[uf]}`, { scope: "ESTADUAL", uf }, since, tiers),
    newsBlock(kind, cache, "fed", "Federal", { scope: "FEDERAL" }, since, tiers),
    congressBlock(kind, congressCache),
    cached(cache, `${kind}:fc:${uf}:${user.municipalityKey}`, async () => ({
      items: await topNews(
        { factCheck: true, OR: [{ scope: "FEDERAL" }, { scope: "ESTADUAL", uf }, ...(local ? [{ scope: "MUNICIPAL" as Scope, ...local }] : [])] },
        since,
        4,
      ),
      summary: null,
    })),
    needles.length
      ? topNews({ factCheck: false, OR: needles.map((n) => ({ searchText: { contains: n } })) }, since, PERIOD[kind].take, tiers)
      : Promise.resolve([] as Item[]),
  ]);

  if (![mun, est, fed, checks].some((b) => b.items.length) && !congress.votes.length && !follows.length) return "empty";

  const intro =
    kind === "daily"
      ? ""
      : `<p style="margin:0 0 4px;color:#52525b">O que mais mexeu com a política ${PERIOD[kind].noun}, na sua cidade, no seu estado e no país.</p>`;

  const inner =
    intro +
    newsSection(`Município · ${user.municipality ?? ""}`, mun) +
    newsSection(`Estado · ${UFS[uf]}`, est) +
    newsSection(SCOPE_LABEL.FEDERAL, fed) +
    congressSection(congress, kind) +
    (follows.length ? `${H2("Quem você segue")}<ul style="padding-left:18px;margin:0">${follows.map(A).join("")}</ul>` : "") +
    (checks.items.length ? `${H2("Checagem de fatos")}<ul style="padding-left:18px;margin:0">${checks.items.map(A).join("")}</ul>` : "") +
    `<p style="margin-top:26px"><a href="${appUrl()}" style="background:#17407f;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Abrir o feed completo</a>
     <a href="${appUrl()}/agenda?esfera=federal" style="margin-left:8px;color:#17407f">Ver a agenda do Congresso →</a></p>`;

  const now = new Date();
  const title =
    kind === "daily"
      ? `Resumo político · ${fmt({ weekday: "long", day: "numeric", month: "long" }, now)}`
      : kind === "weekly"
        ? `Resumo da semana · ${fmt({ day: "numeric", month: "short" }, since)} a ${fmt({ day: "numeric", month: "short" }, now)}`
        : `Resumo mensal · ${fmt({ month: "long", year: "numeric" }, new Date(Date.now() - 86400000))}`;
  const emoji = kind === "daily" ? "🗞️" : kind === "weekly" ? "📅" : "🗓️";
  return sendEmail({ to: user.email, subject: `${emoji} ${title}`, html: layout(title, inner) });
}

/** Envia agora para um usuário (botões "enviar teste" nas configurações). */
export async function sendDigestNow(user: DigestUser, kind: DigestKind = "daily"): Promise<boolean | "empty"> {
  return buildAndSend(user, kind, new Map(), new Map());
}

const FLAG = { daily: "dailyDigest", weekly: "weeklyDigest", monthly: "monthlyDigest" } as const;

export async function sendDigests(kind: DigestKind = "daily"): Promise<{ sent: number; skipped: number }> {
  const day = todayKey();
  const users = await db.user.findMany({ where: { [FLAG[kind]]: true, uf: { not: null } } });
  let sent = 0;
  let skipped = 0;
  const cache: Cache = new Map();
  const congressCache = new Map<string, Promise<Congress>>();
  for (const user of users) {
    // "reserva" o envio antes de enviar (a chave única impede duplicar se dois processos rodarem juntos)
    const claim = await db.digestLog.createMany({ data: [{ userId: user.id, kind, day }], skipDuplicates: true });
    if (claim.count === 0) {
      skipped++;
      continue;
    }
    try {
      const r = await buildAndSend(user, kind, cache, congressCache);
      if (r === true) sent++;
      else {
        skipped++;
        await db.digestLog.deleteMany({ where: { userId: user.id, kind, day } }); // não enviou: libera para tentar depois
      }
    } catch (err) {
      await db.digestLog.deleteMany({ where: { userId: user.id, kind, day } });
      console.warn(`[digest:${kind}] falha para ${user.email}:`, (err as Error).message);
      skipped++;
    }
  }
  return { sent, skipped };
}
