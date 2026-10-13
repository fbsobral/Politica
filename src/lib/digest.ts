import type { Scope } from "@prisma/client";
import { aiEnabled, ask } from "@/lib/ai";
import { db } from "@/lib/db";
import { appUrl, escapeHtml, layout, sendEmail } from "@/lib/email";
import { NEWS_CATEGORY_LABEL, SCOPE_LABEL, UFS } from "@/lib/taxonomy";

type Item = { title: string; url: string; source: string; category: string };

async function top(scope: Scope, where: object, since: Date, take: number): Promise<Item[]> {
  const rows = await db.article.findMany({
    where: { scope, classified: true, publishedAt: { gte: since }, ...where },
    include: { source: true },
    orderBy: { publishedAt: "desc" },
    take: take * 6,
  });
  // prioriza assuntos cobertos por mais veículos
  const clusters = new Map<string, typeof rows>();
  for (const r of rows) clusters.set(r.clusterKey, [...(clusters.get(r.clusterKey) ?? []), r]);
  return [...clusters.values()]
    .sort((a, b) => b.length - a.length || +b[0].publishedAt - +a[0].publishedAt)
    .slice(0, take)
    .map((c) => ({ title: c[0].title, url: c[0].url, source: c[0].source.name, category: NEWS_CATEGORY_LABEL[c[0].category] }));
}

async function summarize(label: string, items: Item[]): Promise<string | null> {
  if (!aiEnabled() || items.length < 3) return null;
  try {
    const text = await ask(
      "Você escreve o resumo diário de um app de notícias políticas brasileiras. Em português, escreva 2 a 4 frases corridas, objetivas e neutras, resumindo os principais assuntos da lista. Sem listas, sem markdown, sem opinião.",
      `Esfera: ${label}\n` + items.map((i) => `- ${i.title} (${i.source})`).join("\n"),
      500,
    );
    return text.trim() || null;
  } catch (err) {
    console.warn("[digest] resumo IA falhou:", (err as Error).message);
    return null;
  }
}

function section(label: string, summary: string | null, items: Item[]): string {
  if (!items.length) return "";
  const lis = items
    .map(
      (i) =>
        `<li style="margin:0 0 10px"><a href="${escapeHtml(i.url)}" style="color:#1d4ed8;text-decoration:none">${escapeHtml(i.title)}</a><br><span style="font-size:12px;color:#71717a">${escapeHtml(i.source)} · ${escapeHtml(i.category)}</span></li>`,
    )
    .join("");
  return `<h2 style="font-size:16px;margin:24px 0 8px;border-bottom:1px solid #e4e4e7;padding-bottom:6px">${escapeHtml(label)}</h2>
${summary ? `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(summary)}</p>` : ""}
<ul style="padding-left:18px;margin:0">${lis}</ul>`;
}

export function todayKey(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

type DigestUser = { id: string; email: string; uf: string | null; municipality: string | null; municipalityKey: string | null };

async function buildAndSend(user: DigestUser, cache: Map<string, { items: Item[]; summary: string | null }>, since: Date): Promise<boolean | "empty"> {
  async function get(key: string, label: string, scope: Scope, where: object) {
    if (!cache.has(key)) {
      const items = await top(scope, where, since, 6);
      cache.set(key, { items, summary: await summarize(label, items) });
    }
    return cache.get(key)!;
  }
  const uf = user.uf!;
  const fed = await get("fed", "Federal", "FEDERAL", {});
  const est = await get(`est:${uf}`, `Estadual — ${UFS[uf]}`, "ESTADUAL", { uf });
  const mun = user.municipalityKey
    ? await get(`mun:${uf}:${user.municipalityKey}`, `Municipal — ${user.municipality}`, "MUNICIPAL", { uf, municipalityKey: user.municipalityKey })
    : { items: [], summary: null };
  if (!fed.items.length && !est.items.length && !mun.items.length) return "empty";
  const inner =
    section(`${SCOPE_LABEL.MUNICIPAL} · ${user.municipality ?? ""}`, mun.summary, mun.items) +
    section(`${SCOPE_LABEL.ESTADUAL} · ${UFS[uf]}`, est.summary, est.items) +
    section(SCOPE_LABEL.FEDERAL, fed.summary, fed.items) +
    `<p style="margin-top:24px"><a href="${appUrl()}" style="background:#18181b;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block">Abrir o feed completo</a></p>`;
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return sendEmail({
    to: user.email,
    subject: `🗞️ Resumo político — ${dateLabel}`,
    html: layout(`Resumo político · ${dateLabel}`, inner),
  });
}

/** Envia o resumo agora para um usuário (botão "enviar teste" nas configurações). */
export async function sendDigestNow(user: DigestUser): Promise<boolean | "empty"> {
  return buildAndSend(user, new Map(), new Date(Date.now() - 1000 * 60 * 60 * 24));
}

export async function sendDigests(): Promise<{ sent: number; skipped: number }> {
  const day = todayKey();
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24);
  const users = await db.user.findMany({ where: { dailyDigest: true, uf: { not: null } } });
  let sent = 0;
  let skipped = 0;
  const cache = new Map<string, { items: Item[]; summary: string | null }>();
  for (const user of users) {
    if (await db.digestLog.findUnique({ where: { userId_day: { userId: user.id, day } } })) {
      skipped++;
      continue;
    }
    try {
      const r = await buildAndSend(user, cache, since);
      if (r === true) {
        await db.digestLog.create({ data: { userId: user.id, day } });
        sent++;
      } else skipped++;
    } catch (err) {
      console.warn(`[digest] falha para ${user.email}:`, (err as Error).message);
      skipped++;
    }
  }
  return { sent, skipped };
}
