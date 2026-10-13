import Parser from "rss-parser";
import type { Scope } from "@prisma/client";
import { db } from "@/lib/db";
import { UFS } from "@/lib/taxonomy";
import { clusterKey, normalize, stripHtml, truncate } from "@/lib/text";
import { classifyArticles, classifySources, type ClassifyInput } from "./classify";
import { NATIONAL_FEEDS, guessSourceCategory } from "./sources";

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; PoliticaBot/1.0)" },
  customFields: {
    item: [
      ["source", "sourceName"],
      ["media:content", "mediaContent", { keepArray: false }],
      ["media:thumbnail", "mediaThumb", { keepArray: false }],
    ],
  },
});

const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 3;

type Candidate = {
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  publishedAt: Date;
  sourceName: string;
  sourceHomepage?: string;
  scope: Scope;
  scopeLocked: boolean;
  uf: string | null;
  municipalityKey: string | null;
  origin: string;
};

type Origin = {
  label: string;
  url: string;
  scope: Scope;
  uf: string | null;
  municipalityKey: string | null;
  fixedSource?: { name: string; homepage: string };
};

function googleNewsUrl(query: string): string {
  const q = encodeURIComponent(`${query} when:3d`);
  return `https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
}

function imageOf(item: Record<string, any>): string | null {
  return (
    item.enclosure?.url ??
    item.mediaContent?.$?.url ??
    item.mediaThumb?.$?.url ??
    item["content:encoded"]?.match(/<img[^>]+src="([^"]+)"/)?.[1] ??
    item.content?.match(/<img[^>]+src="([^"]+)"/)?.[1] ??
    null
  );
}

async function fetchOrigin(o: Origin): Promise<Candidate[]> {
  try {
    const res = await fetch(o.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PoliticaBot/1.0)", Accept: "application/rss+xml, application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = (await res.text()).replace(/^[^<]+/, "");
    const feed = await parser.parseString(xml);
    const out: Candidate[] = [];
    for (const item of feed.items as Record<string, any>[]) {
      const url: string | undefined = item.link ?? item.guid;
      const rawTitle: string | undefined = item.title;
      if (!url || !rawTitle) continue;
      const publishedAt = new Date(item.isoDate ?? item.pubDate ?? Date.now());
      if (Number.isNaN(publishedAt.getTime()) || Date.now() - publishedAt.getTime() > MAX_AGE_MS) continue;

      let title = stripHtml(rawTitle);
      let sourceName = o.fixedSource?.name ?? "";
      if (!o.fixedSource) {
        // Google News: "Título - Veículo"
        const fromTag = typeof item.sourceName === "string" ? item.sourceName : item.sourceName?._;
        const m = title.match(/^(.*) - ([^-]+)$/);
        sourceName = (fromTag || m?.[2] || "").trim();
        if (m && (!fromTag || m[2].trim() === fromTag.trim())) title = m[1].trim();
        if (!sourceName) continue;
      }
      const description = o.fixedSource
        ? truncate(stripHtml(item.contentSnippet ?? item.content ?? item.summary ?? ""), 400) || null
        : null; // o resumo do Google News é só a lista de links relacionados

      out.push({
        url,
        title: truncate(title, 300),
        description,
        imageUrl: imageOf(item),
        publishedAt,
        sourceName,
        sourceHomepage: o.fixedSource?.homepage,
        scope: o.scope,
        scopeLocked: !o.fixedSource,
        uf: o.uf,
        municipalityKey: o.municipalityKey,
        origin: o.label,
      });
    }
    return out;
  } catch (err) {
    console.warn(`[ingest] falha em ${o.label}:`, (err as Error).message);
    return [];
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function buildOrigins(): Promise<Origin[]> {
  const origins: Origin[] = NATIONAL_FEEDS.map((f) => ({
    label: `feed:${f.name}`,
    url: f.feedUrl,
    scope: "FEDERAL",
    uf: null,
    municipalityKey: null,
    fixedSource: { name: f.name, homepage: f.homepage },
  }));

  origins.push({
    label: "gnews:federal",
    url: googleNewsUrl('("governo federal" OR "Congresso Nacional" OR "Câmara dos Deputados" OR Senado OR STF) política'),
    scope: "FEDERAL",
    uf: null,
    municipalityKey: null,
  });

  const users = await db.user.findMany({
    where: { uf: { not: null } },
    select: { uf: true, municipality: true, municipalityKey: true },
  });
  const ufs = new Set<string>();
  const cities = new Map<string, { uf: string; name: string; key: string }>();
  for (const u of users) {
    if (!u.uf) continue;
    ufs.add(u.uf);
    if (u.municipality && u.municipalityKey) cities.set(`${u.uf}:${u.municipalityKey}`, { uf: u.uf, name: u.municipality, key: u.municipalityKey });
  }
  for (const uf of ufs) {
    const state = UFS[uf];
    origins.push({
      label: `gnews:uf:${uf}`,
      url: googleNewsUrl(`("governador" OR "Assembleia Legislativa" OR "governo do estado") "${state}"`),
      scope: "ESTADUAL",
      uf,
      municipalityKey: null,
    });
  }
  for (const c of cities.values()) {
    origins.push({
      label: `gnews:city:${c.uf}:${c.key}`,
      url: googleNewsUrl(`"${c.name}" ${UFS[c.uf]} (prefeito OR prefeitura OR vereadores OR "câmara municipal")`),
      scope: "MUNICIPAL",
      uf: c.uf,
      municipalityKey: c.key,
    });
  }
  return origins;
}

export type IngestResult = { fetched: number; created: number; classified: number; removed: number; newArticleIds: string[] };

export async function runIngest(): Promise<IngestResult> {
  const origins = await buildOrigins();
  const batches = await mapLimit(origins, 6, fetchOrigin);
  const all = batches.flat();

  // dedupe dentro do lote e contra o banco
  const byUrl = new Map<string, Candidate>();
  for (const c of all) if (!byUrl.has(c.url)) byUrl.set(c.url, c);
  const urls = [...byUrl.keys()];
  const existing = new Set<string>();
  for (let i = 0; i < urls.length; i += 1000) {
    const rows = await db.article.findMany({ where: { url: { in: urls.slice(i, i + 1000) } }, select: { url: true } });
    rows.forEach((r) => existing.add(r.url));
  }
  const fresh = [...byUrl.values()].filter((c) => !existing.has(c.url));

  // veículos
  const sourceIds = new Map<string, string>();
  const names = [...new Set(fresh.map((c) => c.sourceName))];
  const knownFeeds = new Map(NATIONAL_FEEDS.map((f) => [f.name, f]));
  for (const name of names) {
    const feed = knownFeeds.get(name);
    const guessed = feed?.category ?? guessSourceCategory(name);
    const src = await db.source.upsert({
      where: { name },
      create: {
        name,
        homepage: feed?.homepage ?? fresh.find((c) => c.sourceName === name)?.sourceHomepage ?? null,
        category: guessed ?? "OUTRO",
        categoryKnown: guessed !== null,
      },
      update: {},
    });
    sourceIds.set(name, src.id);
  }

  const newArticleIds: string[] = [];
  for (const c of fresh) {
    try {
      const a = await db.article.create({
        data: {
          url: c.url,
          title: c.title,
          description: c.description,
          imageUrl: c.imageUrl,
          publishedAt: c.publishedAt,
          scope: c.scope,
          uf: c.uf,
          municipalityKey: c.municipalityKey,
          clusterKey: clusterKey(c.title),
          searchText: normalize(`${c.title} ${c.description ?? ""}`),
          origin: c.origin,
          sourceId: sourceIds.get(c.sourceName)!,
        },
        select: { id: true },
      });
      newArticleIds.push(a.id);
    } catch (err) {
      console.warn("[ingest] erro ao salvar", c.url, (err as Error).message);
    }
  }

  // veículos ainda sem categoria → IA
  const unknownSources = await db.source.findMany({ where: { categoryKnown: false }, select: { id: true, name: true } });
  if (unknownSources.length) {
    const guessed = await classifySources(unknownSources.map((s) => s.name));
    for (const s of unknownSources) {
      const cat = guessed[s.name];
      if (cat) await db.source.update({ where: { id: s.id }, data: { category: cat, categoryKnown: true } });
    }
  }

  let classified = 0;
  let removed = 0;
  for (let round = 0; round < 4; round++) {
    const r = await classifyPending();
    classified += r.classified;
    removed += r.removed;
    if (r.classified + r.removed < 300) break;
  }
  return { fetched: all.length, created: newArticleIds.length, classified, removed, newArticleIds };
}

/** Classifica artigos pendentes; remove os que não são política. */
export async function classifyPending(limit = 300): Promise<{ classified: number; removed: number }> {
  const pending = await db.article.findMany({
    where: { classified: false },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: { source: { select: { name: true } } },
  });
  const inputs: ClassifyInput[] = pending.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    source: a.source.name,
    scopeHint: a.scope,
    scopeLocked: a.origin?.startsWith("gnews:uf") || a.origin?.startsWith("gnews:city") || false,
    locationHint: a.municipalityKey
      ? `município de ${a.municipalityKey}, ${a.uf}`
      : a.origin?.startsWith("gnews:uf") && a.uf
        ? `estado de ${UFS[a.uf]} (${a.uf})`
        : undefined,
  }));
  const results = await classifyArticles(inputs);
  let classified = 0;
  const toRemove: string[] = [];
  for (const r of results) {
    if (!r.political) {
      toRemove.push(r.id);
      continue;
    }
    const orig = pending.find((p) => p.id === r.id)!;
    let scope = r.scope;
    let uf = orig.uf;
    if (!orig.origin?.startsWith("gnews:uf") && !orig.origin?.startsWith("gnews:city")) {
      if (scope === "ESTADUAL") uf = r.uf;
      if (scope === "MUNICIPAL") scope = "ESTADUAL"; // sem cidade identificada, trate como estadual
      if (scope === "ESTADUAL" && !uf) scope = "FEDERAL";
    }
    await db.article.update({ where: { id: r.id }, data: { scope, uf, category: r.category, classified: true } });
    classified++;
  }
  if (toRemove.length) await db.article.deleteMany({ where: { id: { in: toRemove } } });
  return { classified, removed: toRemove.length };
}
