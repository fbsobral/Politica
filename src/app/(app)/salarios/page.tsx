import { Suspense } from "react";
import { AskButton } from "@/components/agent/ask-button";
import { LaborShareChart } from "@/components/labor-share-chart";
import { EmptyState, NationalOnly, Notice, PageHeader, StatTile } from "@/components/ui";
import { getLaborShare, type LaborShareData } from "@/lib/labor-share";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Salários e lucros" };
export const dynamic = "force-dynamic";

const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`);
const rs = (v: number | null | undefined) => (v == null ? "—" : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

function Detail({ d }: { d: LaborShareData }) {
  const last = d.annual.at(-1);
  const ten = last ? d.annual.find((p) => p.year === last.year - 10) : undefined;
  const lr = d.longRun.at(-1);
  const pp = (a?: number | null, b?: number | null) => (a != null && b != null ? `${a - b >= 0 ? "+" : "−"}${Math.abs((a - b) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p. em 10 anos` : undefined);
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo">
        <StatTile label={`Salários no PIB ${last?.year ?? ""}`} value={pct(last?.wageGdp)} hint={pp(last?.wageGdp, ten?.wageGdp) ?? "remuneração dos empregados ÷ PIB"} />
        <StatTile label="Na renda dos fatores" value={pct(last?.wageFactor)} hint={pp(last?.wageFactor, ten?.wageFactor) ?? "sem impostos sobre a produção"} />
        <StatTile label="Taxa de exploração" value={rs(last?.exploitation)} hint="de excedente operacional para cada R$ 1 de salário" />
        <StatTile label={`Longo prazo ${lr?.year ?? ""}`} value={pct(lr?.share)} hint="trabalho no PIB, com autônomos (Penn World Table)" />
      </section>

      <section className="card p-5 sm:p-6" aria-label="O que são estes números">
        <div className="flex items-start justify-between gap-3">
          <h2 className="display text-xl font-semibold">O que estes números medem</h2>
          <AskButton focus={{ title: "Salários e lucros no Brasil", text: `Participação dos salários e taxa de exploração no Brasil. Últimos dados do IBGE (${last?.year ?? "?"}): salários ${pct(last?.wageGdp)} do PIB, ${pct(last?.wageFactor)} da renda dos fatores; excedente operacional de ${rs(last?.exploitation)} por R$ 1 de salário. Série anual: ${d.annual.map((p) => `${p.year}: ${pct(p.wageGdp)}`).join("; ")}. Longo prazo (Penn World Table): ${d.longRun.filter((p) => p.year % 5 === 0).map((p) => `${p.year}: ${pct(p.share)}`).join("; ")}.`, suggestions: ["O que é a taxa de exploração?", "O que Clara Mattei diz sobre isso?", "Por que a participação dos salários mudou?"] }} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-5 text-sm leading-relaxed text-muted md:grid-cols-2">
          <p><b className="text-ink">Participação dos salários</b> é a fatia da renda produzida no país que vai para quem trabalha como empregado (salários, encargos e contribuições), em relação ao PIB ou à renda dos fatores (salários + lucros e aluguéis + rendimento dos autônomos, sem impostos).</p>
          <p><b className="text-ink">Taxa de exploração</b>, termo da tradição marxista retomado por Clara Mattei em <i>A Ordem do Capital</i>, compara o que fica com o capital (o excedente operacional: lucros, juros, aluguéis) com o que vai para os salários. Aqui: excedente operacional bruto ÷ remuneração dos empregados.</p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-faint">Na leitura de Mattei, políticas de austeridade fiscal, monetária e trabalhista tendem a transferir renda dos salários para o capital. Outras escolas explicam as variações por produtividade, tecnologia, preços de commodities ou informalidade. Os números abaixo são os oficiais; a interpretação fica com você.</p>
      </section>

      <section aria-label="Série histórica">
        <p className="eyebrow">Série histórica</p>
        <h2 className="display text-2xl font-semibold">Salários e capital ao longo do tempo</h2>
        <p className="mb-4 mt-1 max-w-3xl text-sm text-muted">Escolha a medida e o período. A faixa no topo mostra quem era o presidente; a tabela compara a média de cada governo.</p>
        <LaborShareChart data={d} />
      </section>

      {d.errors.length > 0 && <Notice kind="info">Algumas fontes não responderam agora ({d.errors.join(", ")}); parte do painel pode estar incompleta.</Notice>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28" />)}</div>
      <div className="skeleton h-40" />
      <div className="skeleton h-[24rem]" />
    </div>
  );
}

async function Content() {
  const d = await getLaborShare();
  return (
    <>
      {d && (d.annual.length || d.longRun.length) ? <Detail d={d} /> : <EmptyState title="Dados indisponíveis">Não consegui buscar as contas nacionais no IBGE nem a série de longo prazo agora. Tente novamente mais tarde.</EmptyState>}
      <div className="mt-8 max-w-3xl">
        <Notice kind="info">
          Fontes: {d?.annualSource ?? "IBGE, Contas Nacionais (conta de geração da renda)"}{d?.quarterlySource ? `; ${d.quarterlySource}` : ""}; Penn World Table 10 (Universidade de Groningen), via FRED, para o longo prazo — inclui uma estimativa da renda do trabalho dos autônomos, por isso fica acima da série do IBGE. As contas nacionais anuais saem com cerca de dois anos de atraso.
          {d && <> Dados consultados em {new Date(d.fetchedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</>}
        </Notice>
      </div>
    </>
  );
}

export default async function SalariosPage() {
  await requireUser();
  return (
    <div>
      <PageHeader eyebrow="Números · Brasil · IBGE e Penn World Table" title="Salários e lucros" />
      <NationalOnly>Dado nacional: as contas nacionais medem a renda de todo o país.</NationalOnly>
      <Suspense fallback={<Skeleton />}>
        <Content />
      </Suspense>
    </div>
  );
}
