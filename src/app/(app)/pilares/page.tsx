import Link from "next/link";
import { Suspense } from "react";
import { PillarsDetail, PillarsLegend } from "@/components/pillars-view";
import { EmptyState, Notice, PageHeader, ScopeTabs } from "@/components/ui";
import type { BudgetScope } from "@/lib/budget";
import { getPillars } from "@/lib/pillars";
import { SCOPE_SLUG, UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Pilares" };
export const dynamic = "force-dynamic";

function Skeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((k) => <div key={k} className="skeleton h-24" />)}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((k) => <div key={k} className="skeleton h-28" />)}</div>
      <div className="skeleton h-80" />
    </div>
  );
}

async function Content({ scope }: { scope: BudgetScope }) {
  const user = await requireUser();
  const r = await getPillars(scope, user).catch(() => null);
  return (
    <>
      {r ? <PillarsDetail r={r} /> : <EmptyState title="Dados indisponíveis">Não consegui reunir os indicadores agora. Tente novamente mais tarde.</EmptyState>}
      <div className="mt-8 max-w-3xl">
        <Notice kind="info">
          Os resultados vêm dos mesmos dados oficiais de <Link href="/indicadores" className="font-semibold underline">Indicadores</Link> (IBGE, Ministério da Saúde, IPEA, Banco Central, Tesouro) e do Censo 2022. O gasto de cada pilar vem do balanço anual (Siconfi). Quando a cidade não tem a série, mostramos a do estado e avisamos. A escolha das métricas e a classificação das metas são do Política, com a origem de cada número indicada.
        </Notice>
      </div>
    </>
  );
}

export default async function PilaresPage({ searchParams }: { searchParams: Promise<{ esfera?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope: BudgetScope = (SCOPE_SLUG[sp.esfera ?? "municipal"] as BudgetScope | undefined) ?? "MUNICIPAL";
  const place = scope === "MUNICIPAL" ? user.municipality : scope === "ESTADUAL" ? UFS[user.uf] : "Brasil";
  return (
    <div>
      <PageHeader eyebrow={`Números · ${place} · resultado de cada área do governo`} title="Pilares" />
      <ScopeTabs base="/pilares" scope={scope} noAll />
      <PillarsLegend />
      <Suspense key={scope} fallback={<Skeleton />}>
        <Content scope={scope} />
      </Suspense>
    </div>
  );
}
