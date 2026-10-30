"use client";

import { Fragment, useState } from "react";

export type YearDetailItem = { name: string; side: "economia" | "social"; value: string; prev: string | null; dir: "melhorou" | "piorou" | "igual" | null; note: number | null; bg?: string };
export type YearRow = {
  year: number;
  gov: string;
  color?: string;
  economia: string; economiaBg?: string;
  social: string; socialBg?: string;
  total: string; totalBg?: string;
  items: YearDetailItem[];
  nEcon: number; nSocial: number;
};

const ICON = { melhorou: "▲", piorou: "▼", igual: "＝" } as const;

function Side({ title, rows, avg, bg }: { title: string; rows: YearDetailItem[]; avg: string; bg?: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {rows.length === 0 ? <p className="text-sm text-muted">Nenhum indicador com nota neste ano.</p> : (
        <ul className="space-y-1.5">
          {rows.map((it) => (
            <li key={it.name} className="rounded-lg px-2.5 py-1.5 text-sm" style={{ background: it.bg }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{it.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">{it.note == null ? "—" : Math.round(it.note)}</span>
              </div>
              <div className="text-xs text-muted">
                {it.dir && it.prev ? <>{ICON[it.dir]} {it.dir} de {it.prev} para <b>{it.value}</b></> : <>{it.value} · sem ano anterior publicado, não tem nota</>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold" style={{ background: bg }}>
        {rows.length ? <>Média das {rows.length} {rows.length === 1 ? "nota" : "notas"}: {avg}</> : "Sem nota neste lado"}
      </p>
    </div>
  );
}

/** Tabela "Ano a ano" com botão de detalhamento: mostra de onde vem cada nota. */
export function ScoreYearTable({ rows }: { rows: YearRow[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="px-3 py-2 text-left font-medium">Ano</th>
            <th className="px-3 py-2 text-left font-medium">Governo</th>
            <th className="px-3 py-2 text-center font-medium">Econômico (50%)</th>
            <th className="px-3 py-2 text-center font-medium">Social (50%)</th>
            <th className="px-3 py-2 text-center font-medium">Score</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((y) => {
            const isOpen = open === y.year;
            const econ = y.items.filter((i) => i.side === "economia" && i.note != null);
            const soc = y.items.filter((i) => i.side === "social" && i.note != null);
            return (
              <Fragment key={y.year}>
                <tr className="border-t border-line">
                  <td className="px-3 py-1.5 font-semibold tabular-nums">{y.year}</td>
                  <td className="px-3 py-1.5"><span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: y.color }} />{y.gov}</td>
                  <td className="px-3 py-1.5 text-center tabular-nums" style={{ background: y.economiaBg }}>{y.economia}</td>
                  <td className="px-3 py-1.5 text-center tabular-nums" style={{ background: y.socialBg }}>{y.social}</td>
                  <td className="px-3 py-1.5 text-center font-semibold tabular-nums" style={{ background: y.totalBg }}>{y.total}</td>
                  <td className="px-3 py-1.5 text-right">
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : y.year)} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-ink/5">
                      {isOpen ? "Fechar" : "Detalhar"}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-ink/[0.03]">
                    <td colSpan={6} className="px-3 py-4">
                      <p className="mb-3 max-w-3xl text-sm text-muted">
                        Como chegamos ao <b className="text-ink">{y.total}</b> de {y.year}: cada indicador recebe uma nota (0 a 100) pela melhora em relação ao ano anterior; a nota de cada lado é a média das suas notas; o score é a média dos dois lados
                        {econ.length && soc.length ? <> — ({y.economia} + {y.social}) ÷ 2 = <b className="text-ink">{y.total}</b>.</> : "."}
                      </p>
                      <div className="grid gap-5 md:grid-cols-2">
                        <Side title="Econômico · 50%" rows={econ} avg={y.economia} bg={y.economiaBg} />
                        <Side title="Social · 50%" rows={soc} avg={y.social} bg={y.socialBg} />
                      </div>
                      {y.items.some((i) => i.note == null) && (
                        <p className="mt-3 text-xs text-faint">Sem nota neste ano: {y.items.filter((i) => i.note == null).map((i) => i.name).join(", ")} (sem o dado do ano anterior para comparar).</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
