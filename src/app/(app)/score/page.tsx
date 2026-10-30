import Link from "next/link";
import { AskButton, type AskFocus } from "@/components/agent/ask-button";
import { ScoreLineChart, type LineSeries } from "@/components/score-line-chart";
import { ScoreEditor } from "@/components/score-editor";
import { ScoreTermTable, type TermRow } from "@/components/score-term-table";
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

function itemFocus(it: ScoreItem, years: number[], place: string): AskFocus {
  const rows = years.filter((y) => it.values[y] != null).map((y) => `${y}: ${formatValue(it.values[y], it.unit, it.decimals)}${it.notes[y] != null ? ` (nota ${Math.round(it.notes[y])})` : " (sem nota)"}`);
  return {
    title: `Score · ${it.name} · ${place}`,
    text: `Indicador do score dos governos (lado ${it.side === "economia" ? "econômico" : "social"}, ${it.better === "up" ? "quanto maior melhor" : "quanto menor melhor"}). A nota de cada ano mede a melhora em relação ao ano anterior, comparada com a das outras variações da série (0 a 100, 50 = típica). Valores e notas: ${rows.join("; ")}.`,
    suggestions: ["Por que esta nota ficou tão alta ou baixa em algum ano?", "O que explica a evolução deste indicador?", "Este indicador depende do governo?"],
  };
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

function ItemRows({ items, years, sideRow, place }: { items: ScoreItem[]; years: number[]; sideRow: (number | null)[]; place: string }) {
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
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href="/indicadores" className="font-medium hover:underline">{it.name}</Link>
                    <div className="text-xs text-faint">{it.better === "up" ? "quanto maior, melhor" : "quanto menor, melhor"}</div>
                  </div>
                  <AskButton compact focus={itemFocus(it, years, place)} />
                </div>
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

  const yearFocus = (y: (typeof r.years)[number], pl: string, t?: Term): AskFocus => ({
    title: `Score de ${y.year} · ${pl}`,
    text: `Score dos governos, ${pl}, ano ${y.year}${t ? ` (${t.name ?? t.role}, mandato ${t.from}–${t.to})` : ""}: econômico ${n0(y.economia)}, social ${n0(y.social)}, score ${n0(y.total)}. Indicadores e notas do ano: ${r.items.filter((i) => i.values[y.year] != null).map((i) => `${i.name} ${formatValue(i.values[y.year], i.unit, i.decimals)}${i.notes[y.year] != null ? ` (nota ${Math.round(i.notes[y.year])})` : ""}`).join("; ")}. Método: cada nota mede a melhora em relação ao ano anterior (0 a 100, 50 = variação típica da série); cada lado é a média das suas notas; o score é a média dos dois lados.`,
    suggestions: ["Por que este ano teve este score?", "O que puxou a nota para cima ou para baixo?", "Compare com o ano anterior"],
  });

  const yearRows: YearRow[] = [...r.years].reverse().map((y) => {
    const t = termOf(y.year);
    return {
      year: y.year, gov: t ? termLabel(t) : "—", color: t?.color,
      economia: n0(y.economia), economiaBg: heat(y.economia), social: n0(y.social), socialBg: heat(y.social), total: n0(y.total), totalBg: heat(y.total, 0.4),
      nEcon: 0, nSocial: 0,
      ask: yearFocus(y, place, termOf(y.year)),
      items: r.items.filter((i) => i.values[y.year] != null).map((i) => {
        const v = i.values[y.year], prev = i.values[y.year - 1];
        const dir = prev == null ? null : v === prev ? "igual" : (i.better === "up" ? v > prev : v < prev) ? "melhorou" : "piorou";
        return { name: i.name, side: i.side, value: formatValue(v, i.unit, i.decimals), prev: prev == null ? null : formatValue(prev, i.unit, i.decimals), dir, note: i.notes[y.year] ?? null, bg: heat(i.notes[y.year]) };
      }),
    };
  });

  const ITEM_COLORS = ["#7c3aed", "#0891b2", "#ca8a04", "#be185d", "#4d7c0f", "#c2410c", "#0f766e", "#6d28d9", "#a16207", "#1d4ed8"];
  const lineSeries: LineSeries[] = [
    { id: "total", label: "Score", color: "#111827", kind: "total", values: Object.fromEntries(r.years.map((y) => [y.year, y.total])) },
    { id: "economia", label: "Econômico", color: "#2563eb", kind: "economia", values: Object.fromEntries(r.years.map((y) => [y.year, y.economia])) },
    { id: "social", label: "Social", color: "#db2777", kind: "social", values: Object.fromEntries(r.years.map((y) => [y.year, y.social])) },
    ...r.items.map((i, k): LineSeries => ({ id: i.id, label: i.name, color: ITEM_COLORS[k % ITEM_COLORS.length], kind: "item", values: Object.fromEntries(years.map((yr) => [yr, i.notes[yr] ?? null])) })),
  ];

  const firstYear = (xs: { year: number; v: number | null }[]) => xs.find((x) => x.v != null)?.year ?? null;
  const firstTotal = firstYear(r.years.map((y) => ({ year: y.year, v: y.total })));
  const gaps = (["economia", "social"] as const).flatMap((side) => {
    const fy = firstYear(r.years.map((y) => ({ year: y.year, v: y[side] })));
    return fy != null && fy > from + 1 ? [{ side, fy }] : [];
  });
  const gapNote = firstTotal != null && firstTotal > from + 1 && gaps.length > 0
    ? `O score só começa em ${firstTotal}: ${gaps.map((g) => `o lado ${g.side === "economia" ? "econômico" : "social"} só tem nota a partir de ${g.fy}`).join(" e ")}. Antes disso, os indicadores escolhidos não têm dado publicado (a nota compara com o ano anterior, então precisa de dois anos seguidos). Início das séries: ${r.items.map((i) => `${i.name} ${Math.min(...Object.keys(i.values).map(Number))}`).join(", ")}. Não preenchemos esses anos com estimativas.`
    : null;

  const mean = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const termRows: TermRow[] = r.terms.map((t) => {
    const ys = r.years.filter((y) => t.years.includes(y.year));
    return {
      id: t.id, name: t.name ?? t.role, role: t.name ? `${t.role}` : "nome em breve", period: `${t.from}–${t.to > 2090 ? "hoje" : t.to}`, color: t.color,
      economia: n0(mean(ys.map((y) => y.economia))), economiaBg: heat(mean(ys.map((y) => y.economia))),
      social: n0(mean(ys.map((y) => y.social))), socialBg: heat(mean(ys.map((y) => y.social))),
      score: n0(t.avg), scoreBg: heat(t.avg, 0.4), scorePct: t.avg ?? 0, scoreColor: heatSolid(t.avg), verdict: verdict(t.avg), nYears: t.years.length,
      years: ys.map((y) => ({ year: y.year, economia: n0(y.economia), economiaBg: heat(y.economia), social: n0(y.social), socialBg: heat(y.social), total: n0(y.total), bg: heat(y.total, 0.4) })),
      items: r.items.map((i) => {
        const cells = ys.map((y) => ({ year: y.year, value: i.values[y.year] != null ? formatValue(i.values[y.year], i.unit, i.decimals) : "—", note: n0(i.notes[y.year]), bg: heat(i.notes[y.year]) }));
        const m = mean(ys.map((y) => i.notes[y.year] ?? null));
        return { name: i.name, side: i.side, cells, avg: n0(m), avgBg: heat(m, 0.4), has: m != null };
      }).filter((i) => i.has).map(({ has: _has, ...rest }) => rest),
      ask: { title: `Score · ${termLabel(t)} · ${place}`, text: `Score do governo ${termLabel(t)} (${t.role}, ${t.from}–${t.to > 2090 ? "hoje" : t.to}) em ${place}: média ${n0(t.avg)} de 100. Scores por ano: ${ys.map((y) => `${y.year}: econômico ${n0(y.economia)}, social ${n0(y.social)}, score ${n0(y.total)}`).join("; ")}. Método: nota de cada indicador = melhora em relação ao ano anterior comparada com as demais variações da série; lados econômico e social valem 50% cada.`, suggestions: ["Por que este governo teve esta nota?", "Compare este governo com o anterior", "Quais indicadores mais pesaram?"] },
    };
  });

  const sideOf = (side: "economia" | "social") => r.years.map((y) => y[side]);

  return (
    <div>
      <PageHeader eyebrow={`Números · ${place} · últimos ${range} anos`} title="Score dos governos" />
      <ScopeTabs base="/score" scope={scope} noAll params={{ anos: sp.anos }} />
      <RangeTabs base="/score" years={range} params={{ esfera: sp.esfera }} />
      <AskButton className="mb-6 ml-3 align-top" label="Perguntar sobre o score" focus={{ title: `Score dos governos · ${place}`, text: `Página Score dos governos (${place}, últimos ${range} anos). Resultado por governo: ${r.terms.map((t) => `${termLabel(t)} ${n0(t.avg)}`).join("; ")}. Indicadores usados: ${r.items.map((i) => i.name).join("; ")}. Método: cada indicador recebe nota anual (0 a 100) pela melhora em relação ao ano anterior comparada com as demais variações da série (mesma régua para todos os anos); lados econômico e social valem 50% cada, indicadores com peso igual dentro do lado; o score do governo é a média dos seus anos. É um índice calculado pelo Política, não um dado oficial.`, suggestions: ["Como o score é calculado?", "Por que não usar o nível do indicador em vez da melhora?", "O que o score não consegue mostrar?"] }} />

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
      <section className="mb-8"><ScoreTermTable rows={termRows} /></section>

      <section className="mb-8">
        <h2 className="display mb-1 text-2xl font-semibold">Ano a ano</h2>
        <p className="mb-3 text-sm text-muted">Veja a evolução do score, do lado econômico e do social, e escolha abaixo quais indicadores quer ver em linhas. Acima da linha de 50, o ano melhorou mais que o normal; abaixo, menos.</p>
        <div className="rounded-2xl border border-line bg-surface p-4"><ScoreLineChart years={years} lines={lineSeries} terms={terms.filter((t) => t.to >= from).map((t) => ({ id: t.id, name: t.name ?? t.role, from: t.from, to: t.to, color: t.color }))} /></div>
        <div className="mt-3"><ScoreYearTable rows={yearRows} /></div>
        {gapNote && <p className="mt-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs leading-relaxed"><b>Por que faltam anos no gráfico?</b> {gapNote}</p>}
        <p className="mt-2 text-xs text-faint">Anos sem nota num dos lados ficam sem score. O primeiro ano de cada indicador não tem nota, porque a nota compara com o ano anterior. {scope === "FEDERAL" && "Em 2016, Dilma governou até agosto; o ano está com Temer, que estava no cargo ao fim dele."}</p>
      </section>

      <details open className="group mb-8">
        <summary className="mb-1 flex cursor-pointer list-none items-center gap-2"><span className="text-muted transition-transform group-open:rotate-90">▸</span><h2 className="display text-2xl font-semibold">Econômico <span className="text-base font-normal text-muted">· vale 50% do score</span></h2></summary>
        <p className="mb-3 text-sm text-muted">Cada quadrado mostra o número publicado (em cima) e a nota do ano (embaixo). Passe o mouse ou toque para ver a explicação.</p>
        {econ.length ? <ItemRows items={econ} years={years} sideRow={sideOf("economia")} place={place} /> : <p className="text-sm text-muted">Nenhum indicador.</p>}
      </details>

      <details open className="group mb-8">
        <summary className="mb-1 flex cursor-pointer list-none items-center gap-2"><span className="text-muted transition-transform group-open:rotate-90">▸</span><h2 className="display text-2xl font-semibold">Social <span className="text-base font-normal text-muted">· vale 50% do score</span></h2></summary>
        <p className="mb-3 text-sm text-muted">Mesma leitura: número publicado em cima, nota do ano embaixo.</p>
        {soc.length ? <ItemRows items={soc} years={years} sideRow={sideOf("social")} place={place} /> : <p className="text-sm text-muted">Nenhum indicador.</p>}
      </details>

      <ScoreEditor scope={scope} options={opts} selected={selected} isCustom={Boolean(custom?.length)} />
    </div>
  );
}
