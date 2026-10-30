import Link from "next/link";
import { ScoreEditor } from "@/components/score-editor";
import { ScoreYearTable, type YearRow } from "@/components/score-year-table";
import { PageHeader, RangeTabs, ScopeTabs, rangeOf } from "@/components/ui";
import { UF_CODE } from "@/lib/budget";
import { ibgeIdFor } from "@/lib/ibge";
import { getTermNames } from "@/lib/indicators/mandates";
import { lastClosedYear, type Scope } from "@/lib/indicators/core";
import { formatValue } from "@/lib/indicators/format";
import { PRESIDENTS, candidates, computeScore, cycleTerms, defaultSelection, type ScoreItem, type Term } from "@/lib/indicators/score";
import { SCOPE_SLUG, UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Score dos governos" };
export const dynamic = "force-dynamic";

const n0 = (v: number | null | undefined) => (v == null ? "—" : Math.round(v).toString());

/** 0 (vermelho) → 50 (amarelo) → 100 (verde). Com transparência, funciona nos temas claro e escuro. */
const heat = (v: number | null | undefined, alpha = 0.28) => (v == null ? undefined : `hsl(${Math.round((v / 100) * 125)} 62% 46% / ${alpha})`);
const heatSolid = (v: number | null | undefined) => (v == null ? "var(--faint)" : `hsl(${Math.round((v / 100) * 125)} 58% 40%)`);

/** Leitura em palavras simples da nota (50 = melhora típica da própria série). */
function verdict(v: number | null | undefined): string {
  if (v == null) return "sem dados suficientes";
  if (v >= 65) return "melhorou mais que o normal";
  if (v >= 55) return "um pouco melhor que o normal";
  if (v > 45) return "dentro do normal";
  if (v > 35) return "um pouco pior que o normal";
  return "piorou mais que o normal";
}

const termLabel = (t: Term) => t.name ?? `${t.role} · mandato`;

function Legend() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted" aria-label="Legenda de cores">
      <span>piorou</span>
      <span className="h-3 w-28 rounded-full" style={{ background: "linear-gradient(90deg, hsl(0 62% 46% / .55), hsl(60 62% 46% / .55), hsl(125 62% 46% / .55))" }} />
      <span>melhorou</span>
    </div>
  );
}

function YearChart({ years, terms }: { years: { year: number; total: number | null }[]; terms: Term[] }) {
  const W = 720, H = 220, pl = 28, pr = 8, pt = 14, pb = 34;
  const n = years.length;
  const bw = (W - pl - pr) / n;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / 100);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Score de cada ano" className="w-full">
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={pl} x2={W - pr} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={g === 50 ? 0.35 : 0.12} strokeDasharray={g === 50 ? "4 4" : undefined} />
          <text x={pl - 4} y={y(g) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.6">{g}</text>
        </g>
      ))}
      <text x={W - pr} y={y(50) - 3} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.6">melhora típica</text>
      {years.map((d, i) => {
        const t = terms.find((x) => d.year >= x.from && d.year <= x.to);
        const x = pl + i * bw + bw * 0.18;
        const w = bw * 0.64;
        return (
          <g key={d.year}>
            {d.total != null ? (
              <>
                <rect x={x} y={y(d.total)} width={w} height={y(0) - y(d.total)} rx="3" fill={t?.color ?? "#17407f"} opacity="0.9" />
                <text x={x + w / 2} y={y(d.total) - 4} textAnchor="middle" fontSize={n > 12 ? 8 : 10} fontWeight="600" fill="currentColor">{Math.round(d.total)}</text>
              </>
            ) : (
              <text x={x + w / 2} y={y(0) - 4} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.45">—</text>
            )}
            <text x={x + w / 2} y={H - pb + 13} textAnchor="middle" fontSize={n > 12 ? 8 : 10} fill="currentColor" opacity="0.75">{n > 12 ? String(d.year).slice(2) : d.year}</text>
          </g>
        );
      })}
      {terms.map((t) => {
        const a = years.findIndex((d) => d.year >= t.from && d.year <= t.to);
        if (a < 0) return null;
        const b = years.length - 1 - [...years].reverse().findIndex((d) => d.year >= t.from && d.year <= t.to);
        const x1 = pl + a * bw + 2, x2 = pl + (b + 1) * bw - 2;
        return (
          <g key={t.id}>
            <line x1={x1} x2={x2} y1={H - 8} y2={H - 8} stroke={t.color} strokeWidth="3" strokeLinecap="round" />
            {x2 - x1 > 46 && <text x={(x1 + x2) / 2} y={H - 12} textAnchor="middle" fontSize="9" fill={t.color} fontWeight="600">{(t.name ?? t.role).split(" ").slice(-1)[0]}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function ItemRows({ items, years, sideRow }: { items: ScoreItem[]; years: number[]; sideRow: (number | null)[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full border-collapse text-sm" style={{ minWidth: Math.max(560, 200 + years.length * 62) }}>
        <thead>
          <tr className="text-xs text-muted">
            <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-medium">Indicador</th>
            {years.map((y) => <th key={y} className="px-1 py-2 text-center font-medium">{y}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-line">
              <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left align-middle font-normal">
                <Link href="/indicadores" className="font-medium hover:underline">{it.name}</Link>
                <div className="text-xs text-faint">{it.better === "up" ? "quanto maior, melhor" : "quanto menor, melhor"}</div>
              </th>
              {years.map((y) => {
                const v = it.values[y];
                const note = it.notes[y];
                const prev = it.values[y - 1];
                const better = v != null && prev != null ? (it.better === "up" ? v > prev : v < prev) : null;
                const same = v != null && prev != null && v === prev;
                const tip = v == null ? `${y}: sem dado publicado` : note == null ? `${y}: ${formatValue(v, it.unit, it.decimals)}. Sem ano anterior publicado para comparar, então não tem nota.` : `${y}: ${formatValue(v, it.unit, it.decimals)}. ${same ? "Ficou igual ao" : better ? "Melhorou em relação ao" : "Piorou em relação ao"} ano anterior (${formatValue(prev, it.unit, it.decimals)}). Nota ${Math.round(note)} de 100.`;
                return (
                  <td key={y} title={tip} className="px-1 py-1.5 text-center tabular-nums" style={{ background: heat(note) }}>
                    {v == null ? <span className="text-faint">—</span> : (
                      <>
                        <div className="text-[13px] font-semibold leading-tight">{formatValue(v, it.unit, it.decimals)}</div>
                        <div className="text-[11px] leading-tight text-muted">
                          {note == null ? "s/ nota" : <><span style={{ color: heatSolid(note) }}>{same ? "＝" : better ? "▲" : "▼"}</span> {Math.round(note)}</>}
                        </div>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t-2 border-line font-semibold">
            <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left">Nota do lado</th>
            {sideRow.map((v, i) => <td key={i} className="px-1 py-2 text-center tabular-nums" style={{ background: heat(v, 0.4) }}>{n0(v)}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default async function ScorePage({ searchParams }: { searchParams: Promise<{ esfera?: string; anos?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope: Scope = (SCOPE_SLUG[sp.esfera ?? "federal"] as Scope | undefined) ?? "FEDERAL";
  const range = rangeOf(sp.anos);
  const from = lastClosedYear() - range + 1;
  const geo = { uf: user.uf ?? "", ufCode: UF_CODE[user.uf ?? ""] ?? 0, ibge: String((await ibgeIdFor(user.uf ?? "", user.municipalityKey ?? "")) ?? ""), municipalityKey: user.municipalityKey ?? "" };
  const place = scope === "FEDERAL" ? "Brasil" : scope === "ESTADUAL" ? UFS[user.uf ?? ""] ?? "Estado" : user.municipality ?? "Município";

  const custom = ((user.scoreConfig ?? {}) as Record<string, string[]>)[scope];
  const selected = custom?.length ? custom : defaultSelection(scope);
  const terms = scope === "FEDERAL" ? PRESIDENTS : cycleTerms(scope, await getTermNames(scope, geo));
  const r = await computeScore(scope, geo, selected, from, terms);
  const years = r.years.map((y) => y.year);
  const econ = r.items.filter((i) => i.side === "economia");
  const soc = r.items.filter((i) => i.side === "social");
  const termOf = (y: number) => terms.find((t) => y >= t.from && y <= t.to);
  const opts = candidates(scope).map((c) => ({ id: c.ind.id, name: c.ind.name, side: c.side }));

  const yearRows: YearRow[] = [...r.years].reverse().map((y) => {
    const t = termOf(y.year);
    return {
      year: y.year, gov: t ? termLabel(t) : "—", color: t?.color,
      economia: n0(y.economia), economiaBg: heat(y.economia), social: n0(y.social), socialBg: heat(y.social), total: n0(y.total), totalBg: heat(y.total, 0.4),
      nEcon: 0, nSocial: 0,
      items: r.items.filter((i) => i.values[y.year] != null).map((i) => {
        const v = i.values[y.year], prev = i.values[y.year - 1];
        const dir = prev == null ? null : v === prev ? "igual" : (i.better === "up" ? v > prev : v < prev) ? "melhorou" : "piorou";
        return { name: i.name, side: i.side, value: formatValue(v, i.unit, i.decimals), prev: prev == null ? null : formatValue(prev, i.unit, i.decimals), dir, note: i.notes[y.year] ?? null, bg: heat(i.notes[y.year]) };
      }),
    };
  });

  const sideOf = (side: "economia" | "social") => r.years.map((y) => y[side]);

  return (
    <div>
      <PageHeader eyebrow={`Números · ${place} · últimos ${range} anos`} title="Score dos governos" />
      <ScopeTabs base="/score" scope={scope} noAll params={{ anos: sp.anos }} />
      <RangeTabs base="/score" years={range} params={{ esfera: sp.esfera }} />

      <section className="mb-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="display text-xl font-semibold">Como ler esta página</h2>
        <ol className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
          <li><span className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper">1</span><b>Cada indicador ganha uma nota por ano.</b> Ela mostra se o número <i>melhorou</i> ou <i>piorou</i> em relação ao ano anterior, comparado com os outros anos. 50 é uma variação típica; 100, a maior melhora; 0, a maior piora.</li>
          <li><span className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper">2</span><b>Economia e social valem metade cada.</b> A nota do ano é a média dos dois lados. Dentro de cada lado, todos os indicadores pesam igual.</li>
          <li><span className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper">3</span><b>O governo recebe a média dos seus anos.</b> Todos os anos e governos usam a mesma régua, sem peso extra para ninguém.</li>
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3">
          <Legend />
          <span className="text-xs text-muted">▲ melhorou · ▼ piorou · ＝ igual ao ano anterior · — sem dado publicado</span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-faint"><b>Índice calculado pelo Política, não é um dado oficial.</b> Os valores de cada indicador vêm das fontes oficiais, como na aba Indicadores; só a nota é uma conta nossa. O score resume, não dá veredito: clima, economia mundial e pandemia pesam nos números e estão fora do controle de um governo.</p>
      </section>

      {(r.sides.economia === 0 || r.sides.social === 0) && (
        <p className="mb-6 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm">
          <b>Sem score nesta esfera.</b> {r.sides.economia === 0 ? "Nenhum indicador econômico" : "Nenhum indicador social"} com dado publicado entre os escolhidos. O score só existe quando os dois lados têm pelo menos um indicador.
        </p>
      )}

      <h2 className="display mb-3 text-2xl font-semibold">Resultado por governo</h2>
      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {r.terms.map((t) => (
          <div key={t.id} className="card-flat overflow-hidden p-0">
            <div className="h-1.5" style={{ background: t.color }} />
            <div className="p-4">
              <p className="font-semibold leading-tight">{t.name ?? t.role}</p>
              <p className="text-xs text-muted">{t.name ? `${t.role} · ` : ""}{t.from}–{t.to > 2090 ? "hoje" : t.to}</p>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="display text-5xl font-semibold tabular-nums" style={{ color: heatSolid(t.avg) }}>{n0(t.avg)}</span>
                <span className="text-sm text-muted">/ 100</span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full" style={{ width: `${t.avg ?? 0}%`, background: heatSolid(t.avg) }} /></div>
              <p className="mt-2 text-sm">{verdict(t.avg)}</p>
              <p className="mt-0.5 text-xs text-faint">{t.years.length ? `Média de ${t.years.length} ${t.years.length === 1 ? "ano" : "anos"} com nota` : "Nenhum ano com nota completa"}</p>
              {t.years.length > 0 && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-ink">Detalhar nota</summary>
                  <ul className="mt-2 space-y-1">
                    {r.years.filter((y) => t.years.includes(y.year)).map((y) => (
                      <li key={y.year} className="flex items-center justify-between rounded-md px-2 py-1 text-xs tabular-nums" style={{ background: heat(y.total) }}>
                        <span className="font-semibold">{y.year}</span>
                        <span className="text-muted">econ. {n0(y.economia)} · social {n0(y.social)}</span>
                        <span className="font-semibold">{n0(y.total)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted">Nota do governo = média dos scores dos anos acima ({t.years.map((yr) => n0(r.years.find((x) => x.year === yr)?.total)).join(" + ")}) ÷ {t.years.length} = <b>{n0(t.avg)}</b>. Use &ldquo;Detalhar&rdquo; em cada ano, abaixo, para ver os indicadores.</p>
                </details>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="mb-8">
        <h2 className="display mb-1 text-2xl font-semibold">Ano a ano</h2>
        <p className="mb-3 text-sm text-muted">Cada barra é o score do ano; a cor é a do governo. Acima da linha tracejada, o ano melhorou mais que o normal; abaixo, menos.</p>
        <div className="rounded-2xl border border-line bg-surface p-3"><YearChart years={r.years} terms={terms} /></div>
        <div className="mt-3"><ScoreYearTable rows={yearRows} /></div>
        <p className="mt-2 text-xs text-faint">Anos sem nota num dos lados ficam sem score. O primeiro ano de cada indicador não tem nota, porque a nota compara com o ano anterior. {scope === "FEDERAL" && "Em 2016, Dilma governou até agosto; o ano está com Temer, que estava no cargo ao fim dele."}</p>
      </section>

      <section className="mb-8">
        <h2 className="display mb-1 text-2xl font-semibold">Econômico <span className="text-base font-normal text-muted">· vale 50% do score</span></h2>
        <p className="mb-3 text-sm text-muted">Cada quadrado mostra o número publicado (em cima) e a nota do ano (embaixo). Passe o mouse ou toque para ver a explicação.</p>
        {econ.length ? <ItemRows items={econ} years={years} sideRow={sideOf("economia")} /> : <p className="text-sm text-muted">Nenhum indicador.</p>}
      </section>

      <section className="mb-8">
        <h2 className="display mb-1 text-2xl font-semibold">Social <span className="text-base font-normal text-muted">· vale 50% do score</span></h2>
        <p className="mb-3 text-sm text-muted">Mesma leitura: número publicado em cima, nota do ano embaixo.</p>
        {soc.length ? <ItemRows items={soc} years={years} sideRow={sideOf("social")} /> : <p className="text-sm text-muted">Nenhum indicador.</p>}
      </section>

      <ScoreEditor scope={scope} options={opts} selected={selected} isCustom={Boolean(custom?.length)} />
    </div>
  );
}
