import { Suspense } from "react";
import type { User } from "@prisma/client";
import { IndicatorCard, type CardData } from "@/components/indicator-card";
import type { ChartSeries } from "@/components/indicator-chart";
import { EmptyState, PageHeader, RangeTabs, ScopeTabs, rangeOf } from "@/components/ui";
import { ipcaByYear, UF_CODE } from "@/lib/budget";
import { ibgeIdFor } from "@/lib/ibge";
import { BUNDLES, GROUPS, INDICATORS, SIDES, SECTOR_INDICATORS, getSeries, type Indicator } from "@/lib/indicators/catalog";
import { clip, lastClosedYear, type Geo, type Scope, type YearSeries } from "@/lib/indicators/core";
import { SCOPE_LABEL, SCOPE_SLUG, UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Indicadores" };
export const dynamic = "force-dynamic";

/** Série já recortada para a janela escolhida (os últimos N anos fechados). */
async function getWin(from: number, ind: Indicator, scope: Scope, geo: Geo): Promise<YearSeries | null> {
  const v = await getSeries(ind, scope, geo);
  if (!v) return null;
  const c = clip(v, from, lastClosedYear() + 1);
  return Object.keys(c).length ? c : null;
}

const SCOPES: Scope[] = ["MUNICIPAL", "ESTADUAL", "FEDERAL"];
const SCOPE_COLOR: Record<Scope, string> = { MUNICIPAL: "#0e8a5f", ESTADUAL: "#d9480f", FEDERAL: "#17407f" };

async function geoOf(user: User): Promise<Geo> {
  const uf = user.uf ?? "";
  return { uf, ufCode: UF_CODE[uf] ?? 0, ibge: String((await ibgeIdFor(uf, user.municipalityKey ?? "")) ?? ""), municipalityKey: user.municipalityKey ?? "" };
}

const placeName = (scope: Scope, user: User) => (scope === "FEDERAL" ? "Brasil" : scope === "ESTADUAL" ? UFS[user.uf ?? ""] ?? "Estado" : user.municipality ?? "Município");

/** Fator para levar cada ano aos preços do último ano fechado (índice IPCA médio do ano, IBGE). */
async function deflators(): Promise<Record<number, number>> {
  const ipca = await ipcaByYear();
  const last = new Date().getFullYear() - 1;
  const base = ipca[last];
  const out: Record<number, number> = {};
  if (base) for (const [y, v] of Object.entries(ipca)) if (v) out[Number(y)] = base / v;
  return out;
}

async function cardFor(from: number, ind: Indicator, scopes: Scope[], geo: Geo, user: User, deflator: Record<number, number> | null): Promise<CardData | null> {
  const series: ChartSeries[] = [];
  const subSeries: CardData["subs"] = [];
  for (const s of scopes) {
    const v = await getWin(from, ind, s, geo);
    if (v) series.push({ name: placeName(s, user), color: scopes.length > 1 ? SCOPE_COLOR[s] : "#17407f", values: v });
  }
  if (!series.length) return null;
  for (const sub of INDICATORS.filter((i) => i.parent === ind.id)) {
    const ss: ChartSeries[] = [];
    for (const s of scopes) {
      const v = await getWin(from, sub, s, geo);
      if (v) ss.push({ name: placeName(s, user), color: scopes.length > 1 ? SCOPE_COLOR[s] : "#17407f", values: v });
    }
    if (ss.length) subSeries.push({ inflation: Boolean(sub.inflation), id: sub.id, title: sub.name, unit: sub.unit, decimals: sub.decimals, desc: sub.desc, source: sub.source, better: sub.better, series: ss });
  }
  // PIB do Brasil: acima de cada valor em R$ vai o crescimento REAL publicado pelo IBGE (e não a variação nominal, que inclui a inflação)
  const realGrowth = ind.id === "pib" && scopes.length === 1 && scopes[0] === "FEDERAL" ? await getWin(from, INDICATORS.find((i) => i.id === "pib-cresc")!, "FEDERAL", geo) : null;
  return { changeLabels: realGrowth ?? undefined, changeNote: realGrowth ? "Acima de cada valor: crescimento real do PIB no ano (volume, já descontada a inflação), como publicado pelo IBGE." : undefined, deflator: deflator && (ind.inflation || subSeries.some((x) => x.inflation)) ? deflator : undefined, deflatorYear: new Date().getFullYear() - 1, id: ind.id, title: ind.name, unit: ind.unit, decimals: ind.decimals, desc: ind.desc, source: ind.source, sourceUrl: ind.sourceUrl, better: ind.better, series, subs: subSeries };
}

const BUNDLE_COLORS = ["#0e8a5f", "#d9480f", "#17407f", "#7048e8", "#e0a800", "#d6336c"];

/** Gráfico com várias linhas publicadas pela fonte (ex.: PIB por setor). Só faz sentido com uma esfera por vez. */
async function bundleCard(from: number, b: (typeof BUNDLES)[number], scope: Scope, geo: Geo, deflator: Record<number, number> | null): Promise<CardData | null> {
  const members = SECTOR_INDICATORS.filter((i) => i.bundle === b.id && i.fetch[scope]);
  const series: ChartSeries[] = [];
  for (const m of members) {
    const v = await getWin(from, m, scope, geo);
    if (v) series.push({ name: m.name, color: BUNDLE_COLORS[series.length % BUNDLE_COLORS.length], values: v });
  }
  if (!series.length) return null;
  return { id: b.id, title: b.title, unit: b.unit, decimals: b.decimals, desc: b.desc, source: b.source, sourceUrl: b.sourceUrl, series, subs: [], deflator: b.inflation && deflator ? deflator : undefined, deflatorYear: new Date().getFullYear() - 1 };
}

async function Group({ group, scopes, user, from }: { group: (typeof GROUPS)[number]; scopes: Scope[]; user: User; from: number }) {
  const geo = await geoOf(user);
  const tops = INDICATORS.filter((i) => i.group === group.id && !i.parent && scopes.some((s) => i.fetch[s]));
  // o fator de correção só é buscado se algum gráfico do grupo for em reais
  const deflator = tops.some((i) => i.inflation || INDICATORS.some((c) => c.parent === i.id && c.inflation)) ? await deflators() : null;
  const cards0 = (await Promise.all(tops.map((i) => cardFor(from, i, scopes.filter((s) => i.fetch[s]), geo, user, deflator)))).filter(Boolean) as CardData[];
  // gráficos de várias linhas (PIB por setor) só quando há uma esfera escolhida
  const bundles = scopes.length === 1 ? BUNDLES.filter((b) => b.group === group.id) : [];
  const bundleDeflator = bundles.some((b) => b.inflation) ? deflator ?? (await deflators()) : null;
  const bundleCards = (await Promise.all(bundles.map((b) => bundleCard(from, b, scopes[0], geo, bundleDeflator)))).filter(Boolean) as CardData[];
  const cards = [...cards0, ...bundleCards];
  if (!cards.length) return null;
  return (
    <section aria-label={group.title} className="mb-10">
      <h3 className="display text-xl font-semibold">{group.title}</h3>
      <p className="mb-4 mt-0.5 text-sm text-muted">{group.blurb}</p>
      <div className="grid grid-cols-1 gap-4">{cards.map((c) => <IndicatorCard key={c.id} d={c} />)}</div>
    </section>
  );
}

export default async function IndicadoresPage({ searchParams }: { searchParams: Promise<{ esfera?: string; anos?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const all = sp.esfera === "todas";
  const scope: Scope = (SCOPE_SLUG[sp.esfera ?? "municipal"] as Scope | undefined) ?? "MUNICIPAL";
  const scopes = all ? SCOPES : [scope];
  const years = rangeOf(sp.anos);
  const from = lastClosedYear() - years + 1;
  const place = all ? "Todas as esferas" : placeName(scope, user);
  const missing = all ? [] : INDICATORS.filter((i) => !i.parent && !i.fetch[scope]);

  return (
    <div>
      <PageHeader eyebrow={`Números do país, do estado e da cidade · últimos ${years} anos`} title={`Indicadores · ${place}`} />
      <ScopeTabs base="/indicadores" scope={all ? "ALL" : scope} params={{ anos: sp.anos }} />
      <RangeTabs base="/indicadores" years={years} params={{ esfera: sp.esfera }} />
      {all && <p className="-mt-2 mb-6 max-w-3xl text-sm text-muted">Quando um indicador existe em mais de uma esfera, as linhas aparecem juntas: <b style={{ color: SCOPE_COLOR.MUNICIPAL }}>cidade</b>, <b style={{ color: SCOPE_COLOR.ESTADUAL }}>estado</b> e <b style={{ color: SCOPE_COLOR.FEDERAL }}>Brasil</b>.</p>}
      <nav aria-label="Ir para" className="sticky top-14 z-10 -mx-4 mb-6 border-y border-line bg-paper/90 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex gap-x-6 gap-y-1 overflow-x-auto whitespace-nowrap">
          {SIDES.map((side) => (
            <div key={side.id} className="flex items-center gap-1.5">
              <a href={`#lado-${side.id}`} className="text-xs font-bold uppercase tracking-wide text-ink">{side.id === "economico" ? "Econômicos" : "Sociais"}</a>
              {side.groups.map((gid) => {
                const g = GROUPS.find((x) => x.id === gid)!;
                return <a key={gid} href={`#grupo-${gid}`} className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted hover:bg-ink/5 hover:text-ink">{g.title}</a>;
              })}
            </div>
          ))}
        </div>
      </nav>
      {SIDES.map((side) => (
        <div key={side.id} id={`lado-${side.id}`} className="scroll-mt-32">
          <div className="mb-5 flex items-end gap-3 border-b-2 border-ink pb-2">
            <h2 className="display text-3xl font-semibold">{side.title}</h2>
            <p className="pb-1 text-sm text-muted">{side.blurb}</p>
          </div>
          {side.groups.map((gid) => {
            const g = GROUPS.find((x) => x.id === gid)!;
            return (
              <div key={g.id} id={`grupo-${g.id}`} className="scroll-mt-32">
                <Suspense key={`${g.id}:${all ? "todas" : scope}:${years}`} fallback={<div className="mb-10"><div className="skeleton mb-3 h-8 w-56" /><div className="grid gap-4"><div className="skeleton h-72" /><div className="skeleton h-72" /></div></div>}>
                  <Group group={g} scopes={scopes} user={user} from={from} />
                </Suspense>
              </div>
            );
          })}
        </div>
      ))}
      {missing.length > 0 && (
        <details className="max-w-3xl rounded-2xl border border-line bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-semibold">{missing.length} indicadores sem dado para {SCOPE_LABEL[scope].toLowerCase()}</summary>
          <p className="mt-2 text-muted">Ou porque a fonte pública não publica nesse nível, ou porque ainda não foram ligados: {missing.map((m) => m.name).join(", ")}.</p>
        </details>
      )}
      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-faint">
        Dados de fontes oficiais (Banco Central, IBGE, Tesouro Nacional e outras), atualizados semanalmente. Os anos mais recentes saem com atraso, e cada fonte tem sua metodologia. Indicadores em % do PIB ou da renda não são diretamente comparáveis com valores em reais.
      </p>
      {!INDICATORS.length && <EmptyState title="Sem indicadores">Nenhum indicador cadastrado.</EmptyState>}
    </div>
  );
}
