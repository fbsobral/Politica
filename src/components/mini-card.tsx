import Link from "next/link";
import { Fragment } from "react";
import { AskButton, type AskFocus } from "@/components/agent/ask-button";
import { InfoTip } from "@/components/info-tip";

export type MiniRow = [string, string] | [string, string, string];

export type MiniBar =
  /** barra de execução: preenchimento (0 a 1) e traço do tempo decorrido */
  | { kind: "pace"; fill: number; tick: number; color: string; label: string }
  /** faixa de referência (ex.: intervalo da meta) e a posição do valor atual */
  | { kind: "band"; value: number; lo: number; hi: number; max: number; color: string; label: string };

/** Cartão compacto dos módulos de números: título com "i" e Pergunte, número grande, legenda, barra opcional e tabelinha de 3 a 4 linhas. */
export function MiniCard({ title, big, caption, note, ask, rows, bar, link, bigClass }: { title: string; big: string; caption: string; note: string; ask: AskFocus; rows: MiniRow[]; bar?: MiniBar; link?: { href: string; label: string }; bigClass?: string }) {
  return (
    <section className="card flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{title}</p>
        <span className="flex items-center gap-1.5">
          <InfoTip label={`Sobre ${title}`}><span className="block">{note}</span></InfoTip>
          <AskButton compact focus={ask} />
        </span>
      </div>
      <p className={`display mt-1.5 text-2xl font-semibold leading-tight ${bigClass ?? ""}`}>{big}</p>
      <p className="min-h-[2rem] text-[11px] leading-snug text-faint">{caption}</p>
      <div className="min-h-[2.75rem]">
        {bar?.kind === "pace" && (
          <div className="relative mt-3 h-3" role="img" aria-label={bar.label}>
            <div className="absolute inset-0 rounded-full bg-ink/10" />
            <div className="absolute left-0 top-[2px] h-2 rounded-full" style={{ width: `${Math.min(100, bar.fill * 100)}%`, background: bar.color }} />
            <div className="absolute -top-0.5 h-4 w-0.5 bg-ink" style={{ left: `calc(${Math.min(100, bar.tick * 100)}% - 1px)` }} />
          </div>
        )}
        {bar?.kind === "band" && (
          <div className="relative mt-3 h-3" role="img" aria-label={bar.label}>
            <div className="absolute inset-0 rounded-full bg-ink/10" />
            <div className="absolute inset-y-0 rounded-full bg-ok/25" style={{ left: `${(Math.max(0, bar.lo) / bar.max) * 100}%`, width: `${((bar.hi - Math.max(0, bar.lo)) / bar.max) * 100}%` }} />
            <div className="absolute -top-0.5 h-4 w-1 rounded-full" style={{ background: bar.color, left: `calc(${Math.min(100, Math.max(0, (bar.value / bar.max) * 100))}% - 2px)` }} />
          </div>
        )}
      </div>
      <dl className="mt-auto grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1.5 border-t border-line pt-2.5 text-xs">
        {rows.map(([k, v, cls]) => (
          <Fragment key={k}>
            <dt className="whitespace-nowrap text-muted">{k}</dt>
            <dd className={`truncate text-right font-semibold tabular-nums ${cls ?? ""}`} title={v}>{v}</dd>
          </Fragment>
        ))}
      </dl>
      {link && <Link href={link.href} className="mt-2 text-xs font-semibold text-brand hover:underline">{link.label}</Link>}
    </section>
  );
}
