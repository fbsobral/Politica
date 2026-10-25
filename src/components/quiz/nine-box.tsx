import Link from "next/link";
import { slugOf } from "@/lib/parties";
import type { Band, PartyPos } from "@/lib/quiz/calc";
import { CUST_LABEL, ECON_LABEL, cellKey } from "@/lib/quiz/calc";

const COLS: Band[] = [-1, 0, 1]; // economia, da esquerda para a direita
const ROWS: Band[] = [1, 0, -1]; // costumes, de cima (conservador) para baixo (progressista)

/** Mapa 3×3: Economia na horizontal, Costumes na vertical. "you" marca a posição exata do usuário e destaca a caixa dele. */
export function NineBox({ grid, you, compact = false }: { grid: Record<string, PartyPos[]>; you?: { economia: number; costumes: number; eco: Band; cus: Band }; compact?: boolean }) {
  const x = you ? ((Math.max(-10, Math.min(10, you.economia)) + 10) / 20) * 100 : 0;
  const y = you ? (1 - (Math.max(-10, Math.min(10, you.costumes)) + 10) / 20) * 100 : 0;
  return (
    <div className="w-full">
      <div className="grid grid-cols-[1.4rem_1fr] gap-2">
        <div className="flex items-center justify-center">
          <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-muted [writing-mode:vertical-rl] rotate-180">Costumes</span>
        </div>
        <div>
          <div className="relative grid grid-cols-3 gap-1.5">
            {ROWS.map((cus) =>
              COLS.map((eco) => {
                const list = grid[cellKey(eco, cus)] ?? [];
                const mine = you && you.eco === eco && you.cus === cus;
                return (
                  <div key={`${eco}${cus}`} className={`flex min-h-[5.25rem] flex-col rounded-xl border p-2 sm:min-h-[6.5rem] ${mine ? "border-brand bg-brand-soft ring-2 ring-brand/40" : "border-line bg-surface"}`}>
                    <p className="mb-1 text-[10px] font-semibold leading-tight text-faint sm:text-[11px]">
                      {compact ? `${ECON_LABEL[eco]} × ${CUST_LABEL[cus]}` : `${ECON_LABEL[eco]} × ${CUST_LABEL[cus]}`}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {list.length ? (
                        list.map((p) => (
                          <Link key={p.party.sigla} href={`/partidos/${slugOf(p.party.sigla)}`} title={p.party.nome} className="rounded-md bg-ink/5 px-1.5 py-0.5 text-[11px] font-bold hover:bg-ink/10">
                            {p.party.sigla}
                          </Link>
                        ))
                      ) : (
                        <span className="text-[11px] text-faint">nenhum partido</span>
                      )}
                    </div>
                  </div>
                );
              }),
            )}
            {you && (
              <span aria-label="Você" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
                <span className="flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-ink shadow-pop ring-2 ring-surface">● Você</span>
              </span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
            {COLS.map((c) => <span key={c}>{ECON_LABEL[c]}</span>)}
          </div>
          <p className="mt-0.5 text-center text-[11px] font-semibold uppercase tracking-wide text-faint">Economia →</p>
        </div>
      </div>
      <div className="mt-1 hidden justify-between pl-8 text-[11px] text-faint sm:flex">
        <span>↑ Conservador · Moderado · Progressista ↓</span>
      </div>
    </div>
  );
}
