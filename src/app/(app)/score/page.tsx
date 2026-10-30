import Link from "next/link";
import { ScoreEditor } from "@/components/score-editor";
import { PageHeader, RangeTabs, ScopeTabs, rangeOf } from "@/components/ui";
import { UF_CODE } from "@/lib/budget";
import { ibgeIdFor } from "@/lib/ibge";
import { lastClosedYear, type Scope } from "@/lib/indicators/core";
import { formatValue } from "@/lib/indicators/format";
import { PRESIDENTS, candidates, computeScore, cycleTerms, defaultSelection, type ScoreItem, type Term } from "@/lib/indicators/score";
import { SCOPE_SLUG, UFS } from "@/lib/taxonomy";
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

const termLabel = (t: Term) => t.name ?? `${t.role} · mandato`;

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
  const terms = scope === "FEDERAL" ? PRESIDENTS : cycleTerms(scope);
  const r = await computeScore(scope, geo, selected, from, terms);
  const years = r.years.map((y) => y.year);
  const econ = r.items.filter((i) => i.side === "economia");
  const soc = r.items.filter((i) => i.side === "social");
  const termOf = (y: number) => terms.find((t) => y >= t.from && y <= t.to);
  const opts = candidates(scope).map((c) => ({ id: c.ind.id, name: c.ind.name, side: c.side }));

  return (
    <div>
      <PageHeader eyebrow={`Números · ${place} · últimos ${range} anos`} title="Score dos governos" />
      <ScopeTabs base="/score" scope={scope} noAll params={{ anos: sp.anos }} />
      <RangeTabs base="/score" years={range} params={{ esfera: sp.esfera }} />
      <p className="mb-6 max-w-3xl rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm leading-relaxed">
        <b>Índice calculado pelo Política — não é um dado oficial.</b> Os valores de cada indicador vêm das fontes oficiais, como na aba Indicadores. A nota é uma conta nossa, descrita no fim da página.
        O score resume, não dá veredito: clima, economia mundial, pandemia e outras coisas fora do controle de um governo pesam nos números.
      </p>

      <ScoreEditor scope={scope} options={opts} selected={selected} isCustom={Boolean(custom?.length)} />

      {(r.sides.economia === 0 || r.sides.social === 0) && (
        <p className="mb-6 max-w-3xl rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
          Sem score nesta esfera: {r.sides.economia === 0 ? "nenhum indicador econômico" : "nenhum indicador social"} selecionado com dado publicado. O score só existe quando os dois lados (50% cada) têm pelo menos um indicador.
        </p>
      )}

      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {r.terms.map((t) => (
          <div key={t.id} className="card-flat p-4">
            <p className="eyebrow" style={{ color: t.color }}>{termLabel(t)}</p>
            <p className="text-xs text-muted">{t.role} · {t.from}–{t.to > 2090 ? "hoje" : t.to}</p>
            <p className="display text-4xl font-semibold tabular-nums">{n0(t.avg)}<span className="text-base text-muted"> / 100</span></p>
            <p className="mt-1 text-xs text-muted">{t.years.length ? `Média de ${t.years.length} ${t.years.length === 1 ? "ano" : "anos"} com score` : "Sem anos com score"}</p>
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
                const t = termOf(y.year);
                return (
                  <tr key={y.year} className="border-t border-line">
                    <td className="py-2 font-semibold tabular-nums">{y.year}</td>
                    <td className="py-2" style={{ color: t?.color }}>{t ? termLabel(t) : "—"}</td>
                    <td className="py-2 text-right tabular-nums">{n0(y.economia)}</td>
                    <td className="py-2 text-right tabular-nums">{n0(y.social)}</td>
                    <td className="py-2 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1"><Bar v={y.total} color={t?.color ?? "#17407f"} /></div>
                        <span className="w-8 text-right font-semibold tabular-nums">{n0(y.total)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-faint">Anos sem nota num dos lados ficam sem score. Cada nota compara o ano com o anterior, então o primeiro ano de cada série não tem nota. {scope === "FEDERAL" && "Em 2016, Dilma governou até agosto; o ano está com Temer, que estava no cargo ao fim dele."}</p>
      </section>

      <section className="mb-8">
        <h2 className="display mb-1 text-2xl font-semibold">Econômico <span className="text-base font-normal text-muted">· vale 50%</span></h2>
        <p className="mb-3 text-sm text-muted">Em cada célula: o valor publicado e, abaixo, a nota de 0 a 100 daquele ano.</p>
        {econ.length ? <ItemRows items={econ} years={years} /> : <p className="text-sm text-muted">Nenhum indicador.</p>}
      </section>

      <section className="mb-8">
        <h2 className="display mb-1 text-2xl font-semibold">Social <span className="text-base font-normal text-muted">· vale 50%</span></h2>
        <p className="mb-3 text-sm text-muted">Em cada célula: o valor publicado e, abaixo, a nota de 0 a 100 daquele ano.</p>
        {soc.length ? <ItemRows items={soc} years={years} /> : <p className="text-sm text-muted">Nenhum indicador.</p>}
      </section>

      <section className="max-w-3xl rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed">
        <h2 className="mb-2 font-semibold">Como a conta é feita</h2>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li><b>Nota do indicador em cada ano (0 a 100):</b> mede o quanto o indicador <i>melhorou</i> em relação ao ano anterior, comparado com a melhora de todos os outros anos da mesma série (posição percentual). 100 = a maior melhora da série, 50 = melhora típica, 0 = a maior piora. &ldquo;Melhorar&rdquo; segue o sentido de cada indicador (ex.: menos desemprego é melhor).</li>
          <li><b>Mesma régua para todos:</b> todos os anos e todos os governos são avaliados do mesmo jeito, sem peso maior para nenhum. Como a nota mede a variação e não o nível, uma tendência de longo prazo (como a queda da mortalidade infantil) não favorece quem vem depois.</li>
          <li><b>Nota de cada lado:</b> média simples das notas dos indicadores escolhidos que têm dado no ano — pesos iguais.</li>
          <li><b>Score do ano:</b> média dos dois lados, 50% econômico e 50% social.</li>
          <li><b>Score do governo:</b> média dos scores dos anos em que ele estava no cargo, todos com o mesmo peso.</li>
          <li>Anos que a fonte não publicou ficam de fora, sem preenchimento; só se comparam anos consecutivos publicados.</li>
        </ol>
      </section>
    </div>
  );
}
