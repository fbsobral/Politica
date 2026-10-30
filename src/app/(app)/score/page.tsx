import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { formatValue } from "@/lib/indicators/format";
import { GOVERNMENTS, computeScore, governmentOf, type ScoreItem } from "@/lib/indicators/score";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Score dos governos" };
export const dynamic = "force-dynamic";

const n0 = (v: number | null) => (v == null ? "—" : Math.round(v).toString());

function Bar({ v, color }: { v: number | null; color: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
      {v != null && <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />}
    </div>
  );
}

function ItemRows({ items, years }: { items: ScoreItem[]; years: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="py-1.5 pr-3 font-medium">Indicador</th>
            {years.map((y) => <th key={y} className="px-1 py-1.5 text-right font-medium">{y}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-line align-top">
              <td className="py-2 pr-3">
                <Link href={`/indicadores?esfera=federal#${it.id}`} className="font-medium hover:underline">{it.name}</Link>
                <div className="text-xs text-faint">{it.better === "up" ? "quanto maior, melhor" : "quanto menor, melhor"}</div>
              </td>
              {years.map((y) => (
                <td key={y} className="px-1 py-2 text-right tabular-nums">
                  {it.values[y] == null ? <span className="text-faint">—</span> : (
                    <>
                      <div>{formatValue(it.values[y], it.unit, it.decimals)}</div>
                      <div className="text-xs font-semibold text-muted">{n0(it.notes[y])}</div>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ScorePage() {
  await requireUser();
  const r = await computeScore();
  const years = r.years.map((y) => y.year);
  const econ = r.items.filter((i) => i.side === "economia");
  const soc = r.items.filter((i) => i.side === "social");

  return (
    <div>
      <PageHeader eyebrow="Números · Brasil · últimos 10 anos" title="Score dos governos" />
      <p className="mb-6 max-w-3xl rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm leading-relaxed">
        <b>Índice calculado pelo Política — não é um dado oficial.</b> Os valores de cada indicador vêm das fontes oficiais, como na aba Indicadores. A nota é uma conta nossa, descrita abaixo.
        O score é uma forma de resumir, não um veredito: muitos fatores fora do controle de um governo (clima, economia mundial, pandemia) pesam nos números.
      </p>

      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {r.terms.map((t) => (
          <div key={t.id} className="card-flat p-4">
            <p className="eyebrow" style={{ color: t.color }}>{t.name}</p>
            <p className="display text-4xl font-semibold tabular-nums">{n0(t.avg)}<span className="text-base text-muted"> / 100</span></p>
            <p className="mt-1 text-xs text-muted">Média dos anos {t.years.length ? `${t.years[0]}–${t.years[t.years.length - 1]}` : "sem dados"}</p>
          </div>
        ))}
      </section>

      <section className="mb-8">
        <h2 className="display mb-3 text-2xl font-semibold">Score por ano</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1.5 font-medium">Ano</th>
                <th className="py-1.5 font-medium">Governo</th>
                <th className="py-1.5 text-right font-medium">Econômico</th>
                <th className="py-1.5 text-right font-medium">Social</th>
                <th className="w-1/3 py-1.5 pl-4 font-medium">Score (50% + 50%)</th>
              </tr>
            </thead>
            <tbody>
              {r.years.map((y) => {
                const g = governmentOf(y.year);
                return (
                  <tr key={y.year} className="border-t border-line">
                    <td className="py-2 font-semibold tabular-nums">{y.year}</td>
                    <td className="py-2" style={{ color: g?.color }}>{g?.name ?? "—"}</td>
                    <td className="py-2 text-right tabular-nums">{n0(y.economia)}</td>
                    <td className="py-2 text-right tabular-nums">{n0(y.social)}</td>
                    <td className="py-2 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1"><Bar v={y.total} color={g?.color ?? "#17407f"} /></div>
                        <span className="w-8 text-right font-semibold tabular-nums">{n0(y.total)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-faint">Anos em que um dos lados ainda não tem nenhum indicador publicado ficam sem score. Em 2016, Dilma governou até agosto; o ano está com Temer, que estava no cargo ao fim dele.</p>
      </section>

      <section className="mb-8">
        <h2 className="display mb-1 text-2xl font-semibold">Econômico <span className="text-base font-normal text-muted">· vale 50%</span></h2>
        <p className="mb-3 text-sm text-muted">Em cada célula: o valor publicado e, abaixo, a nota de 0 a 100.</p>
        <ItemRows items={econ} years={years} />
      </section>

      <section className="mb-8">
        <h2 className="display mb-1 text-2xl font-semibold">Social <span className="text-base font-normal text-muted">· vale 50%</span></h2>
        <p className="mb-3 text-sm text-muted">Em cada célula: o valor publicado e, abaixo, a nota de 0 a 100.</p>
        <ItemRows items={soc} years={years} />
      </section>

      <section className="max-w-3xl rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed">
        <h2 className="mb-2 font-semibold">Como a conta é feita</h2>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li><b>Nota do indicador (0 a 100):</b> dentro da janela dos últimos 10 anos, o melhor valor vira 100 e o pior vira 0; os demais ficam proporcionalmente no meio. &ldquo;Melhor&rdquo; segue o sentido de cada indicador (ex.: menos desemprego é melhor).</li>
          <li><b>Nota de cada lado:</b> média simples das notas dos indicadores do lado que têm dado naquele ano — pesos iguais.</li>
          <li><b>Score do ano:</b> média dos dois lados, 50% econômico e 50% social. Nenhum pesa mais.</li>
          <li><b>Score do governo:</b> média dos scores dos anos em que ele estava no cargo.</li>
          <li>A nota é relativa à própria janela: mede se o ano foi melhor ou pior que os outros dos últimos 10, não se foi &ldquo;bom&rdquo; em termos absolutos.</li>
          <li>Anos sem publicação de um indicador ficam de fora, sem preenchimento. Por isso o conjunto de indicadores de um ano pode ser menor que o de outro.</li>
        </ol>
        <p className="mt-3 text-xs text-faint">Governos considerados: {GOVERNMENTS.map((g) => `${g.name} (${g.from}${g.to > 2090 ? "–hoje" : `–${g.to}`})`).join(", ")}.</p>
      </section>
    </div>
  );
}
