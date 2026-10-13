import { createHash } from "node:crypto";

/** minúsculas, sem acentos, só letras/números/espaço */
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripHtml(input: string | undefined | null): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set(
  "a o as os de da do das dos e em no na nos nas um uma para por com que se ao aos sobre apos ate entre como mais mas ou sua seu suas seus ja foi sao ser esta estao tem vai diz diz".split(" "),
);

/** Chave para agrupar a mesma notícia publicada por veículos diferentes. */
export function clusterKey(title: string): string {
  const tokens = normalize(title)
    .split(" ")
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  const top = Array.from(new Set(tokens)).sort().slice(0, 8).join(" ");
  return createHash("sha1").update(top).digest("hex").slice(0, 16);
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

export function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
