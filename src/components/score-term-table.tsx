"use client";

import { Fragment, useState } from "react";
import { AskButton, type AskFocus } from "@/components/agent/ask-button";

export type TermYear = { year: number; economia: string; social: string; total: string; bg?: string };
export type TermRow = {
  id: string; name: string; role: string; period: string; color: string;
  economia: string; economiaBg?: string; social: string; socialBg?: string;
  score: string; scoreBg?: string; scorePct: number; scoreColor: string;
  verdict: string; nYears: number; years: TermYear[]; ask: AskFocus;
};

/** Resultado por governo em tabela, com botão para ver a conta ano a ano. */
export function ScoreTermTable({ rows }: { rows: TermRow[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
        <colgroup>
          <col style={{ width: "22%" }} /><col style={{ width: "13%" }} /><col style={{ width: "10%" }} /><col style={{ width: "10%" }} /><col style={{ width: "17%" }} /><col style={{ width: "16%" }} /><col style={{ width: "12%" }} />
        </colgroup>
        <thead>
          <tr className="text-xs text-muted">
            <th className="px-3 py-2 text-left font-medium">Governo</th>
            <th className="px-3 py-2 text-left font-medium">Período</th>
            <th className="px-3 py-2 text-center font-medium">Econômico</th>
            <th className="px-3 py-2 text-center font-medium">Social</th>
            <th className="px-3 py-2 text-left font-medium">Score</th>
            <th className="px-3 py-2 text-left font-medium">Leitura</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const isOpen = open === t.id;
            return (
              <Fragment key={t.id}>
                <tr className="border-t border-line align-middle">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-1.5 shrink-0 rounded-full" style={{ background: t.color }} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold leading-tight">{t.name}</p>
                        <p className="truncate text-xs text-muted">{t.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{t.period}<p className="text-xs text-faint">{t.nYears ? `${t.nYears} ${t.nYears === 1 ? "ano" : "anos"} com nota` : "sem nota"}</p></td>
                  <td className="px-3 py-2.5 text-center tabular-nums" style={{ background: t.economiaBg }}>{t.economia}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums" style={{ background: t.socialBg }}>{t.social}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-8 text-lg font-semibold tabular-nums" style={{ color: t.scoreColor }}>{t.score}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full" style={{ width: `${t.scorePct}%`, background: t.scoreColor }} /></div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">{t.verdict}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {t.nYears > 0 && (
                        <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : t.id)} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-ink/5">{isOpen ? "Fechar" : "Detalhar"}</button>
                      )}
                      <AskButton compact focus={t.ask} />
                    </div>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-ink/[0.03]">
                    <td colSpan={7} className="px-3 py-3">
                      <table className="w-full max-w-xl border-collapse text-xs tabular-nums">
                        <thead><tr className="text-muted"><th className="py-1 text-left font-medium">Ano</th><th className="py-1 text-center font-medium">Econômico</th><th className="py-1 text-center font-medium">Social</th><th className="py-1 text-center font-medium">Score</th></tr></thead>
                        <tbody>
                          {t.years.map((y) => (
                            <tr key={y.year} className="border-t border-line">
                              <td className="py-1 font-semibold">{y.year}</td>
                              <td className="py-1 text-center">{y.economia}</td>
                              <td className="py-1 text-center">{y.social}</td>
                              <td className="py-1 text-center font-semibold" style={{ background: y.bg }}>{y.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="mt-2 text-xs text-muted">Nota do governo = média dos scores dos anos acima, todos com o mesmo peso: ({t.years.map((y) => y.total).join(" + ")}) ÷ {t.years.length} = <b>{t.score}</b>.</p>
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
