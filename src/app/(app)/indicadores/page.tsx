import { Suspense } from "react";
import type { User } from "@prisma/client";
import { IndicatorCard, type CardData } from "@/components/indicator-card";
import type { ChartSeries } from "@/components/indicator-chart";
import { EmptyState, PageHeader, ScopeTabs } from "@/components/ui";
import { UF_CODE } from "@/lib/budget";
import { ibgeIdFor } from "@/lib/ibge";
import { GROUPS, INDICATORS, getSeries, type Indicator } from "@/lib/indicators/catalog";
import type { Geo, Scope } from "@/lib/indicators/core";
import { SCOPE_LABEL, SCOPE_SLUG, UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Indicadores" };
export const dynamic = "force-dynamic";

const SCOPES: Scope[] = ["MUNICIPAL", "ESTADUAL", "FEDERAL"];
const SCOPE_COLOR: Record<Scope, string> = { MUNICIPAL: "#0e8a5f", ESTADUAL: "#d9480f", FEDERAL: "#17407f" };

async function geoOf(user: User): Promise<Geo> {
  const uf = user.uf ?? "";
  return { uf, ufCode: UF_CODE[uf] ?? 0, ibge: String((await ibgeIdFor(uf, user.municipalityKey ?? "")) ?? ""), municipalityKey: user.municipalityKey ?? "" };
}

const placeName = (scope: Scope, user: User) => (scope === "FEDERAL" ? "Brasil" : scope === "ESTADUAL" ? UFS[user.uf ?? ""] ?? "Estado" : user.municipality ?? "Município");

async function cardFor(ind: Indicator, scopes: Scope[], geo: Geo, user: User): Promise<CardData | null> {
  const series: ChartSeries[] = [];
  const subSeries: CardData["subs"] = [];
  for (const s of scopes) {
    const v = await getSeries(ind, s, geo);
    if (v) series.push({ name: placeName(s, user), color: scopes.length > 1 ? SCOPE_COLOR[s] : "#17407f", values: v });
  }
  if (!series.length) return null;
  for (const sub of INDICATORS.filter((i) => i.parent === ind.id)) {
    const ss: ChartSeries[] = [];
    for (const s of scopes) {
      const v = await getSeries(sub, s, geo);
      if (v) ss.push({ name: placeName(s, user), color: scopes.length > 1 ? SCOPE_COLOR[s] : "#17407f", values: v });
    }
    if (ss.length) subSeries.push({ id: sub.id, title: sub.name, unit: sub.unit, decimals: sub.decimals, desc: sub.desc, source: sub.source, better: sub.better, series: ss });
  }
  return { id: ind.id, title: ind.name, unit: ind.unit, decimals: ind.decimals, desc: ind.desc, source: ind.source, sourceUrl: ind.sourceUrl, better: ind.better, series, subs: subSeries };
}

async function Group({ group, scopes, user }: { group: (typeof GROUPS)[number]; scopes: Scope[]; user: User }) {
  const geo = await geoOf(user);
  const tops = INDICATORS.filter((i) => i.group === group.id && !i.parent && scopes.some((s) => i.fetch[s]));
  const cards = (await Promise.all(tops.map((i) => cardFor(i, scopes.filter((s) => i.fetch[s]), geo, user)))).filter(Boolean) as CardData[];
  if (!cards.length) return null;
  return (
    <section aria-label={group.title} className="mb-10">
      <h2 className="display text-2xl font-semibold">{group.title}</h2>
      <p className="mb-4 mt-0.5 text-sm text-muted">{group.blurb}</p>
      <div className="grid grid-cols-1 gap-4">{cards.map((c) => <IndicatorCard key={c.id} d={c} />)}</div>
    </section>
  );
}

export default async function IndicadoresPage({ searchParams }: { searchParams: Promise<{ esfera?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const all = sp.esfera === "todas";
  const scope: Scope = (SCOPE_SLUG[sp.esfera ?? "municipal"] as Scope | undefined) ?? "MUNICIPAL";
  const scopes = all ? SCOPES : [scope];
  const place = all ? "Todas as esferas" : placeName(scope, user);
  const missing = all ? [] : INDICATORS.filter((i) => !i.parent && !i.fetch[scope]);

  return (
    <div>
      <PageHeader eyebrow="Números do país, do estado e da cidade · últimos 10 anos" title={`Indicadores · ${place}`} />
      <ScopeTabs base="/indicadores" scope={all ? "ALL" : scope} />
      {all && <p className="-mt-2 mb-6 max-w-3xl text-sm text-muted">Quando um indicador existe em mais de uma esfera, as linhas aparecem juntas: <b style={{ color: SCOPE_COLOR.MUNICIPAL }}>cidade</b>, <b style={{ color: SCOPE_COLOR.ESTADUAL }}>estado</b> e <b style={{ color: SCOPE_COLOR.FEDERAL }}>Brasil</b>.</p>}
      {GROUPS.map((g) => (
        <Suspense key={`${g.id}:${all ? "todas" : scope}`} fallback={<div className="mb-10"><div className="skeleton mb-3 h-8 w-56" /><div className="grid gap-4"><div className="skeleton h-72" /><div className="skeleton h-72" /></div></div>}>
          <Group group={g} scopes={scopes} user={user} />
        </Suspense>
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
