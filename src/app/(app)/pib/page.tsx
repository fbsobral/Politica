import Link from "next/link";
import { Suspense } from "react";
import { AskButton } from "@/components/agent/ask-button";
import { GdpTable, GdpYears } from "@/components/gdp-table";
import { EmptyState, NationalOnly, Notice, PageHeader, StatTile } from "@/components/ui";
import { getGdp, quarterLabel, type GdpData, type GdpRow } from "@/lib/gdp";

export const metadata = { title: "PIB por setor" };
export const dynamic = "force-dynamic";

const pct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
const tone = (v: number | null | undefined) => (v == null || Math.abs(v) < 0.05 ? null : v > 0 ? ("up" as const) : ("down" as const));

function Detail({ d }: { d: GdpData }) {
  const L = d.latest;
  const by = (code: number) => d.supply.find((r) => r.code === code)!;
  const tiles: { r: GdpRow; label: string }[] = [{ r: d.pib, label: "PIB" }, { r: by(90687), label: "Agropecuária" }, { r: by(90691), label: "Indústria" }, { r: by(90696), label: "Serviços" }];
  const period = `${quarterLabel(L.q)} de ${L.year} × mesmo período de ${L.year - 1}`;
  return (
    <div className="space-y-8">
      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ r, label }) => <StatTile key={r.code} label={`${label} · ${L.year}`} value={pct(r.acc)} tone={tone(r.acc)} hint={`${quarterLabel(L.q)} · em ${L.year - 1}: ${pct(r.annual[L.year - 1])}`} />)}
      </section>

      <section className="card p-5 sm:p-6" aria-label="Por setor">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Crescimento real · {period}</p>
            <h2 className="display text-2xl font-semibold">Quem puxou e quem segurou o PIB</h2>
          </div>
          <AskButton focus={{ title: `PIB por setor · ${L.year}`, text: `PIB do Brasil, Contas Trimestrais do IBGE, acumulado em ${L.year} até o ${L.q}º trimestre contra o mesmo período de ${L.year - 1}: PIB ${pct(d.pib.acc)}. Setores: ${d.supply.map((r) => `${r.name} ${pct(r.acc)} (peso ${r.share != null ? (r.share * 100).toFixed(1) + "%" : "—"})`).join("; ")}. Demanda: ${d.demand.map((r) => `${r.name} ${pct(r.acc)}`).join("; ")}.`, suggestions: ["Quais setores puxaram o crescimento?", "Por que a indústria de transformação está fraca?", "O que explica o resultado da agropecuária?"] }} />
        </div>
        <p className="mb-4 mt-1 max-w-3xl text-sm text-muted">Abra a indústria e os serviços para ver os subsetores. A coluna “Contribuição” mostra quanto cada setor somou (ou tirou) do crescimento do PIB, pelo seu tamanho. Troque para “Gastos” para ver consumo, investimento, exportações e importações.</p>
        <GdpTable d={d} />
      </section>

      <section className="card p-5 sm:p-6" aria-label="Ano a ano">
        <p className="eyebrow">Ano a ano</p>
        <h2 className="display mb-4 text-2xl font-semibold">Crescimento de cada setor desde 1997</h2>
        <GdpYears d={d} />
      </section>
    </div>
  );
}

async function Content() {
  const d = await getGdp().catch(() => null);
  return (
    <>
      {d ? <Detail d={d} /> : <EmptyState title="Dados indisponíveis">Não consegui buscar as Contas Trimestrais do IBGE agora. Tente novamente mais tarde.</EmptyState>}
      <div className="mt-8 max-w-3xl">
        <Notice kind="info">
          Fonte: IBGE, Contas Nacionais Trimestrais (tabelas 5932, crescimento em volume, e 1846, valores correntes). O IBGE publica cada trimestre cerca de 60 dias depois do fim dele. O PIB trimestral só existe para o Brasil; para o peso de cada setor no seu estado e na sua cidade (Contas Regionais, anual), veja <Link href="/indicadores" className="font-semibold underline">Indicadores</Link>.
        </Notice>
      </div>
    </>
  );
}

export default function PibPage() {
  return (
    <div>
      <PageHeader eyebrow="Números · Brasil · Contas Trimestrais do IBGE" title="PIB por setor" />
      <NationalOnly>Dado nacional: o IBGE só publica o PIB trimestral do Brasil inteiro.</NationalOnly>
      <Suspense fallback={<div className="space-y-6" aria-busy="true"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((k) => <div key={k} className="skeleton h-24" />)}</div><div className="skeleton h-[28rem]" /></div>}>
        <Content />
      </Suspense>
    </div>
  );
}
