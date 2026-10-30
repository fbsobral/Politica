"use client";

import { useState } from "react";
import { AskButton, type AskFocus } from "@/components/agent/ask-button";
import { delta, IndicatorChart, type ChartSeries } from "@/components/indicator-chart";
import { formatValue, type Unit } from "@/lib/indicators/format";

export type CardData = {
  id: string;
  title: string;
  unit: Unit;
  decimals?: number;
  desc: string;
  source: string;
  sourceUrl?: string;
  better?: "up" | "down";
  series: ChartSeries[];
  /** variação oficial de cada ano para mostrar acima dos pontos (ex.: crescimento real do PIB) */
  changeLabels?: Record<number, number>;
  changeNote?: string;
  /** fator de cada ano para levar o valor aos preços de `deflatorYear` (IPCA); só nos gráficos em reais */
  deflator?: Record<number, number>;
  deflatorYear?: number;
  subs: { inflation?: boolean; id: string; title: string; unit: Unit; decimals?: number; desc: string; source: string; better?: "up" | "down"; series: ChartSeries[] }[];
};

function latest(values: Record<number, number>): { year: number; value: number } | null {
  const ys = Object.keys(values).map(Number).sort((a, b) => b - a);
  return ys.length ? { year: ys[0], value: values[ys[0]] } : null;
}

function tone(better: "up" | "down" | undefined, first: number | undefined, last: number | undefined): string {
  if (!better || first === undefined || last === undefined || first === last) return "text-muted";
  const up = last > first;
  return (better === "up") === up ? "text-ok" : "text-danger";
}

function Row({ title, unit, decimals, series, better, onOpen, open }: { title: string; unit: Unit; decimals?: number; series: ChartSeries[]; better?: "up" | "down"; onOpen?: () => void; open?: boolean }) {
  const main = series[0];
  const l = main ? latest(main.values) : null;
  const d = main ? delta(main.values, unit) : null;
  const first = main ? main.values[Number(Object.keys(main.values).sort()[0])] : undefined;
  return (
    <button type="button" onClick={onOpen} aria-expanded={open} className="flex w-full items-baseline justify-between gap-3 text-left">
      <span className="min-w-0 truncate font-medium">{title}</span>
      <span className="flex flex-none items-baseline gap-2">
        {d && <span className={`text-xs ${tone(better, first, l?.value)}`} title={`${d.from} a ${d.to}`}>{d.text}</span>}
        <b className="tabular-nums">{l ? formatValue(l.value, unit, decimals) : "—"}</b>
        {l && <span className="text-[11px] text-faint">{l.year}</span>}
      </span>
    </button>
  );
}

function seriesText(series: ChartSeries[], unit: Unit, decimals?: number): string {
  return series
    .map((s) => `${s.name}: ${Object.keys(s.values).map(Number).sort((a, b) => a - b).map((y) => `${y} ${formatValue(s.values[y], unit, decimals)}`).join("; ")}`)
    .join("\n");
}

/** Texto compacto do cartão (série de cada esfera, detalhes, descrição e fonte) para o assistente. */
function focusOf(d: CardData): AskFocus {
  const subs = d.subs.map((s) => `\nDetalhe "${s.title}":\n${seriesText(s.series, s.unit, s.decimals)}`).join("");
  const place = d.series.map((s) => s.name).join(" / ");
  return {
    title: `${d.title} · ${place}`,
    text: `Indicador: ${d.title}\n${seriesText(d.series, d.unit, d.decimals)}${subs}\nO que é: ${d.desc}\nFonte: ${d.source}. Os valores são os publicados pela fonte; anos ausentes não foram publicados.`,
    suggestions: ["Explique esse indicador em linguagem simples", "O que explica essa variação nos últimos anos?", "Isso é bom ou ruim para quem mora aqui?", "Como isso se compara com o Brasil e o estado?"],
  };
}

function deflate(series: ChartSeries[], f: Record<number, number>): ChartSeries[] {
  return series.map((s) => ({ ...s, values: Object.fromEntries(Object.entries(s.values).filter(([y]) => f[Number(y)]).map(([y, v]) => [Number(y), v * f[Number(y)]])) }));
}

export function IndicatorCard({ d: base }: { d: CardData }) {
  // só os gráficos em reais têm a opção de ver os valores corrigidos pela inflação (cálculo feito aqui sobre o IPCA do IBGE)
  const [real, setReal] = useState(false);
  const f = base.deflator;
  const on = real && !!f;
  // as variações acima dos pontos acompanham a escolha: nominal = conta sobre os valores publicados; corrigido = sobre os valores corrigidos
  // (no PIB do Brasil, o crescimento real oficial do IBGE só aparece na visão corrigida)
  const d: CardData = on
    ? {
        ...base,
        series: deflate(base.series, f!),
        subs: base.subs.map((s) => (s.inflation ? { ...s, series: deflate(s.series, f!) } : s)),
        changeLabels: base.changeLabels,
        changeNote: base.changeLabels ? base.changeNote : `Valores corrigidos pela inflação (IPCA), a preços de ${base.deflatorYear}. A correção é um cálculo feito aqui sobre o índice oficial do IBGE; as variações já descontam a inflação.`,
      }
    : { ...base, changeLabels: undefined, changeNote: undefined };
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [info, setInfo] = useState(false);
  const multi = d.series.length > 1;
  return (
    <article id={`ind-${d.id}`} className="card scroll-mt-40 p-4 sm:p-5">
      <header className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="display text-lg font-semibold leading-tight">{d.title}</h3>
          <div className="flex flex-none items-center gap-2">
            {f && (
              <div role="group" aria-label="Valores em reais" className="flex gap-0.5 rounded-full border border-line bg-surface p-0.5 text-[11px] font-semibold">
                <button type="button" onClick={() => setReal(false)} aria-pressed={!on} className={`rounded-full px-2 py-1 ${!on ? "bg-ink text-paper" : "text-muted hover:text-ink"}`} title="Valores como a fonte publica (incluem a inflação)">Nominal</button>
                <button type="button" onClick={() => setReal(true)} aria-pressed={on} className={`rounded-full px-2 py-1 ${on ? "bg-ink text-paper" : "text-muted hover:text-ink"}`} title="Valores corrigidos pela inflação (IPCA), a preços do último ano">Corrigido (IPCA)</button>
              </div>
            )}
            <AskButton focus={focusOf(d)} />
          </div>
        </div>
        {multi ? (
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {d.series.map((s) => {
              const l = latest(s.values);
              return <span key={s.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}: <b>{l ? formatValue(l.value, d.unit, d.decimals) : "—"}</b></span>;
            })}
          </div>
        ) : (
          <div className="mt-1 text-sm"><Row title="" unit={d.unit} decimals={d.decimals} series={d.series} better={d.better} /></div>
        )}
      </header>
      <IndicatorChart series={d.series} unit={d.unit} decimals={d.decimals} better={d.better} changeLabels={d.changeLabels} changeNote={d.changeNote} />
      {d.subs.length > 0 && (
        <div className="mt-4 space-y-2.5 border-t border-line pt-3 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Detalhes</p>
          {d.subs.map((s) => (
            <div key={s.id}>
              <Row title={s.title} unit={s.unit} decimals={s.decimals} series={s.series} better={s.better} open={openSub === s.id} onOpen={() => setOpenSub(openSub === s.id ? null : s.id)} />
              {openSub === s.id && (
                <div className="mt-2">
                  <IndicatorChart series={s.series} unit={s.unit} decimals={s.decimals} height={150} better={s.better} />
                  <p className="mt-1 text-xs text-muted">{s.desc} <span className="text-faint">Fonte: {s.source}.</span></p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <footer className="mt-3 text-xs text-muted">
        <button type="button" onClick={() => setInfo(!info)} aria-expanded={info} className="font-semibold text-brand underline-offset-4 hover:underline">{info ? "Ocultar" : "O que é isso?"}</button>
        {info && <p className="mt-1.5 leading-relaxed">{d.desc} <span className="text-faint">Fonte: {d.sourceUrl ? <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="underline">{d.source}</a> : d.source}.</span></p>}
      </footer>
    </article>
  );
}
