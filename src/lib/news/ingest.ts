import Parser from "rss-parser";
import type { Branch, Scope } from "@prisma/client";
import { db } from "@/lib/db";
import { fillTemplate, getSettings, type Settings } from "@/lib/settings";
import { UFS } from "@/lib/taxonomy";
import { clusterKey, normalize, stripHtml, truncate } from "@/lib/text";
import { classifyArticles, classifySources, setAiEnabled, type ClassifyInput } from "./classify";
import { FACT_CHECK_FEEDS, NATIONAL_FEEDS, guessSourceCategory } from "./sources";

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

type Candidate = {
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  publishedAt: Date;
  sourceName: string;
  sourceHomepage?: string;
  factCheck?: boolean;
  scope: Scope;
  scopeLocked: boolean;
  branch: Branch | null;
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
  feedId?: string;
  branch?: Branch | null;
  factCheck?: boolean;
};

// days = 0 (sem limite): o Google News só devolve os itens mais recentes (~100), então usamos uma janela de 30 dias
function googleNewsUrl(query: string, days: number): string {
  const q = encodeURIComponent(`${query} when:${days > 0 ? days : 30}d`);
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

async function fetchOrigin(o: Origin, maxAgeMs: number, localMaxAgeMs: number): Promise<Candidate[]> {
  const limitMs = (o.scope === "FEDERAL" ? maxAgeMs : localMaxAgeMs) || Infinity;
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
      if (Number.isNaN(publishedAt.getTime()) || Date.now() - publishedAt.getTime() > limitMs) continue;

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
        factCheck: o.factCheck,
        scope: o.scope,
        scopeLocked: !o.fixedSource,
        branch: o.branch ?? null,
        uf: o.uf,
        municipalityKey: o.municipalityKey,
        origin: o.label,
      });
    }
    if (o.feedId) await db.feedSource.update({ where: { id: o.feedId }, data: { lastOkAt: new Date(), lastError: null, lastCount: out.length } }).catch(() => undefined);
    return out;
  } catch (err) {
    console.warn(`[ingest] falha em ${o.label}:`, (err as Error).message);
    if (o.feedId) await db.feedSource.update({ where: { id: o.feedId }, data: { lastError: (err as Error).message.slice(0, 200) } }).catch(() => undefined);
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

/** Cadastra os feeds padrão na primeira execução (depois a lista é gerenciada no painel admin). */
export async function ensureDefaultFeeds(): Promise<void> {
  if (!(await db.feedSource.count())) {
    await db.feedSource.createMany({
      data: NATIONAL_FEEDS.map((f) => ({ name: f.name, feedUrl: f.feedUrl, homepage: f.homepage, category: f.category, scope: "FEDERAL" as const, branch: f.branch })),
      skipDuplicates: true,
    });
  }
  if (!(await db.setting.findUnique({ where: { key: "seed_factcheck" } }))) {
    await db.feedSource.createMany({
      data: FACT_CHECK_FEEDS.map((f) => ({ name: f.name, feedUrl: f.feedUrl, homepage: f.homepage, category: f.category, scope: "FEDERAL" as const, factCheck: true })),
      skipDuplicates: true,
    });
    await db.setting.create({ data: { key: "seed_factcheck", value: "1" } });
  }
  for (const f of NATIONAL_FEEDS.filter((x) => x.branch)) {
    await db.feedSource.updateMany({ where: { feedUrl: f.feedUrl, branch: null }, data: { branch: f.branch } });
  }
}

async function buildOrigins(cfg: Settings): Promise<Origin[]> {
  await ensureDefaultFeeds();
  const days = Math.max(0, Number(cfg.maxAgeDays) || 0);
  const localDays = Math.max(0, Number(cfg.localMaxAgeDays) || 0);
  const origins: Origin[] = [];

  const feeds = await db.feedSource.findMany({ where: { active: true } });
  for (const f of feeds) {
    origins.push({
      label: f.scope === "FEDERAL" ? `feed:${f.name}` : `local:${f.name}`,
      url: f.feedUrl,
      scope: f.scope,
      uf: f.uf,
      municipalityKey: f.municipalityKey,
      fixedSource: { name: f.name, homepage: f.homepage ?? f.feedUrl },
      feedId: f.id,
      branch: f.branch,
      factCheck: f.factCheck,
    });
  }

  const gnews = cfg.googleNews === "1";
  const BRANCHES: [Branch, "Legislativo" | "Executivo" | "Judiciario"][] = [
    ["LEGISLATIVO", "Legislativo"],
    ["EXECUTIVO", "Executivo"],
    ["JUDICIARIO", "Judiciario"],
  ];
  const q = (level: "Federal" | "State" | "City", p: "Legislativo" | "Executivo" | "Judiciario") => cfg[`query${level}${p}` as keyof Settings];
  if (gnews) {
    for (const [branch, p] of BRANCHES) {
      const query = q("Federal", p);
      if (query.trim()) origins.push({ label: `gnews:federal:${branch}`, url: googleNewsUrl(query, days), scope: "FEDERAL", uf: null, municipalityKey: null, branch });
    }
  }

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
  if (gnews) {
    for (const uf of ufs) {
      for (const [branch, p] of BRANCHES) {
        const query = q("State", p);
        if (!query.trim()) continue;
        origins.push({
          label: `gnews:uf:${uf}:${branch}`,
          url: googleNewsUrl(fillTemplate(query, { estado: UFS[uf], uf }), localDays),
          scope: "ESTADUAL",
          uf,
          municipalityKey: null,
          branch,
        });
      }
    }
    for (const c of cities.values()) {
      for (const [branch, p] of BRANCHES) {
        const query = q("City", p);
        if (!query.trim()) continue;
        origins.push({
          label: `gnews:city:${c.uf}:${c.key}:${branch}`,
          url: googleNewsUrl(fillTemplate(query, { cidade: c.name, estado: UFS[c.uf], uf: c.uf }), localDays),
          scope: "MUNICIPAL",
          uf: c.uf,
          municipalityKey: c.key,
          branch,
        });
      }
    }
  }
  return origins;
}

/** Testa um feed RSS (usado ao cadastrar): devolve quantos itens e o título do primeiro. */
export async function probeFeed(url: string): Promise<{ ok: true; items: number; title: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PoliticaBot/1.0)" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const feed = await parser.parseString((await res.text()).replace(/^[^<]+/, ""));
    if (!feed.items.length) return { ok: false, error: "O feed não tem itens" };
    return { ok: true, items: feed.items.length, title: feed.title ?? "" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function isLocalOrigin(origin: string | null): boolean {
  return Boolean(origin && (origin.startsWith("gnews:uf") || origin.startsWith("gnews:city") || origin.startsWith("local:")));
}

export type IngestResult = { fetched: number; created: number; classified: number; removed: number; newArticleIds: string[] };

export async function runIngest(): Promise<IngestResult> {
  const cfg = await getSettings();
  if (cfg.aiModel) process.env.ANTHROPIC_MODEL = cfg.aiModel;
  setAiEnabled(cfg.aiClassify === "1");
  const maxAgeMs = Math.max(0, Number(cfg.maxAgeDays) || 0) * 24 * 60 * 60 * 1000;
  const localMaxAgeMs = Math.max(0, Number(cfg.localMaxAgeDays) || 0) * 24 * 60 * 60 * 1000;
  const origins = await buildOrigins(cfg);
  const batches = await mapLimit(origins, 6, (o) => fetchOrigin(o, maxAgeMs, localMaxAgeMs));
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
        factCheck: fresh.find((c) => c.sourceName === name)?.factCheck ?? false,
      },
      update: fresh.find((c) => c.sourceName === name)?.factCheck ? { factCheck: true } : {},
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
          branch: c.branch,
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
    include: { source: { select: { name: true, factCheck: true } } },
  });
  const inputs: ClassifyInput[] = pending.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    source: a.source.name,
    scopeHint: a.scope,
    scopeLocked: isLocalOrigin(a.origin),
    branchHint: a.branch,
    locationHint: a.municipalityKey
      ? `município de ${a.municipalityKey}, ${a.uf}`
      : isLocalOrigin(a.origin) && a.uf
        ? `estado de ${UFS[a.uf]} (${a.uf})`
        : undefined,
  }));
  const results = await classifyArticles(inputs);
  let classified = 0;
  const toRemove: string[] = [];
  for (const r of results) {
    const orig = pending.find((p) => p.id === r.id)!;
    if (!r.political && !orig.source.factCheck) {
      toRemove.push(r.id);
      continue;
    }
    let scope = r.scope;
    let uf = orig.uf;
    if (!isLocalOrigin(orig.origin)) {
      if (scope === "ESTADUAL") uf = r.uf;
      if (scope === "MUNICIPAL") scope = "ESTADUAL"; // sem cidade identificada, trate como estadual
      if (scope === "ESTADUAL" && !uf) scope = "FEDERAL";
    }
    await db.article.update({ where: { id: r.id }, data: { scope, uf, category: r.category, branch: r.branch ?? orig.branch, classified: true } });
    classified++;
  }
  if (toRemove.length) await db.article.deleteMany({ where: { id: { in: toRemove } } });
  return { classified, removed: toRemove.length };
}
