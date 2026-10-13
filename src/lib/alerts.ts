import { db } from "@/lib/db";
import { appUrl, escapeHtml, layout, sendEmail } from "@/lib/email";
import { normalize } from "@/lib/text";

function nameNeedles(p: { name: string; ballotName: string | null }): string[] {
  const needles = new Set<string>();
  for (const n of [p.ballotName, p.name]) {
    if (!n) continue;
    const norm = normalize(n);
    if (norm.length >= 5) needles.add(norm);
  }
  return [...needles];
}

/** Cruza artigos novos com os alertas ativos e dispara os e-mails pendentes. */
export async function processAlerts(articleIds: string[]): Promise<{ matches: number; emails: number }> {
  let matches = 0;
  if (articleIds.length) {
    const [articles, alerts] = await Promise.all([
      db.article.findMany({ where: { id: { in: articleIds } }, select: { id: true, searchText: true, scope: true, uf: true, municipalityKey: true } }),
      db.alert.findMany({
        where: { active: true, user: { alertEmails: true } },
        include: { politician: true, user: { select: { uf: true, municipalityKey: true } } },
      }),
    ]);
    for (const alert of alerts) {
      const needles = alert.keyword
        ? [normalize(alert.keyword)]
        : alert.politician
          ? nameNeedles(alert.politician)
          : [];
      if (!needles.length) continue;
      for (const a of articles) {
        // notícias locais só interessam a quem mora lá
        if (a.scope === "ESTADUAL" && a.uf && alert.user.uf && a.uf !== alert.user.uf) continue;
        if (a.scope === "MUNICIPAL" && a.municipalityKey && a.municipalityKey !== alert.user.municipalityKey) continue;
        if (needles.some((n) => a.searchText.includes(n))) {
          const created = await db.alertMatch.createMany({ data: [{ alertId: alert.id, articleId: a.id }], skipDuplicates: true });
          matches += created.count;
        }
      }
    }
  }

  // envia pendentes (agrupa por usuário)
  const pending = await db.alertMatch.findMany({
    where: { notifiedAt: null, createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24) } },
    include: { alert: { include: { user: true, politician: true } }, article: { include: { source: true } } },
    orderBy: { createdAt: "asc" },
  });
  const byUser = new Map<string, typeof pending>();
  for (const m of pending) {
    const list = byUser.get(m.alert.userId) ?? [];
    list.push(m);
    byUser.set(m.alert.userId, list);
  }
  let emails = 0;
  for (const [, list] of byUser) {
    const user = list[0].alert.user;
    const seen = new Set<string>();
    const items = list
      .filter((m) => (seen.has(m.articleId) ? false : (seen.add(m.articleId), true)))
      .slice(0, 20)
      .map((m) => {
        const why = m.alert.keyword ? `“${m.alert.keyword}”` : (m.alert.politician?.ballotName ?? m.alert.politician?.name ?? "");
        return `<li style="margin:0 0 14px"><a href="${escapeHtml(m.article.url)}" style="color:#1d4ed8;font-weight:600;text-decoration:none">${escapeHtml(m.article.title)}</a><br><span style="font-size:12px;color:#71717a">${escapeHtml(m.article.source.name)} · alerta: ${escapeHtml(why)}</span></li>`;
      })
      .join("");
    const html = layout(
      `${seen.size} ${seen.size === 1 ? "nova notícia" : "novas notícias"} nos seus alertas`,
      `<ul style="padding-left:18px;margin:0">${items}</ul><p><a href="${appUrl()}/alertas" style="color:#1d4ed8">Gerenciar alertas</a></p>`,
    );
    const ok = await sendEmail({ to: user.email, subject: `🔔 ${seen.size} ${seen.size === 1 ? "notícia" : "notícias"} nos seus alertas`, html });
    if (ok) {
      emails++;
      await db.alertMatch.updateMany({ where: { id: { in: list.map((m) => m.id) } }, data: { notifiedAt: new Date() } });
    }
  }
  return { matches, emails };
}
