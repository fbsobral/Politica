"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IbovData, Move } from "@/lib/ibovespa";
import { Segmented } from "@/components/controls";
import { presidentAt, presidentSpans } from "@/lib/presidents";

type Range = "1m" | "6m" | "1a" | "2a" | "5a";
const RANGES: { id: Range; label: string; days: number }[] = [
  { id: "1m", label: "1 mês", days: 31 },
  { id: "6m", label: "6 meses", days: 183 },
  { id: "1a", label: "1 ano", days: 366 },
  { id: "2a", label: "2 anos", days: 731 },
  { id: "5a", label: "5 anos", days: 1830 },
];
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtD = (d: string, long = false) => {
  const [y, m, dd] = d.split("-").map(Number);
  return long ? `${dd} de ${MES[m - 1]} de ${y}` : `${String(dd).padStart(2, "0")}/${String(m).padStart(2, "0")}/${String(y).slice(2)}`;
};
const pc = (v: number, d = 2) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
const pts = (v: number) => Math.round(v).toLocaleString("pt-BR");

function pearson(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 20) return null;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : null;
}

const Dir = ({ v }: { v: number }) => <b className={v >= 0 ? "text-ok" : "text-danger"}>{v >= 0 ? "▲" : "▼"} {pc(v)}</b>;

export function IbovespaPanel({ data, themes }: { data: IbovData; themes: Record<string, string> }) {
  const [range, setRange] = useState<Range>("1a");
  const [dir, setDir] = useState<"all" | "up" | "down">("all");
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(860);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = data.points;
  const last = all[all.length - 1];
  const start = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)!.days;
    return new Date(Date.parse(last.d) - days * 864e5).toISOString().slice(0, 10);
  }, [range, last.d]);
  const i0 = Math.max(0, all.findIndex((p) => p.d >= start));
  const view = all.slice(i0);
  const moves = data.moves.filter((m) => m.d >= start);
  const selic = data.selic.filter((s) => s.d >= start && s.d <= last.d);

  /* ── estatísticas e inferências do período ── */
  const stats = useMemo(() => {
    const rets: number[] = [], usd: number[] = [];
    let peak = view[0].close, dd = 0;
    for (let i = 1; i < view.length; i++) {
      const r = (view[i].close / view[i - 1].close - 1) * 100;
      rets.push(r);
      const u = data.usdRet[i0 + i];
      if (u !== null && u !== undefined) usd.push(u);
      peak = Math.max(peak, view[i].close);
      dd = Math.min(dd, view[i].close / peak - 1);
    }
    const aligned = rets.map((r, k) => [r, data.usdRet[i0 + k + 1]] as const).filter(([, u]) => u !== null && u !== undefined) as [number, number][];
    const corr = pearson(aligned.map((x) => x[0]), aligned.map((x) => x[1]));
    const mean = rets.reduce((s, x) => s + x, 0) / Math.max(1, rets.length);
    const vol = Math.sqrt(rets.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, rets.length - 1)) * Math.sqrt(252);
    const total = (view[view.length - 1].close / view[0].close - 1) * 100;
    // temas por direção: o tema principal de cada dia marcante
    const tally = (list: Move[]) => {
      const m = new Map<string, number>();
      for (const x of list) if (x.themes[0]) m.set(x.themes[0].id, (m.get(x.themes[0].id) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    const ups = moves.filter((m) => m.ret > 0), downs = moves.filter((m) => m.ret < 0);
    // Copom: variação do índice nos 20 pregões seguintes a cada decisão
    const after = selic.map((s) => {
      const k = all.findIndex((p) => p.d >= s.d);
      if (k < 0 || k + 20 >= all.length) return null;
      return { up: s.to > s.from, r: (all[k + 20].close / all[k].close - 1) * 100 };
    }).filter((x): x is { up: boolean; r: number } => !!x);
    const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
    return { total, dd: dd * 100, vol, corr, ups, downs, upThemes: tally(ups), downThemes: tally(downs), hikeAfter: avg(after.filter((a) => a.up).map((a) => a.r)), cutAfter: avg(after.filter((a) => !a.up).map((a) => a.r)), nHike: after.filter((a) => a.up).length, nCut: after.filter((a) => !a.up).length, noNews: moves.filter((m) => !m.articles.length).length };
  }, [view, moves, selic, all, data.usdRet, i0]);

  const inferences: string[] = [];
  if (stats.downThemes[0]) inferences.push(`Nas quedas fortes do período, o tema mais presente nas notícias foi ${themes[stats.downThemes[0][0]]} (${stats.downThemes[0][1]} de ${stats.downs.length} dias).`);
  if (stats.upThemes[0]) inferences.push(`Nas altas fortes, o tema que mais apareceu foi ${themes[stats.upThemes[0][0]]} (${stats.upThemes[0][1]} de ${stats.ups.length} dias).`);
  if (stats.corr !== null && Math.abs(stats.corr) >= 0.2)
    inferences.push(`Bolsa e dólar andaram em direções ${stats.corr < 0 ? "opostas" : "iguais"} na maior parte dos dias (correlação de ${stats.corr.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}): ${stats.corr < 0 ? "quando o dólar sobe, o Ibovespa tende a cair — sinal de saída de investidores estrangeiros ou aumento de risco." : "um padrão incomum, que costuma aparecer quando fatores externos movem os dois juntos."}`);
  if (stats.hikeAfter !== null) inferences.push(`Nos 20 pregões após ${stats.nHike === 1 ? "a alta" : `as ${stats.nHike} altas`} da Selic do período, o índice variou em média ${pc(stats.hikeAfter, 1)}.`);
  if (stats.cutAfter !== null) inferences.push(`Após ${stats.nCut === 1 ? "o corte" : `os ${stats.nCut} cortes`} da Selic, a variação média em 20 pregões foi de ${pc(stats.cutAfter, 1)}.`);
  if (stats.noNews > 0) inferences.push(`${stats.noNews === 1 ? "1 dia marcante não teve" : `${stats.noNews} dias marcantes não tiveram`} matérias de economia coletadas na janela; neles a explicação se apoia só no dólar e no Copom, ou fica em aberto.`);

  /* ── gráfico ── */
  const H = W < 560 ? 240 : 300;
  const m = { l: W < 560 ? 44 : 58, r: 12, t: 34, b: 26 };
  const presSpans = presidentSpans(view.map((p) => p.d));
  const lo = Math.min(...view.map((p) => p.close)), hi = Math.max(...view.map((p) => p.close));
  const pad = (hi - lo) * 0.08 || 1000;
  const yMin = lo - pad, yMax = hi + pad;
  const x = (i: number) => m.l + (i / Math.max(1, view.length - 1)) * (W - m.l - m.r);
  const y = (v: number) => m.t + ((yMax - v) / (yMax - yMin)) * (H - m.t - m.b);
  const idxOf = new Map(view.map((p, i) => [p.d, i]));
  // marcas redondas no eixo (ex.: 120 mil, 140 mil…)
  const ticks = (() => {
    const raw = (yMax - yMin) / 4;
    const p10 = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * p10).find((v) => v >= raw * 0.7) ?? raw;
    const out: number[] = [];
    for (let t = Math.ceil(yMin / step) * step; t <= yMax; t += step) out.push(t);
    return out;
  })();
  const xTicks = (() => {
    const n = W < 560 ? 4 : 6;
    return Array.from({ length: n }, (_, k) => Math.round((k / (n - 1)) * (view.length - 1)));
  })();
  const h = hover !== null ? view[hover] : null;
  const hRet = hover !== null && hover > 0 ? (view[hover].close / view[hover - 1].close - 1) * 100 : null;

  const list = moves.filter((mv) => (dir === "all" ? true : dir === "up" ? mv.ret > 0 : mv.ret < 0)).sort((a, b) => Math.abs(b.ret) - Math.abs(a.ret));
  const shown = more ? list : list.slice(0, 8);
  const current = sel ? data.moves.find((mv) => mv.d === sel) ?? null : null;
  const pick = (d: string) => {
    setSel(d);
    requestAnimationFrame(() => detail.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  return (
    <div className="space-y-8">
      <section aria-label="Gráfico">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Segmented label="Período" value={range} onChange={setRange} options={RANGES.map((r) => ({ v: r.id, l: r.label }))} />
          <p className="text-sm text-muted">No período: <Dir v={stats.total} /> · de {pts(view[0].close)} para {pts(last.close)} pontos</p>
        </div>
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-hidden>
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 bg-brand" />Ibovespa (pontos)</span>
          <span className="inline-flex items-center gap-1.5"><span className="text-ok">▲</span><span className="text-danger">▼</span> dias com variação de 1,5% ou mais (toque para ver o motivo)</span>
          {selic.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0 border-l border-dashed border-gold" />decisão do Copom que mudou a Selic</span>}
        </div>
        <div className="card relative p-3 sm:p-5">
          <div ref={box} className="w-full" />
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-pan-y" role="img" aria-label="Ibovespa no período, com dias de alta e queda forte" onMouseLeave={() => setHover(null)}
            onPointerMove={(e) => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * W;
              setHover(Math.max(0, Math.min(view.length - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (view.length - 1)))));
            }}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="3 4" />
                <text x={m.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="var(--faint)">{W < 560 ? `${Math.round(t / 1000)} mil` : pts(t)}</text>
              </g>
            ))}
            {xTicks.map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === view.length - 1 ? "end" : "middle"} fontSize="10.5" fill="var(--faint)">{fmtD(view[i].d)}</text>)}
            {/* quem era o presidente: faixa no topo e fundo suave */}
            {presSpans.map(({ term, i0, i1 }, k) => {
              const xa = Math.max(m.l, x(i0 - 0.5)), xb = Math.min(W - m.r, x(i1 + 0.5));
              if (xb - xa < 1) return null;
              return (
                <g key={`${term.id}-${i0}`}>
                  <rect x={xa} width={xb - xa} y={m.t} height={H - m.t - m.b} fill={term.color} fillOpacity="0.05" />
                  <rect x={xa + (k ? 1 : 0)} width={Math.max(0, xb - xa - (k ? 1 : 0))} y={m.t - 9} height="4" rx="2" fill={term.color} fillOpacity="0.8" />
                  {xb - xa > term.name.length * 6.2 + 6 && <text x={(xa + xb) / 2} y={m.t - 14} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={term.color}>{term.name}</text>}
                </g>
              );
            })}
            {selic.map((s) => {
              const i = view.findIndex((p) => p.d >= s.d);
              if (i < 0) return null;
              return (
                <g key={s.d}>
                  <line x1={x(i)} x2={x(i)} y1={m.t} y2={H - m.b} stroke="var(--gold)" strokeDasharray="3 3" />
                  {W >= 560 && view.length < 400 && <text x={x(i) + 3} y={m.t + 9} fontSize="9.5" fill="var(--muted)">Selic {s.to > s.from ? "↑" : "↓"} {s.to.toLocaleString("pt-BR")}%</text>}
                </g>
              );
            })}
            <polyline points={view.map((p, i) => `${x(i)},${y(p.close)}`).join(" ")} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" />
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={H - m.b} stroke="var(--line-strong)" />}
            {moves.map((mv) => {
              const i = idxOf.get(mv.d);
              if (i === undefined) return null;
              const up = mv.ret > 0;
              const cx = x(i), cy = y(mv.close) + (up ? -9 : 9);
              const big = Math.abs(mv.ret) >= 3 || mv.d === sel;
              const s = big ? 6 : 4.5;
              return (
                <g key={mv.d} onClick={() => pick(mv.d)} className="cursor-pointer" role="button" aria-label={`${fmtD(mv.d, true)}: ${pc(mv.ret)}`}>
                  <circle cx={cx} cy={cy} r="12" fill="transparent" />
                  <path d={up ? `M${cx} ${cy - s} L${cx + s} ${cy + s * 0.7} L${cx - s} ${cy + s * 0.7}Z` : `M${cx} ${cy + s} L${cx + s} ${cy - s * 0.7} L${cx - s} ${cy - s * 0.7}Z`} fill={up ? "var(--ok)" : "var(--danger)"} stroke={mv.d === sel ? "var(--ink)" : "var(--surface)"} strokeWidth="1.5" />
                </g>
              );
            })}
            {h && <circle cx={x(hover!)} cy={y(h.close)} r="4" fill="var(--brand)" stroke="var(--surface)" strokeWidth="2" />}
          </svg>
          {h && (
            <div className="pointer-events-none absolute left-4 top-3 rounded-xl border border-line bg-surface/95 p-2.5 text-xs shadow-pop backdrop-blur sm:left-20">
              <p className="font-bold">{fmtD(h.d, true)}</p>
              {presidentAt(h.d) && <p className="text-muted">Presidente: {presidentAt(h.d)!.name}</p>}
              <p>{pts(h.close)} pontos {hRet !== null && <>· <Dir v={hRet} /></>}</p>
              {data.moves.some((mv) => mv.d === h.d) && <p className="text-faint">Toque no marcador para ver o motivo</p>}
            </div>
          )}
        </div>
      </section>

      <section aria-label="Inferências do período" className="card p-5 sm:p-6">
        <p className="eyebrow">Inferências do período</p>
        <h2 className="display text-xl font-semibold">O que moveu a bolsa</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Variação", pc(stats.total, 1)],
            ["Maior queda desde o pico", pc(stats.dd, 1)],
            ["Volatilidade anual", `${stats.vol.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`],
            ["Dias fortes", `${stats.ups.length} ▲ · ${stats.downs.length} ▼`],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-surface-2 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{l}</p><p className="display text-xl font-semibold">{v}</p></div>
          ))}
        </div>
        {(stats.downThemes.length > 0 || stats.upThemes.length > 0) && (
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            {[{ t: "Temas nas quedas", l: stats.downThemes, n: stats.downs.length, c: "bg-danger" }, { t: "Temas nas altas", l: stats.upThemes, n: stats.ups.length, c: "bg-ok" }].map((g) => (
              <div key={g.t}>
                <p className="mb-2 text-sm font-semibold">{g.t}</p>
                {g.l.length ? (
                  <ul className="space-y-1.5">
                    {g.l.slice(0, 5).map(([id, n]) => (
                      <li key={id} className="grid grid-cols-[9.5rem_1fr_auto] items-center gap-2 text-xs">
                        <span className="truncate">{themes[id]}</span>
                        <span className="h-2 rounded-[4px] bg-line"><span className={`block h-2 rounded-[4px] ${g.c}`} style={{ width: `${(n / Math.max(1, g.n)) * 100}%` }} /></span>
                        <b className="tabular-nums">{n} dia{n > 1 ? "s" : ""}</b>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-muted">Sem dias com notícias suficientes.</p>}
              </div>
            ))}
          </div>
        )}
        {inferences.length > 0 && (
          <ul className="mt-5 space-y-2 border-t border-line pt-4 text-sm leading-relaxed">
            {inferences.map((t) => <li key={t} className="flex gap-2.5"><span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-brand" aria-hidden />{t}</li>)}
          </ul>
        )}
        <p className="mt-4 text-xs leading-relaxed text-faint">Inferências automáticas a partir das notícias coletadas pelo app e de dados do Banco Central. Mostram associação, não provam causa: a bolsa reage a muitos fatores ao mesmo tempo.</p>
      </section>

      <section aria-label="Dias que mais mexeram">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Altas e quedas fortes</p>
            <h2 className="display text-2xl font-semibold">Os dias que mais mexeram</h2>
          </div>
          <Segmented label="Direção" value={dir} onChange={setDir} options={[{ v: "all", l: "Todos" }, { v: "up", l: "▲ Altas" }, { v: "down", l: "▼ Quedas" }]} />
        </div>

        {current && <MoveDetail ref={detail} mv={current} themes={themes} onClose={() => setSel(null)} />}

        {list.length ? (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {shown.map((mv) => (
              <li key={mv.d}>
                <button type="button" onClick={() => pick(mv.d)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink/5 ${mv.d === sel ? "bg-brand-soft/50" : ""}`}>
                  <span className="w-20 flex-none text-sm tabular-nums"><Dir v={mv.ret} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{fmtD(mv.d, true)}</span>
                    <span className="block truncate text-xs text-muted">{mv.themes.length ? mv.themes.slice(0, 3).map((t) => themes[t.id]).join(" · ") : "sem notícias de economia na janela"}</span>
                  </span>
                  <span className="hidden flex-none text-xs text-faint sm:block">{mv.articles.length} matéria{mv.articles.length === 1 ? "" : "s"}</span>
                  <span className="flex-none text-brand" aria-hidden>›</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted">Nenhum dia com variação de 1,5% ou mais neste período.</p>}
        {list.length > 8 && <button type="button" onClick={() => setMore(!more)} className="mt-3 text-sm font-semibold text-brand hover:underline">{more ? "Mostrar menos" : `Ver todos os ${list.length} dias`}</button>}
      </section>
    </div>
  );
}

function MoveDetail({ mv, themes, onClose, ref }: { mv: Move; themes: Record<string, string>; onClose: () => void; ref: React.Ref<HTMLDivElement> }) {
  const [ai, setAi] = useState<{ state: "idle" | "loading" | "done" | "error"; text?: string }>({ state: "idle" });
  useEffect(() => setAi({ state: "idle" }), [mv.d]);
  const explain = async () => {
    setAi({ state: "loading" });
    try {
      const r = await fetch("/api/ibovespa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ d: mv.d }) });
      const j = (await r.json()) as { text?: string; error?: string };
      setAi(j.text ? { state: "done", text: j.text } : { state: "error", text: j.error });
    } catch {
      setAi({ state: "error" });
    }
  };
  const main = mv.themes[0];
  const conf = { alta: "text-ok", média: "text-muted", baixa: "text-faint" }[mv.confidence];
  return (
    <div ref={ref} className="card scroll-mt-24 border-2 border-brand/30 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{fmtD(mv.d, true)}</p>
          <p className="display mt-1 text-2xl font-semibold"><Dir v={mv.ret} /> <span className="text-base font-normal text-muted">· fechou em {pts(mv.close)} pontos</span></p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink">✕</button>
      </div>

      <div className="mt-4 rounded-xl bg-surface-2 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Provável motivo · inferência</p>
        {main ? (
          <p className="mt-1 text-sm leading-relaxed">
            O que mais aparece nas notícias e sinais do dia é <b>{themes[main.id]}</b>
            {mv.themes[1] ? <>, seguido de <b>{themes[mv.themes[1].id]}</b></> : null}. Confiança <b className={conf}>{mv.confidence}</b>
            {mv.confidence === "baixa" ? ": poucas evidências na janela." : mv.confidence === "média" ? ": algumas matérias e sinais apontam nessa direção." : ": várias matérias e sinais convergem."}
          </p>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-muted">Não há matérias de economia coletadas nem sinais fortes (dólar, Copom) nesse dia. O movimento pode ter vindo do exterior ou de notícias que o app não acompanha.</p>
        )}
        {mv.themes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {mv.themes.slice(0, 5).map((t) => <span key={t.id} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand">{themes[t.id]} · {t.score}</span>)}
          </div>
        )}
        {mv.signals.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {mv.signals.map((s) => <li key={s.text}>• {s.text}</li>)}
          </ul>
        )}
        <div className="mt-3 border-t border-line pt-3">
          {ai.state === "done" ? (
            <p className="text-sm leading-relaxed"><span className="mr-1 rounded bg-gold/25 px-1.5 py-0.5 text-[10px] font-bold uppercase">IA</span>{ai.text}</p>
          ) : (
            <button type="button" onClick={explain} disabled={ai.state === "loading"} className="btn btn-secondary btn-sm">
              {ai.state === "loading" ? "Analisando as manchetes…" : "Explicar com IA"}
            </button>
          )}
          {ai.state === "error" && <p className="mt-2 text-xs text-danger">Não foi possível gerar agora{ai.text ? ` (${ai.text})` : ""}.</p>}
        </div>
      </div>

      <p className="mb-2 mt-5 text-sm font-semibold">Matérias do dia ({mv.articles.length})</p>
      {mv.articles.length ? (
        <ul className="space-y-2">
          {mv.articles.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-line p-3 transition-colors hover:border-brand hover:bg-brand-soft/40">
                <span className="block text-sm font-semibold leading-snug">{a.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                  <b className="text-ink">{a.source}</b>
                  <span>{new Date(a.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  {a.market && <span className="rounded-full bg-ink/5 px-1.5 font-semibold">fala da bolsa</span>}
                  {a.themes.map((t) => <span key={t} className="rounded-full bg-brand-soft px-1.5 font-semibold text-brand">{themes[t]}</span>)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nenhuma matéria de economia ou mercado coletada entre o fechamento anterior e o fim desse pregão{Date.parse(mv.d) < Date.now() - 200 * 864e5 ? " (notícias antigas podem ter sido removidas pela retenção do app)" : ""}.</p>
      )}
    </div>
  );
}
