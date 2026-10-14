import * as cheerio from "cheerio";
import { aiEnabled, ask } from "@/lib/ai";
import { db } from "@/lib/db";

const UA = "Mozilla/5.0 (compatible; PoliticaBot/1.0; +https://politica.felipesobral.com)";

function safeUrl(u: string): URL | null {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return null;
    const h = url.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h) || h === "::1") return null;
    return url;
  } catch {
    return null;
  }
}

/** Links do Google News são redirecionamentos por JavaScript; resolve o endereço real do veículo. */
export async function resolveGoogleNews(url: string): Promise<string | null> {
  const m = url.match(/news\.google\.com\/(?:rss\/)?articles\/([^?/]+)/);
  if (!m) return null;
  const id = m[1];
  try {
    const page = await fetch(`https://news.google.com/rss/articles/${id}?hl=pt-BR&gl=BR&ceid=BR:pt-419`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    const html = await page.text();
    const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
    const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1];
    if (!sg || !ts) return null;
    const payload = JSON.stringify([[["Fbv4je", `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`, null, "generic"]]]);
    const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": UA },
      body: `f.req=${encodeURIComponent(payload)}`,
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    const line = text.split("\n\n")[1];
    const outer = JSON.parse(line) as unknown[][];
    const inner = JSON.parse(outer[0][2] as string) as unknown[];
    const real = inner[1];
    return typeof real === "string" && safeUrl(real) ? real : null;
  } catch {
    return null;
  }
}

async function readHtml(res: Response): Promise<string> {
  const buf = new Uint8Array(await res.arrayBuffer());
  const head = new TextDecoder("latin1").decode(buf.slice(0, 2000));
  const charset = (res.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1] ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

export type PageContent = { description: string | null; text: string };

/** Lê a página e extrai a descrição (og/meta) e os primeiros parágrafos do texto. */
export async function fetchPageContent(url: string): Promise<PageContent | null> {
  const safe = safeUrl(url);
  if (!safe) return null;
  try {
    const res = await fetch(safe, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!res.ok || !/html/i.test(res.headers.get("content-type") ?? "")) return null;
    const $ = cheerio.load(await readHtml(res));
    const meta = (sel: string) => $(sel).attr("content")?.replace(/\s+/g, " ").trim() || null;
    const description = meta('meta[property="og:description"]') ?? meta('meta[name="description"]') ?? meta('meta[name="twitter:description"]');
    $("script,style,nav,header,footer,aside,form,figure,noscript").remove();
    const scope = $("article").length ? $("article").first() : $("main").length ? $("main").first() : $("body");
    const paras = scope
      .find("p")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter((p) => p.length > 70);
    return { description, text: paras.join("\n").slice(0, 10000) };
  } catch {
    return null;
  }
}

const RETRY_MS = 6 * 60 * 60 * 1000;

export type ArticleSummary = { summary: string | null; kind: "ai" | "meta" | "none"; directUrl: string | null };

/** Resumo da matéria (guardado em cache): lê o texto no site do veículo e resume com o Claude; senão usa a descrição do site. */
export async function summarizeArticle(id: string): Promise<ArticleSummary | null> {
  const a = await db.article.findUnique({ where: { id }, select: { id: true, url: true, title: true, summary: true, summaryKind: true, summaryAt: true, directUrl: true, description: true } });
  if (!a) return null;
  if (a.summaryKind && (a.summaryKind !== "none" || (a.summaryAt && Date.now() - a.summaryAt.getTime() < RETRY_MS))) {
    return { summary: a.summary, kind: a.summaryKind as ArticleSummary["kind"], directUrl: a.directUrl };
  }

  const real = a.directUrl ?? (await resolveGoogleNews(a.url)) ?? (a.url.includes("news.google.com") ? null : a.url);
  const content = real ? await fetchPageContent(real) : null;

  let summary: string | null = null;
  let kind: ArticleSummary["kind"] = "none";
  if (content && content.text.length >= 400 && aiEnabled()) {
    try {
      const out = (
        await ask(
          `Você resume matérias jornalísticas brasileiras para um app de acompanhamento político. O leitor deve conseguir ENTENDER a matéria só lendo o seu resumo, sem abrir o site.
Escreva em português, de forma neutra e fiel, em 3 parágrafos curtos separados por linha em branco (cerca de 150 a 250 palavras no total; se o texto original for curto, seja proporcional):
1) o fato principal: quem, o quê, quando e onde;
2) os detalhes que sustentam a notícia: números, datas, nomes, argumentos e posições de cada lado, motivos e contexto;
3) as consequências e os próximos passos (o que muda, o que vem a seguir), se o texto mencionar.
Não acrescente nada que não esteja no texto, não opine e não repita o título. Sem markdown, sem listas, sem marcadores.`,
          `Título: ${a.title}\n\nTexto da matéria:\n${content.text}`,
          1000,
          "summary",
        )
      ).trim();
      if (out) {
        summary = out;
        kind = "ai";
      }
    } catch (err) {
      console.warn("[summary] IA falhou:", (err as Error).message);
    }
  }
  if (!summary && content?.description && content.description.length > 40) {
    summary = content.description;
    kind = "meta";
  }
  if (!summary && a.description && a.description.length > 40) {
    summary = a.description;
    kind = "meta";
  }
  await db.article.update({ where: { id }, data: { summary, summaryKind: kind, summaryAt: new Date(), ...(real && real !== a.url ? { directUrl: real } : {}) } });
  return { summary, kind, directUrl: real && real !== a.url ? real : a.directUrl };
}
