import type { Branch, NewsCategory, Prisma, Scope, SourceCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { normalize } from "@/lib/text";
import { tiersFor } from "@/lib/tier-legend";
import { BRANCH_VALUES, NEWS_CATEGORY_VALUES, SOURCE_CATEGORY_VALUES } from "@/lib/taxonomy";

export type FeedUser = { id: string; uf: string; municipalityKey: string };

export type FeedParams = {
  scope: Scope;
  tipo?: string;
  veiculo?: string;
  cat?: string;
  poder?: string;
  nivel?: string;
  q?: string;
  seguindo?: boolean;
};

export function scopeWhere(user: FeedUser, scope: Scope): Prisma.ArticleWhereInput {
  if (scope === "FEDERAL") return { scope };
  if (scope === "ESTADUAL") return { scope, uf: user.uf };
  return { scope, uf: user.uf, municipalityKey: user.municipalityKey };
}

/** Termos de busca derivados dos políticos que o usuário segue. */
export async function followedNeedles(userId: string): Promise<string[]> {
  const follows = await db.follow.findMany({ where: { userId }, include: { politician: { select: { name: true, ballotName: true } } } });
  const out = new Set<string>();
  for (const f of follows) {
    for (const n of [f.politician.ballotName, f.politician.name]) {
      const norm = n ? normalize(n) : "";
      if (norm.length >= 5) out.add(norm);
    }
  }
  return [...out];
}

export async function buildWhere(user: FeedUser, p: FeedParams, opts: { ignore?: ("tipo" | "veiculo" | "cat" | "poder")[] } = {}): Promise<Prisma.ArticleWhereInput | null> {
  const ignore = opts.ignore ?? [];
  const and: Prisma.ArticleWhereInput[] = [{ classified: true }, { factCheck: false }, scopeWhere(user, p.scope)];
  if (!ignore.includes("tipo") && p.tipo && (SOURCE_CATEGORY_VALUES as string[]).includes(p.tipo)) and.push({ source: { category: p.tipo as SourceCategory } });
  if (!ignore.includes("veiculo") && p.veiculo) and.push({ sourceId: p.veiculo });
  if (!ignore.includes("cat") && p.cat && (NEWS_CATEGORY_VALUES as string[]).includes(p.cat)) and.push({ category: p.cat as NewsCategory });
  if (!ignore.includes("poder") && p.poder && (BRANCH_VALUES as string[]).includes(p.poder)) and.push({ branch: p.poder as Branch });
  const tiers = tiersFor(p.nivel);
  if (tiers) and.push({ source: { tier: { in: tiers } } });
  if (p.q) {
    const q = normalize(p.q);
    if (q) and.push({ searchText: { contains: q } });
  }
  if (p.seguindo) {
    const needles = await followedNeedles(user.id);
    if (!needles.length) return null;
    and.push({ OR: needles.map((n) => ({ searchText: { contains: n } })) });
  }
  return { AND: and };
}

/** Mantém só a primeira notícia de cada assunto (clusterKey) e lista os outros veículos que cobriram. */
export function collapseClusters<T extends { clusterKey: string; title: string; url: string; source: { name: string } }>(rows: T[]): (T & { alsoIn: string[]; related: { source: string; url: string; title: string }[] })[] {
  const groups = new Map<string, T[]>();
  for (const r of rows) groups.set(r.clusterKey, [...(groups.get(r.clusterKey) ?? []), r]);
  return [...groups.values()].map((g) => ({
    ...g[0],
    alsoIn: [...new Set(g.slice(1).map((x) => x.source.name).filter((n) => n !== g[0].source.name))].slice(0, 4),
    related: g.slice(1).filter((x) => x.source.name !== g[0].source.name).slice(0, 5).map((x) => ({ source: x.source.name, url: x.url, title: x.title })),
  }));
}
