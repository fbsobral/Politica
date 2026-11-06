import { safeFetch } from "@/lib/safe-url";
import Parser from "rss-parser";
import type { Branch, Scope } from "@prisma/client";
import { db } from "@/lib/db";
import { fillTemplate, getSettings, type Settings } from "@/lib/settings";
import { UFS } from "@/lib/taxonomy";
import { clusterKey, normalize, stripHtml, truncate } from "@/lib/text";
import { classifyArticles, classifySources, setAiEnabled, type ClassifyInput } from "./classify";
import { applyTiers } from "./tiers";
import { PARTIES } from "@/lib/quiz/data";
import { detectParties, searchQueryFor } from "@/lib/parties";
import { PARTY_FEEDS, partyFeedName, partyFeedUrl } from "./party-feeds";
import { FACT_CHECK_FEEDS, MORE_FEEDS, NATIONAL_FEEDS, guessSourceCategory } from "./sources";

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

/** Decodifica a resposta respeitando o charset (feeds antigos como o da Folha usam ISO-8859-1). */
async function readXml(res: Response): Promise<string> {
  const buf = new Uint8Array(await res.arrayBuffer());
  const head = new TextDecoder("latin1").decode(buf.slice(0, 300));
  const charset = (res.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1] ?? head.match(/encoding=["']([\w-]+)["']/i)?.[1] ?? "utf-8").toLowerCase();
  let text: string;
  try {
    text = new TextDecoder(charset).decode(buf);
  } catch {
    text = new TextDecoder("utf-8").decode(buf);
  }
  return text.replace(/^[^<]+/, "");
}

type Candidate = {
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  publishedAt: Date;
  sourceName: string;
  sourceHomepage?: string;
  /** veio de busca restrita a sites oficiais ou de domínio oficial (.gov.br, .leg.br, .jus.br...) */
  official?: boolean;
  factCheck?: boolean;
  party?: string | null;
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
  /** busca restrita a sites oficiais: tudo o que vier dela é fonte oficial */
  official?: boolean;
  branch?: Branch | null;
  factCheck?: boolean;
  party?: string | null;
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
    const feed = await parser.parseString(await readXml(res));
    const out: Candidate[] = [];
    for (const item of feed.items as Record<string, any>[]) {
      const url: string | undefined = item.link ?? item.guid;
      const rawTitle: string | undefined = item.title;
      if (!url || !rawTitle) continue;
      const publishedAt = new Date(item.isoDate ?? item.pubDate ?? Date.now());
      if (Number.isNaN(publishedAt.getTime()) || Date.now() - publishedAt.getTime() > limitMs) continue;

      let title = stripHtml(rawTitle);
      let sourceName = o.fixedSource?.name ?? "";
      let sourceHomepage = o.fixedSource?.homepage;
      if (!o.fixedSource) {
        // Google News: "Título - Veículo"; a tag <source url="..."> traz o site do veículo
        const fromTag = typeof item.sourceName === "string" ? item.sourceName : item.sourceName?._;
        const srcUrl = typeof item.sourceName === "object" ? item.sourceName?.$?.url : undefined;
        if (typeof srcUrl === "string" && /^https?:\/\//.test(srcUrl)) sourceHomepage = srcUrl;
        const m = title.match(/^(.*) - ([^-]+)$/);
        sourceName = (fromTag || m?.[2] || "").trim();
        if (m && (!fromTag || m[2].trim() === fromTag.trim())) title = m[1].trim();
        if (!sourceName) continue;
      } else if (o.url.includes("news.google.com")) {
        title = title.replace(/ - [^-]+$/, ""); // busca no Google News restrita a um site: tira o "- site" do título
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
        sourceHomepage,
        official: Boolean(o.official) || isOfficialUrl(sourceHomepage) || (!!o.fixedSource && isOfficialUrl(url)),
        factCheck: o.factCheck,
        party: o.party ?? null,
        scope: o.scope,
        scopeLocked: !o.fixedSource,
        branch: o.branch ?? null,
        uf: o.uf,
        municipalityKey: o.municipalityKey,
        origin: o.label,
      });
    }
    if (o.feedId) await db.feedSource.update({ where: { id: o.feedId }, data: { lastOkAt: new Date(), lastError: null, lastCount: out.length } }).catch(() => undefined);
    // a busca por partido traz ruído (siglas e nomes comuns): só fica o que cita o partido de fato
    const partyOrigin = o.label.match(/^gnews:party:(.+)$/)?.[1];
    if (partyOrigin) return out.filter((c) => detectParties(c.title).includes(partyOrigin));
    // buscas oficiais por domínio (ex.: sp.gov.br) trazem todas as prefeituras do estado: filtra pela esfera certa
    if (o.official && o.scope === "MUNICIPAL" && o.municipalityKey) return out.filter((c) => officialAboutCity(c, o.municipalityKey!));
    if (o.official && o.scope === "ESTADUAL") return out.filter((c) => !isMunicipalBody(c.sourceName, c.sourceHomepage));
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
  if (!(await db.setting.findUnique({ where: { key: "seed_more_feeds_1" } }))) {
    await db.feedSource.createMany({
      data: MORE_FEEDS.map((f) => ({ name: f.name, feedUrl: f.feedUrl, homepage: f.homepage, category: f.category, scope: "FEDERAL" as const, branch: f.branch })),
      skipDuplicates: true,
    });
    await db.setting.create({ data: { key: "seed_more_feeds_1", value: "1" } });
  }
  // sites oficiais dos partidos (as notícias deles ficam ligadas ao partido; o admin gerencia em Feeds RSS)
  if (!(await db.setting.findUnique({ where: { key: "seed_party_feeds_1" } }))) {
    await db.feedSource.createMany({
      data: PARTY_FEEDS.map((p) => ({ name: partyFeedName(p), feedUrl: partyFeedUrl(p), homepage: p.site ? `https://${p.site}` : new URL(p.feed!).origin, category: "PARTIDO" as const, scope: "FEDERAL" as const, party: p.sigla })),
      skipDuplicates: true,
    });
    await db.setting.create({ data: { key: "seed_party_feeds_1", value: "1" } });
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
      party: f.party,
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

  // notícias específicas de cada partido (aba Partidos)
  if (gnews) {
    for (const p of PARTIES) origins.push({ label: `gnews:party:${p.sigla}`, url: googleNewsUrl(searchQueryFor(p), days), scope: "FEDERAL", uf: null, municipalityKey: null });
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
    // veículos prioritários: buscas restritas ao site do veículo, por esfera
    const outlets = cfg.priorityOutlets.split(/[\s,;]+/).map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter((d) => d.includes("."));
    for (const d of outlets) {
      origins.push({ label: `gnews:prio:federal:${d}`, url: googleNewsUrl(`site:${d} (política OR governo OR Congresso OR STF OR eleições OR ministro)`, days), scope: "FEDERAL", uf: null, municipalityKey: null });
      for (const uf of ufs) {
        origins.push({ label: `gnews:uf:${uf}:PRIO:${d}`, url: googleNewsUrl(`site:${d} "${UFS[uf]}" (governador OR "governo do estado" OR assembleia OR eleição OR prefeito)`, localDays), scope: "ESTADUAL", uf, municipalityKey: null });
      }
      for (const c of cities.values()) {
        origins.push({ label: `gnews:city:${c.uf}:${c.key}:PRIO:${d}`, url: googleNewsUrl(`site:${d} "${c.name}" (prefeito OR prefeitura OR vereador OR câmara OR eleição)`, localDays), scope: "MUNICIPAL", uf: c.uf, municipalityKey: c.key });
      }
    }
    // fontes oficiais de cada esfera (governos, legislativos, tribunais), sempre coletadas
    origins.push({ label: "gnews:official:federal", url: googleNewsUrl(OFFICIAL_QUERY.federal(), days), scope: "FEDERAL", uf: null, municipalityKey: null, official: true });
    for (const uf of ufs) origins.push({ label: `gnews:uf:${uf}:OFICIAL`, url: googleNewsUrl(OFFICIAL_QUERY.state(uf), localDays), scope: "ESTADUAL", uf, municipalityKey: null, official: true });
    for (const c of cities.values()) origins.push({ label: `gnews:city:${c.uf}:${c.key}:OFICIAL`, url: googleNewsUrl(OFFICIAL_QUERY.city(c.uf, c.name), localDays), scope: "MUNICIPAL", uf: c.uf, municipalityKey: c.key, official: true });
    // eleições: nacional e por estado (inclui pesquisas)
    if (cfg.queryElectionFederal.trim()) {
      origins.push({ label: "gnews:elec:federal", url: googleNewsUrl(cfg.queryElectionFederal, days), scope: "FEDERAL", uf: null, municipalityKey: null });
    }
    for (const uf of ufs) {
      if (!cfg.queryElectionState.trim()) break;
      origins.push({ label: `gnews:uf:${uf}:ELEC`, url: googleNewsUrl(fillTemplate(cfg.queryElectionState, { estado: UFS[uf], uf }), localDays), scope: "ESTADUAL", uf, municipalityKey: null });
    }
    // checagens locais (estado e cidade)
    for (const uf of ufs) {
      if (!cfg.queryFactCheckState.trim()) break;
      origins.push({ label: `gnews:uf:${uf}:FC`, url: googleNewsUrl(fillTemplate(cfg.queryFactCheckState, { estado: UFS[uf], uf }), localDays), scope: "ESTADUAL", uf, municipalityKey: null, factCheck: true });
    }
    for (const c of cities.values()) {
      if (!cfg.queryFactCheckCity.trim()) break;
      origins.push({ label: `gnews:city:${c.uf}:${c.key}:FC`, url: googleNewsUrl(fillTemplate(cfg.queryFactCheckCity, { cidade: c.name, estado: UFS[c.uf], uf: c.uf }), localDays), scope: "MUNICIPAL", uf: c.uf, municipalityKey: c.key, factCheck: true });
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
    const res = await safeFetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PoliticaBot/1.0)" }, signal: AbortSignal.timeout(15000) });
    if (!res) return { ok: false, error: "Endereço não permitido (precisa ser um site público em http ou https)" };
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const feed = await parser.parseString(await readXml(res));
    if (!feed.items.length) return { ok: false, error: "O feed não tem itens" };
    return { ok: true, items: feed.items.length, title: feed.title ?? "" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Domínios de órgãos públicos brasileiros: governo, legislativo, judiciário, ministério público, defensoria e tribunais de contas. */
export function isOfficialUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return /(^|\.)(gov|leg|jus|mp|def)\.br$/.test(host);
  } catch {
    return false;
  }
}

const padded = (t: string) => ` ${normalize(t)} `;

/** Fonte de prefeitura ou câmara municipal (pelo nome do veículo). */
export function isMunicipalBody(sourceName: string, homepage?: string | null): boolean {
  const n = padded(sourceName);
  if (/ (prefeitura|prefeito|camara municipal|camara de vereadores|camara dos vereadores) /.test(n)) return true;
  // "Câmara de Taubaté" é municipal; "Câmara dos Deputados" não
  if (/ camara de /.test(n) && !/ deputados /.test(n)) return true;
  try {
    return homepage ? /(^|\.)(prefeitura|camara)[a-z0-9-]*\./.test(new URL(homepage).hostname) : false;
  } catch {
    return false;
  }
}

/**
 * Notícia oficial que é mesmo da cidade: a fonte é a prefeitura/câmara da própria cidade
 * ou o título fala da cidade. Evita que a prefeitura vizinha (que só cita a cidade no texto) entre no feed municipal.
 */
export function officialAboutCity(c: { title: string; sourceName: string; sourceHomepage?: string | null }, cityKey: string): boolean {
  const key = ` ${cityKey} `;
  const src = padded(c.sourceName);
  const ownSource = src.includes(key) || (() => {
    try {
      return c.sourceHomepage ? new URL(c.sourceHomepage).hostname.replace(/[^a-z0-9]/g, "").includes(cityKey.replace(/ /g, "")) : false;
    } catch {
      return false;
    }
  })();
  if (ownSource) return true;
  // fonte de outra cidade só entra se o título for sobre esta cidade
  return padded(c.title).includes(key);
}

/** Buscas no Google News restritas a sites oficiais, por esfera. */
const OFFICIAL_QUERY = {
  federal: () => "(site:gov.br OR site:leg.br OR site:jus.br) (governo OR ministério OR ministro OR Congresso OR Senado OR Câmara OR tribunal OR STF)",
  state: (uf: string) => {
    const u = uf.toLowerCase();
    return `(site:${u}.gov.br OR site:tj${u}.jus.br OR site:mp${u}.mp.br) (governo OR governador OR assembleia OR deputado OR secretaria OR tribunal) -prefeitura -vereador`;
  },
  city: (uf: string, city: string) => {
    const u = uf.toLowerCase();
    return `(site:${u}.gov.br OR site:${u}.leg.br) "${city}" (prefeitura OR prefeito OR câmara OR vereador OR secretaria OR município)`;
  },
};

function isLocalOrigin(origin: string | null): boolean {
  return Boolean(origin && (origin.startsWith("gnews:uf") || origin.startsWith("gnews:city") || origin.startsWith("local:")));
}

/** Remove notícias oficiais que entraram na esfera errada (antes do filtro por cidade/estado). */
async function cleanupOfficialStrays(): Promise<number> {
  const rows = await db.article.findMany({
    where: { origin: { endsWith: ":OFICIAL" }, createdAt: { gte: new Date(Date.now() - 45 * 86400000) }, favorites: { none: {} } },
    select: { id: true, title: true, scope: true, municipalityKey: true, source: { select: { name: true, homepage: true } } },
    take: 5000,
  });
  const bad = rows.filter((a) =>
    a.scope === "MUNICIPAL" && a.municipalityKey
      ? !officialAboutCity({ title: a.title, sourceName: a.source.name, sourceHomepage: a.source.homepage }, a.municipalityKey)
      : a.scope === "ESTADUAL" && isMunicipalBody(a.source.name, a.source.homepage),
  );
  if (bad.length) await db.article.deleteMany({ where: { id: { in: bad.map((b) => b.id) } } });
  return bad.length;
}

export type IngestResult = { fetched: number; created: number; classified: number; removed: number; newArticleIds: string[] };

/** Partidos citados no título/resumo. */
function partiesOf(title: string, description: string | null): string[] {
  return detectParties(`${title} ${description ?? ""}`);
}

/** Marca os artigos antigos (ainda não verificados) com os partidos citados. */
export async function backfillParties(limit = 3000): Promise<number> {
  const rows = await db.article.findMany({ where: { partiesChecked: false }, select: { id: true, title: true, description: true }, take: limit });
  for (const r of rows) await db.article.update({ where: { id: r.id }, data: { parties: partiesOf(r.title, r.description), partiesChecked: true } });
  return rows.length;
}

export async function runIngest(): Promise<IngestResult> {
  const cfg = await getSettings();
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
  // o mesmo texto do mesmo veículo chega com URLs diferentes (ex.: redirecionamentos do Google News)
  const seenTitle = new Set<string>();
  const fresh = [...byUrl.values()].filter((c) => {
    if (existing.has(c.url)) return false;
    const key = `${c.sourceName}|${normalize(c.title)}`;
    if (seenTitle.has(key)) return false;
    seenTitle.add(key);
    return true;
  });
  if (fresh.length) {
    const dupRows = await db.article.findMany({
      where: { title: { in: fresh.map((c) => c.title) } },
      select: { title: true, source: { select: { name: true } } },
    });
    const dbKeys = new Set(dupRows.map((r) => `${r.source.name}|${normalize(r.title)}`));
    for (let i = fresh.length - 1; i >= 0; i--) if (dbKeys.has(`${fresh[i].sourceName}|${normalize(fresh[i].title)}`)) fresh.splice(i, 1);
  }

  // assuntos que a IA já julgou "não é política" não voltam a ser salvos nem reclassificados (cada ida e volta gastaria tokens)
  if (fresh.length) {
    const keysOf = fresh.map((c) => clusterKey(c.title));
    const rej = new Set((await db.rejectedCluster.findMany({ where: { clusterKey: { in: keysOf }, at: { gte: new Date(Date.now() - 14 * 86400000) } }, select: { clusterKey: true } })).map((r) => r.clusterKey));
    if (rej.size) {
      for (let i = fresh.length - 1; i >= 0; i--) {
        const c = fresh[i];
        if (!c.factCheck && !c.official && !c.municipalityKey && !isLocalOrigin(c.origin) && rej.has(keysOf[i])) fresh.splice(i, 1);
      }
    }
  }

  // veículos
  const sourceIds = new Map<string, string>();
  const names = [...new Set(fresh.map((c) => c.sourceName))];
  const knownFeeds = new Map(NATIONAL_FEEDS.map((f) => [f.name, f]));
  const partySourceNames = new Map<string, "PARTIDO">(PARTY_FEEDS.map((p) => [partyFeedName(p), "PARTIDO" as const]));
  for (const name of names) {
    const feed = knownFeeds.get(name);
    const mine = fresh.filter((c) => c.sourceName === name);
    // veículo oficial: domínio de órgão público ou resultado de busca restrita a sites oficiais
    const official = !partySourceNames.has(name) && mine.some((c) => c.official);
    const guessed = official ? "ORGAO_OFICIAL" : (feed?.category ?? partySourceNames.get(name) ?? guessSourceCategory(name));
    const src = await db.source.upsert({
      where: { name },
      create: {
        name,
        homepage: feed?.homepage ?? mine.find((c) => c.sourceHomepage)?.sourceHomepage ?? null,
        category: guessed ?? "OUTRO",
        categoryKnown: guessed !== null,
        ...(partySourceNames.has(name) ? { tier: 3, tierBy: "default" } : {}),
        factCheck: mine.find((c) => c.factCheck)?.factCheck ?? false,
      },
      update: {
        ...(mine.some((c) => c.factCheck) ? { factCheck: true } : {}),
        ...(official ? { category: "ORGAO_OFICIAL", categoryKnown: true } : {}),
      },
    });
    sourceIds.set(name, src.id);
  }

  const srcFactCheck = new Map((await db.source.findMany({ where: { name: { in: names } }, select: { name: true, factCheck: true } })).map((x) => [x.name, x.factCheck]));
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
          factCheck: Boolean(c.factCheck) || (srcFactCheck.get(c.sourceName) ?? false),
          clusterKey: clusterKey(c.title),
          searchText: normalize(`${c.title} ${c.description ?? ""}`),
          parties: [...new Set([...partiesOf(c.title, c.description), ...(c.party ? [c.party] : [])])],
          partiesChecked: true,
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
    const answered = Object.keys(guessed).length > 0; // se a IA respondeu algo, quem ficou de fora vira OUTRO (não perguntar de novo a cada coleta)
    for (const s of unknownSources) {
      const cat = guessed[s.name] ?? (answered ? "OUTRO" : null);
      if (cat) await db.source.update({ where: { id: s.id }, data: { category: cat, categoryKnown: true } });
    }
  }

  await cleanupOfficialStrays().catch((err) => console.warn("[ingest] limpeza de oficiais", (err as Error).message));
  // veículos já cadastrados com site de órgão público passam a contar como oficiais
  await db.source.updateMany({
    where: { category: { notIn: ["ORGAO_OFICIAL", "PARTIDO"] }, OR: [".gov.br", ".leg.br", ".jus.br", ".mp.br", ".def.br", "//gov.br"].map((d) => ({ homepage: { contains: d } })) },
    data: { category: "ORGAO_OFICIAL", categoryKnown: true },
  }).catch((err) => console.warn("[ingest] fontes oficiais", (err as Error).message));
  await applyTiers();
  let classified = 0;
  let removed = 0;
  for (let round = 0; round < 6; round++) {
    const r = await classifyPending();
    classified += r.classified;
    removed += r.removed;
    if (r.classified + r.removed < 300) break;
  }
  await backfillParties().catch((err) => console.warn("[ingest] backfill de partidos", (err as Error).message));
  return { fetched: all.length, created: newArticleIds.length, classified, removed, newArticleIds };
}

/** Classifica artigos pendentes; remove os que não são política. */
export async function classifyPending(limit = 300): Promise<{ classified: number; removed: number; reused: number }> {
  const pending = await db.article.findMany({
    where: { classified: false },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: { source: { select: { name: true, factCheck: true, category: true } } },
  });
  if (!pending.length) return { classified: 0, removed: 0, reused: 0 };

  // ── economia de IA: reaproveita o julgamento de matérias do mesmo assunto (outros veículos) ──
  const since = new Date(Date.now() - 14 * 86400000);
  const keys = [...new Set(pending.map((a) => a.clusterKey))];
  const [donorRows, rejectedRows] = await Promise.all([
    db.article.findMany({
      where: { clusterKey: { in: keys }, classified: true, publishedAt: { gte: since } },
      select: { clusterKey: true, scope: true, uf: true, municipalityKey: true, origin: true, category: true, branch: true, cargo: true, poll: true },
      orderBy: { createdAt: "desc" },
    }),
    db.rejectedCluster.findMany({ where: { clusterKey: { in: keys }, at: { gte: since } }, select: { clusterKey: true } }),
  ]);
  const donors = new Map<string, typeof donorRows>();
  for (const d of donorRows) donors.set(d.clusterKey, [...(donors.get(d.clusterKey) ?? []), d]);
  const rejected = new Set(rejectedRows.map((r) => r.clusterKey));

  const toAi: typeof pending = [];
  const toRemove: string[] = [];
  let classified = 0;
  let reused = 0;
  for (const a of pending) {
    // notícias oficiais (governos, legislativos, tribunais) aparecem sempre, mesmo quando a IA não as considera política
    const keep = a.source.factCheck || a.factCheck || a.source.category === "PARTIDO" || a.source.category === "ORGAO_OFICIAL";
    if (!keep && !a.municipalityKey && !isLocalOrigin(a.origin) && rejected.has(a.clusterKey)) {
      toRemove.push(a.id); // mesmo assunto já julgado "não é política"
      continue;
    }
    const local = isLocalOrigin(a.origin);
    const donor = donors.get(a.clusterKey)?.find((d) => isLocalOrigin(d.origin) === local && d.municipalityKey === a.municipalityKey && (!local || d.uf === a.uf));
    if (!donor) {
      toAi.push(a);
      continue;
    }
    let scope = local ? a.scope : donor.scope;
    const uf = local ? a.uf : donor.uf;
    if (!local && scope === "ESTADUAL" && !uf) scope = "FEDERAL";
    await db.article.update({ where: { id: a.id }, data: { scope, uf, category: donor.category, branch: donor.branch ?? a.branch, cargo: donor.cargo, poll: donor.poll, classified: true } });
    classified++;
    reused++;
  }

  const inputs: ClassifyInput[] = toAi.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    source: a.source.name,
    scopeHint: a.scope,
    scopeLocked: isLocalOrigin(a.origin),
    branchHint: a.branch,
    clusterKey: a.clusterKey,
    locationHint: a.municipalityKey
      ? `município de ${a.municipalityKey}, ${a.uf}`
      : isLocalOrigin(a.origin) && a.uf
        ? `estado de ${UFS[a.uf]} (${a.uf})`
        : undefined,
  }));
  const results = await classifyArticles(inputs);
  const newlyRejected = new Set<string>();
  for (const r of results) {
    const orig = toAi.find((p) => p.id === r.id)!;
    if (!r.political && !orig.source.factCheck && !orig.factCheck && orig.source.category !== "PARTIDO" && orig.source.category !== "ORGAO_OFICIAL") {
      toRemove.push(r.id);
      if (!orig.municipalityKey && !isLocalOrigin(orig.origin)) newlyRejected.add(orig.clusterKey);
      continue;
    }
    let scope = r.scope;
    let uf = orig.uf;
    if (!isLocalOrigin(orig.origin)) {
      if (scope === "ESTADUAL") uf = r.uf;
      if (scope === "MUNICIPAL") scope = "ESTADUAL"; // sem cidade identificada, trate como estadual
      if (scope === "ESTADUAL" && !uf) scope = "FEDERAL";
    }
    await db.article.update({ where: { id: r.id }, data: { scope, uf, category: r.category, branch: r.branch ?? orig.branch, cargo: r.cargo, poll: r.poll, classified: true } });
    classified++;
  }
  if (newlyRejected.size) await db.rejectedCluster.createMany({ data: [...newlyRejected].map((clusterKey) => ({ clusterKey })), skipDuplicates: true });
  if (toRemove.length) await db.article.deleteMany({ where: { id: { in: toRemove } } });
  return { classified, removed: toRemove.length, reused };
}
