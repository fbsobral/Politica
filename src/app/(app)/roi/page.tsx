import Link from "next/link";
import { Suspense } from "react";
import { Fragment } from "react";
import { AskButton } from "@/components/agent/ask-button";
import { RoiChart, type RoiPoint } from "@/components/roi-chart";
import { PageSkeleton, PageHeader, ScopeTabs } from "@/components/ui";
import { brlShort, getBudgetHistory, UF_CODE, type Series } from "@/lib/budget";
import { ibgeIdFor } from "@/lib/ibge";
import { getSeries } from "@/lib/indicators/catalog";
import { formatValue } from "@/lib/indicators/format";
import { KIND_LABEL, roiWindows, summarize, type RoiWindow } from "@/lib/indicators/roi";
import { suggestIndicators } from "@/lib/indicators/roi-suggest";
import { RoiGastoSelect } from "@/components/roi-gasto-select";
import { candidates } from "@/lib/indicators/score";
import { SCOPE_SLUG, UFS } from "@/lib/taxonomy";
import type { Scope } from "@prisma/client";
import { requireUser } from "@/lib/user";

export const metadata = { title: "ROI do orçamento" };
export const dynamic = "force-dynamic";

const COLORS = ["#2563eb", "#db2777", "#0e8a5f", "#ca8a04", "#7c3aed", "#c2410c"];
const HORIZONS = [1, 2, 3, 4] as const;

/** Sugestões de pares gasto → indicador (só aparecem se a função existir no orçamento da esfera). */
const SUGGESTIONS: { fn: RegExp; label: string; inds: string[] }[] = [
  { fn: /^sa[uú]de$/i, label: "Saúde → mortalidade", inds: ["mortalidade-infantil", "mortalidade-5", "mortalidade-materna"] },
  { fn: /^educa[cç][aã]o$/i, label: "Educação → analfabetismo e jovens", inds: ["analfabetismo", "nem-nem"] },
  { fn: /^seguran[cç]a p[uú]blica$/i, label: "Segurança → homicídios", inds: ["homicidios", "transito"] },
  { fn: /^assist[eê]ncia social$/i, label: "Assistência social → pobreza e desigualdade", inds: ["pobreza", "gini"] },
  { fn: /^trabalho$/i, label: "Trabalho → desemprego e informalidade", inds: ["desemprego", "informalidade", "subutilizacao"] },
];

const keyOf = (kind: "expense" | "nature", code: string) => `${kind}:${code}`;
const unitWord = (u: string) => (u === "pct" ? "ponto percentual" : "unidade");
const fmtPct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

function WindowTable({ ws, unit, decimals, h }: { ws: RoiWindow[]; unit: Parameters<typeof formatValue>[1]; decimals?: number; h: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="px-3 py-2 text-left font-medium">Período</th>
            <th className="px-3 py-2 text-right font-medium">Gasto no início</th>
            <th className="px-3 py-2 text-right font-medium">Gasto no fim</th>
            <th className="px-3 py-2 text-right font-medium">Variação do gasto</th>
            <th className="px-3 py-2 text-right font-medium">Investido no período</th>
            <th className="px-3 py-2 text-right font-medium">Indicador (início → fim)</th>
            <th className="px-3 py-2 text-right font-medium">Melhora</th>
            <th className="px-3 py-2 text-right font-medium">Custo por {unitWord(unit)} de melhora</th>
            <th className="px-3 py-2 text-left font-medium">Leitura</th>
          </tr>
        </thead>
        <tbody>
          {ws.length === 0 && <tr><td colSpan={9} className="px-3 py-4 text-muted">Sem períodos de {h} {h === 1 ? "ano" : "anos"} com gasto e indicador publicados ao mesmo tempo.</td></tr>}
          {ws.map((w) => {
            const good = w.improvement > 0;
            return (
              <tr key={w.from} className="border-t border-line">
                <td className="px-3 py-2 font-semibold tabular-nums">{w.from} → {w.to}</td>
                <td className="px-3 py-2 text-right tabular-nums">{brlShort(w.spendFrom)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{brlShort(w.spendTo)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtPct(w.spendChange)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{brlShort(w.invested)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatValue(w.indFrom, unit, decimals)} → {formatValue(w.indTo, unit, decimals)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums" style={{ background: w.improvement === 0 ? undefined : `hsl(${good ? 125 : 0} 62% 46% / 0.22)` }}>{w.improvement > 0 ? "▲ " : w.improvement < 0 ? "▼ " : "＝ "}{formatValue(Math.abs(w.improvement), unit, decimals)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{w.costPerUnit != null ? brlShort(w.costPerUnit) : "—"}</td>
                <td className="px-3 py-2 text-xs text-muted">{KIND_LABEL[w.kind]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

async function RoiContent({ searchParams }: { searchParams: Promise<{ esfera?: string; gasto?: string; ind?: string | string[]; h?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope: Scope = (SCOPE_SLUG[sp.esfera ?? "federal"] as Scope | undefined) ?? "FEDERAL";
  const h = HORIZONS.includes(Number(sp.h) as 1) ? Number(sp.h) : 1;
  const geo = { uf: user.uf, ufCode: UF_CODE[user.uf] ?? 0, ibge: String((await ibgeIdFor(user.uf, user.municipalityKey)) ?? ""), municipalityKey: user.municipalityKey };
  const place = scope === "FEDERAL" ? "Brasil" : scope === "ESTADUAL" ? UFS[user.uf] ?? "Estado" : user.municipality;
  const hist = await getBudgetHistory(scope, { uf: user.uf, municipalityKey: user.municipalityKey });
  const cands = candidates(scope);

  const fns = hist?.expense.filter((s) => !s.parent) ?? [];
  const subs = hist?.expense.filter((s) => s.parent) ?? [];
  const natures = hist?.nature ?? [];
  const all: { key: string; label: string; s: Series | null }[] = [
    { key: "total", label: "Despesa total", s: null },
    ...fns.map((s) => ({ key: keyOf("expense", s.code), label: s.name, s })),
    ...natures.map((s) => ({ key: keyOf("nature", s.code), label: s.name, s })),
  ];
  const chosen = all.find((x) => x.key === sp.gasto) ?? all.find((x) => x.s && /^sa[uú]de$/i.test(x.s.name)) ?? all[0];
  const subOf = subs.find((x) => keyOf("expense", x.code) === sp.gasto);
  const spendSeries: Series | null = subOf ?? chosen?.s ?? null;
  const spendLabel = subOf ? subOf.name : chosen?.label ?? "Despesa total";
  const parentName = subOf ? fns.find((f) => f.code === subOf.parent)?.name : null;
  const sug = suggestIndicators(spendLabel, parentName);
  const aligned = sug.ids.filter((id) => cands.some((c) => c.ind.id === id));
  const askedInds = (Array.isArray(sp.ind) ? sp.ind : sp.ind ? [sp.ind] : []).filter((id) => cands.some((c) => c.ind.id === id));
  const autoPicked = askedInds.length === 0;
  const indIds = autoPicked ? aligned : askedInds;

  const nominal: Record<number, number> = !hist ? {} : spendSeries ? spendSeries.values : hist.totals.expense;
  const real: Record<number, number> = {};
  if (hist) for (const [y, v] of Object.entries(nominal)) if (hist.deflator[Number(y)]) real[Number(y)] = v * hist.deflator[Number(y)];

  const analyses = await Promise.all(indIds.map(async (id, k) => {
    const c = cands.find((x) => x.ind.id === id)!;
    const series = (await getSeries(c.ind, scope, geo)) ?? {};
    const byH = HORIZONS.map((hh) => ({ h: hh, ws: roiWindows(real, series, c.ind.better!, hh) }));
    return { c, series, byH, color: COLORS[k % COLORS.length] };
  }));

  const suggestions = SUGGESTIONS.flatMap((sg) => {
    const f = fns.find((x) => sg.fn.test(x.name));
    return f ? [{ ...sg, key: keyOf("expense", f.code) }] : [];
  });
  const base = `/roi?esfera=${scope.toLowerCase()}`;
  const hrefOf = (o: { gasto?: string; ind?: string[]; h?: number }) => `${base}&gasto=${encodeURIComponent(o.gasto ?? chosen?.key ?? "total")}${(o.ind ?? indIds).map((i) => `&ind=${i}`).join("")}&h=${o.h ?? h}`;
  const sideLabel = (s: "economia" | "social") => (s === "economia" ? "Econômicos" : "Sociais");

  return (
    <div>
      <PageHeader eyebrow={`Números · ${place} · orçamento × indicadores`} title="ROI do orçamento" />
      <ScopeTabs base="/roi" scope={scope} noAll />

      <section className="mb-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="display text-xl font-semibold">Como ler esta página</h2>
        <ol className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
          <li><span className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper">1</span><b>Escolha um gasto e um ou mais indicadores.</b> Por exemplo, o gasto com Saúde e a mortalidade infantil.</li>
          <li><span className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper">2</span><b>Compare antes e depois.</b> Para cada período de 1, 2, 3 ou 4 anos, veja quanto o gasto real mudou, quanto foi investido e se o indicador melhorou.</li>
          <li><span className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper">3</span><b>Veja o custo da melhora.</b> É o total investido dividido pela melhora do indicador. Só existe quando o indicador melhorou.</li>
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-faint"><b>Cálculo do Política, não é dado oficial, e não prova causa e efeito.</b> Os gastos vêm do Tesouro Nacional (Siconfi) e os indicadores das fontes oficiais; só a comparação é nossa. Os gastos são corrigidos pela inflação (IPCA) para os preços do último ano. Outros fatores, como a economia, outras esferas de governo e o tempo que um investimento leva para dar resultado, também mexem nos indicadores.</p>
      </section>

      <form method="get" action="/roi" className="mb-6 rounded-2xl border border-line bg-surface p-5">
        <input type="hidden" name="esfera" value={scope.toLowerCase()} />
        <input type="hidden" name="h" value={h} />
        <label className="block text-sm font-semibold" htmlFor="gasto">1. Gasto do orçamento</label>
        <RoiGastoSelect base={base} value={subOf ? keyOf("expense", subOf.code) : chosen?.key ?? "total"} h={h}>
          <option value="total">Despesa total</option>
          <optgroup label="Por função de governo">
            {fns.map((f) => (
              <Fragment key={f.code}>
                <option value={keyOf("expense", f.code)}>{f.name}</option>
                {subs.filter((x) => x.parent === f.code).map((x) => <option key={x.code} value={keyOf("expense", x.code)}>{"   ↳ "}{x.name}</option>)}
              </Fragment>
            ))}
          </optgroup>
          <optgroup label="Por tipo de gasto">
            {natures.map((n) => <option key={n.code} value={keyOf("nature", n.code)}>{n.name}</option>)}
          </optgroup>
        </RoiGastoSelect>

        <p className="mt-4 text-sm font-semibold">2. Indicadores para medir o resultado <span className="font-normal text-muted">(escolha um ou mais)</span></p>
        {aligned.length > 0 ? (
          <p className="mt-1 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs"><b>Alinhados a &ldquo;{spendLabel}&rdquo;{autoPicked ? " (já selecionados)" : ""}:</b> {aligned.map((id) => cands.find((c) => c.ind.id === id)!.ind.name).join(", ")}. {sug.why}</p>
        ) : (
          <p className="mt-1 rounded-xl border border-line px-3 py-2 text-xs text-muted">Não há indicador diretamente alinhado a &ldquo;{spendLabel}&rdquo; nos dados atuais. Escolha manualmente o que fizer sentido.</p>
        )}
        <div className="mt-2 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {(["economia", "social"] as const).map((side) => (
            <fieldset key={side}>
              <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">{sideLabel(side)}</legend>
              {cands.filter((c) => c.side === side).map((c) => (
                <label key={c.ind.id} className="flex cursor-pointer items-start gap-2 py-0.5 text-sm">
                  <input type="checkbox" name="ind" value={c.ind.id} defaultChecked={indIds.includes(c.ind.id)} className="mt-1" />
                  <span>{c.ind.name}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <button type="submit" className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">Analisar</button>
      </form>

      {suggestions.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Sugestões:</span>
          {suggestions.map((sg) => (
            <Link key={sg.label} href={hrefOf({ gasto: sg.key, ind: sg.inds.filter((i) => cands.some((c) => c.ind.id === i)) })} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-ink/5">{sg.label}</Link>
          ))}
        </div>
      )}

      {!hist && <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">Sem dados de orçamento para {place} nesta esfera.</p>}
      {hist && indIds.length === 0 && <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">Escolha pelo menos um indicador e toque em Analisar.</p>}

      {hist && analyses.length > 0 && (
        <>
          <div role="tablist" aria-label="Horizonte" className="mb-4 inline-flex items-center gap-1 rounded-2xl border border-line bg-surface p-1 shadow-card">
            {HORIZONS.map((hh) => (
              <Link key={hh} role="tab" aria-selected={hh === h} href={hrefOf({ h: hh })} className={`rounded-xl px-3 py-2 text-sm font-semibold ${hh === h ? "bg-ink text-paper" : "text-muted hover:bg-ink/5 hover:text-ink"}`}>
                {hh === 1 ? "Anual (1 ano)" : `${hh} anos`}
              </Link>
            ))}
          </div>

          {analyses.map((a) => {
            const years = hist.years.filter((y) => real[y] != null || a.series[y] != null);
            const points: RoiPoint[] = years.map((y) => ({ year: y, spend: real[y] ?? null, spendLabel: real[y] != null ? brlShort(real[y]) : "—", ind: a.series[y] ?? null, indLabel: a.series[y] != null ? formatValue(a.series[y], a.c.ind.unit, a.c.ind.decimals) : "" }));
            const cur = a.byH.find((x) => x.h === h)!;
            const sum = summarize(cur.ws);
            return (
              <section key={a.c.ind.id} className="mb-10">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="display text-2xl font-semibold">{spendLabel} <span className="text-muted">→</span> {a.c.ind.name}</h2>
                  <AskButton label="Perguntar sobre esta análise" focus={{
                    title: `ROI · ${spendLabel} → ${a.c.ind.name} · ${place}`,
                    text: `Análise do Política (${place}): gasto "${spendLabel}" (valores reais, IPCA) versus indicador "${a.c.ind.name}" (${a.c.ind.better === "up" ? "quanto maior melhor" : "quanto menor melhor"}). Períodos de ${h} ano(s): ${cur.ws.map((w) => `${w.from}→${w.to}: gasto ${brlShort(w.spendFrom)}→${brlShort(w.spendTo)}, investido ${brlShort(w.invested)}, indicador ${formatValue(w.indFrom, a.c.ind.unit, a.c.ind.decimals)}→${formatValue(w.indTo, a.c.ind.unit, a.c.ind.decimals)} (${KIND_LABEL[w.kind]})`).join("; ") || "sem períodos"}. É uma comparação antes e depois, que não prova causa e efeito.`,
                    suggestions: ["O que esta análise mostra?", "Esta melhora pode ser efeito do gasto?", "O que mais influencia este indicador?"],
                  }} />
                </div>
                <div className="mb-4 rounded-2xl border border-line bg-surface p-4"><RoiChart points={points} indName={a.c.ind.name} color={a.color} /></div>

                {sum.n > 0 && (
                  <p className="mb-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                    Em períodos de {h} {h === 1 ? "ano" : "anos"}: o indicador melhorou em <b>{sum.improved} de {sum.n}</b>.{" "}
                    {(["gasto-sobe-melhora", "gasto-sobe-piora", "gasto-cai-melhora", "gasto-cai-piora", "estavel"] as const).filter((k) => sum.counts[k] > 0).map((k) => `${KIND_LABEL[k]}: ${sum.counts[k]}`).join(" · ")}.
                  </p>
                )}
                <WindowTable ws={cur.ws} unit={a.c.ind.unit} decimals={a.c.ind.decimals} h={h} />
                <p className="mt-2 text-xs text-faint">Fontes: gasto, Tesouro Nacional (Siconfi/DCA); indicador, {a.c.ind.source}. &ldquo;Investido no período&rdquo; soma o gasto real dos {h} {h === 1 ? "ano" : "anos"} depois do início. Custo = investido ÷ melhora (só quando melhorou).</p>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

/** A página abre na hora com o esqueleto; os dados chegam em seguida. A chave refaz o esqueleto a cada mudança de filtro. */
export default async function RoiPage({ searchParams }: { searchParams: Promise<{ esfera?: string; gasto?: string; ind?: string | string[]; h?: string }> }) {
  const sp = await searchParams;
  return (
    <Suspense key={JSON.stringify(sp)} fallback={<PageSkeleton />}>
      <RoiContent searchParams={Promise.resolve(sp)} />
    </Suspense>
  );
}
