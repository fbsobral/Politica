import { Suspense } from "react";
import { AskButton } from "@/components/agent/ask-button";
import { TaxDashboard } from "@/components/tax-charts";
import { EmptyState, NationalOnly, Notice, PageHeader, StatTile } from "@/components/ui";
import { CATEGORIES, getTaxes, type TaxData } from "@/lib/taxes";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Impostos" };
export const dynamic = "force-dynamic";

const n1 = (v: number | null | undefined) => (v == null ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
const usd = (v: number | null | undefined) => {
  if (v == null) return "—";
  return v >= 1e12 ? `US$ ${(v / 1e12).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} tri` : v >= 1e9 ? `US$ ${Math.round(v / 1e9).toLocaleString("pt-BR")} bi` : `US$ ${Math.round(v).toLocaleString("pt-BR")}`;
};

function Detail({ d }: { d: TaxData }) {
  const i = d.years.length - 1, y = d.years[i];
  const s = (code: string) => d.series.find((x) => x.code === code)!;
  const t = s("_T"), cons = s("T_5000"), inc = s("T_1000");
  const cmp = (x: typeof t) => `desenvolvidos ${n1(x.developed[i].pct)} · em desenv. ${n1(x.developing[i].pct)}`;
  const ctx = CATEGORIES.filter((c) => !c.parent).map((c) => `${c.name}: Brasil ${n1(s(c.code).brazil.pct[i])} do PIB; desenvolvidos ${n1(s(c.code).developed[i].pct)}; em desenvolvimento ${n1(s(c.code).developing[i].pct)}`).join("\n");
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo">
        <StatTile label={`Carga tributária ${y}`} value={n1(t.brazil.pct[i])} hint={cmp(t)} />
        <StatTile label="Impostos sobre consumo" value={n1(cons.brazil.pct[i])} hint={cmp(cons)} />
        <StatTile label="Impostos sobre renda" value={n1(inc.brazil.pct[i])} hint={cmp(inc)} />
        <StatTile label="Arrecadação total" value={usd(t.brazil.usd[i])} hint={t.brazil.perCapita[i] ? `US$ ${Math.round(t.brazil.perCapita[i]!).toLocaleString("pt-BR")} por habitante (desenv.: US$ ${Math.round(t.developed[i].perCapita ?? 0).toLocaleString("pt-BR")})` : undefined} />
      </section>
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted">Carga tributária é tudo o que o governo arrecada em impostos e contribuições sociais, somando União, estados, municípios e previdência, em relação ao PIB. Cada gráfico compara o Brasil com a média dos países desenvolvidos (renda alta) e dos países em desenvolvimento (renda baixa e média), pela classificação do Banco Mundial.</p>
        <AskButton focus={{ title: "Impostos no Brasil e no mundo", text: `Carga tributária em ${y} (OCDE, governo geral), em % do PIB:\n${ctx}\nArrecadação total do Brasil: ${usd(t.brazil.usd[i])}.`, suggestions: ["O Brasil cobra muito imposto?", "Por que o Brasil tributa tanto o consumo?", "O que muda com a reforma tributária?"] }} />
      </div>
      <TaxDashboard data={d} categories={CATEGORIES} />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((k) => <div key={k} className="skeleton h-28" />)}</div>
      <div className="skeleton h-40" />
      <div className="skeleton h-[22rem]" />
    </div>
  );
}

async function Content() {
  const d = await getTaxes();
  return (
    <>
      {d ? <Detail d={d} /> : <EmptyState title="Dados indisponíveis">Não consegui buscar as estatísticas de impostos da OCDE agora. Tente novamente mais tarde.</EmptyState>}
      <div className="mt-8 max-w-3xl">
        <Notice kind="info">
          Fontes: OCDE, Global Revenue Statistics (receita tributária do governo geral, em % do PIB e em dólares correntes, de {d?.years[0] ?? 1990} a {d?.years.at(-1) ?? "hoje"}), e Banco Mundial (classificação de renda dos países e população). As médias dos grupos são simples, como a média oficial da OCDE, e o número de países com dado varia ao longo dos anos (veja no detalhe de cada ponto). Valores em dólar usam o câmbio de cada ano.
          {d && <> Dados consultados em {new Date(d.fetchedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</>}
        </Notice>
      </div>
    </>
  );
}

export default async function ImpostosPage() {
  await requireUser();
  return (
    <div>
      <PageHeader eyebrow="Números · Brasil × mundo · OCDE e Banco Mundial" title="Impostos" />
      <NationalOnly>Dado do país: soma União, estados, municípios e previdência.</NationalOnly>
      <Suspense fallback={<Skeleton />}>
        <Content />
      </Suspense>
    </div>
  );
}
