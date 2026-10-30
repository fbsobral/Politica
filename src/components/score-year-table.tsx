"use client";

import { Fragment, useState } from "react";
import { AskButton, type AskFocus } from "@/components/agent/ask-button";

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
  ask: AskFocus;
};

export type YearGroup = {
  id: string; name: string; role: string; period: string; color: string;
  economia: string; economiaBg?: string; social: string; socialBg?: string; score: string; scoreBg?: string;
  rows: YearRow[];
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
                {it.dir && it.prev ? <>{ICON[it.dir]} {it.dir} de {it.prev} para <b>{it.value}</b></> : <>{it.value} · sem nota neste ano</>}
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

/** Tabela "Ano a ano" agrupada por mandato (cada grupo abre e fecha), com botão de detalhamento por ano. */
export function ScoreYearTable({ groups }: { groups: YearGroup[] }) {
  const [open, setOpen] = useState<number | null>(null);
  // por padrão todos os mandatos ficam expandidos; o usuário pode recolher
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(groups.map((g) => g.id)));
  const flip = (id: string) => setOpenGroups((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOpen = openGroups.size === groups.length;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-end border-b border-line px-3 py-2">
        <button type="button" onClick={() => setOpenGroups(allOpen ? new Set() : new Set(groups.map((g) => g.id)))} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-ink/5">{allOpen ? "Recolher todos os mandatos" : "Expandir todos os mandatos"}</button>
      </div>
      <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
        <colgroup>
          <col style={{ width: "9%" }} /><col style={{ width: "27%" }} /><col style={{ width: "17%" }} /><col style={{ width: "17%" }} /><col style={{ width: "13%" }} /><col style={{ width: "17%" }} />
        </colgroup>
        <thead>
          <tr className="text-xs text-muted">
            <th className="px-3 py-2 text-left font-medium">Ano</th>
            <th className="px-3 py-2 text-left font-medium">Governo</th>
            <th className="px-3 py-2 text-center font-medium">Econômico (50%)</th>
            <th className="px-3 py-2 text-center font-medium">Social (50%)</th>
            <th className="px-3 py-2 text-center font-medium">Score</th>
            <th className="px-3 py-2 text-right font-medium" />
          </tr>
        </thead>
        {groups.map((g) => {
          const gOpen = openGroups.has(g.id);
          return (
            <tbody key={g.id} className="border-t-2 border-line">
              <tr className="cursor-pointer bg-ink/[0.04] hover:bg-ink/[0.07]" onClick={() => flip(g.id)}>
                <td colSpan={2} className="px-3 py-2.5">
                  <button type="button" aria-expanded={gOpen} onClick={(e) => { e.stopPropagation(); flip(g.id); }} className="flex items-center gap-2 text-left">
                    <span className={`inline-block text-muted transition-transform ${gOpen ? "rotate-90" : ""}`}>▸</span>
                    <span className="h-5 w-1.5 shrink-0 rounded-full" style={{ background: g.color }} />
                    <span><b>{g.name}</b> <span className="text-xs text-muted">· {g.role} · {g.period} · {g.rows.length} {g.rows.length === 1 ? "ano" : "anos"}</span></span>
                  </button>
                </td>
                <td className="px-3 py-2.5 text-center font-semibold tabular-nums" style={{ background: g.economiaBg }}>{g.economia}</td>
                <td className="px-3 py-2.5 text-center font-semibold tabular-nums" style={{ background: g.socialBg }}>{g.social}</td>
                <td className="px-3 py-2.5 text-center font-bold tabular-nums" style={{ background: g.scoreBg }}>{g.score}</td>
                <td className="px-3 py-2.5 text-right text-xs text-muted">média do mandato</td>
              </tr>
              {gOpen && g.rows.map((y) => {
                const isOpen = open === y.year;
                const econ = y.items.filter((i) => i.side === "economia" && i.note != null);
                const soc = y.items.filter((i) => i.side === "social" && i.note != null);
                return (
                  <Fragment key={y.year}>
                    <tr className="border-t border-line">
                      <td className="px-3 py-1.5 pl-8 font-semibold tabular-nums">{y.year}</td>
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
                        Como chegamos ao <b className="text-ink">{y.total}</b> de {y.year}: cada indicador recebe uma nota (0 a 100) pela proximidade da sua meta (100 = meta atingida ou superada); a nota de cada lado é a média das suas notas; o score é a média dos dois lados
                        {econ.length && soc.length ? <> — ({y.economia} + {y.social}) ÷ 2 = <b className="text-ink">{y.total}</b>.</> : "."}
                      </p>
                      <div className="mb-3"><AskButton focus={y.ask} label="Perguntar sobre este ano" /></div>
                      <div className="grid gap-5 md:grid-cols-2">
                        <Side title="Econômico · 50%" rows={econ} avg={y.economia} bg={y.economiaBg} />
                        <Side title="Social · 50%" rows={soc} avg={y.social} bg={y.socialBg} />
                      </div>
                      {y.items.some((i) => i.note == null) && (
                        <p className="mt-3 text-xs text-faint">Sem nota neste ano: {y.items.filter((i) => i.note == null).map((i) => i.name).join(", ")} (sem dado publicado ou sem meta para calcular a nota).</p>
                      )}
                    </td>
                  </tr>
                )}
                  </Fragment>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
