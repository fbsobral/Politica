const hits = new Map<string, number[]>();

/** Limite simples em memória (por processo): devolve false quando o usuário passou de `max` chamadas na janela. */
export function allow(key: string, max: number, windowMs = 3600_000): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(key, list);
    return false;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
