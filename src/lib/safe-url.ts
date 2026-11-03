import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Faixas que o servidor nunca deve acessar a pedido de uma URL externa (rede interna, loopback, metadados de nuvem). */
function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/** Só http(s), sem credenciais na URL, porta padrão e sem nome de host interno. Não faz DNS (use assertPublicUrl antes de buscar). */
export function safeUrl(u: string): URL | null {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    if (url.port && !["80", "443", ""].includes(url.port)) return null;
    const h = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan") || !h.includes(".") && !isIP(h)) return null;
    if (isIP(h) && isPrivateIp(h)) return null;
    return url;
  } catch {
    return null;
  }
}

/** Confere também o DNS: o nome precisa resolver só para endereços públicos (evita apontar um domínio para a rede interna). */
export async function assertPublicUrl(u: string): Promise<URL | null> {
  const url = safeUrl(u);
  if (!url) return null;
  const h = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(h)) return url;
  try {
    const addrs = await lookup(h, { all: true });
    return addrs.length && addrs.every((a) => !isPrivateIp(a.address)) ? url : null;
  } catch {
    return null;
  }
}

/** fetch que valida a URL (e cada redirecionamento) antes de acessar. */
export async function safeFetch(u: string, init: RequestInit = {}, maxRedirects = 4): Promise<Response | null> {
  let current = u;
  for (let i = 0; i <= maxRedirects; i++) {
    const url = await assertPublicUrl(current);
    if (!url) return null;
    const res = await fetch(url, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      current = new URL(loc, url).toString();
      continue;
    }
    return res;
  }
  return null;
}
