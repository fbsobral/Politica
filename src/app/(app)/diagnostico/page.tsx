import Link from "next/link";
import { Suspense } from "react";
import { AskButton } from "@/components/agent/ask-button";
import { MoneyMap } from "@/components/money-map";
import { EmptyState, Notice, PageHeader, ScopeTabs } from "@/components/ui";
import type { BudgetScope } from "@/lib/budget";
import { getDiagnosis, TYPE_LABEL, type Diagnosis, type Finding, type FindingType } from "@/lib/diagnosis";
import { SCOPE_SLUG, UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Diagnóstico" };
export const dynamic = "force-dynamic";

const SEV: Record<Finding["severity"], { label: string; cls: string; icon: string }> = {
  3: { label: "Grave", cls: "bg-danger/10 text-danger", icon: "●●●" },
  2: { label: "Importante", cls: "bg-estadual-soft text-estadual", icon: "●●○" },
  1: { label: "Atenção", cls: "bg-ink/5 text-muted", icon: "●○○" },
};
const TYPE_ICON: Record<FindingType, string> = { execucao: "⏳", "sem-orcamento": "🕳", prioridades: "⚖", "quem-paga": "🧾", rigidez: "🧱" };

function Lens() {
  return (
    <details className="card-flat group mb-6 p-4 sm:p-5">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Lente: foco na base da pirâmide</span>
          <span className="mt-1.5 block text-sm text-muted">Os números são os oficiais. A ordem dos achados e os caminhos sugeridos seguem um critério explícito: o impacto em quem mais depende do serviço público.</span>
        </span>
        <span className="mt-1 flex-none text-sm font-semibold text-brand group-open:hidden">Como lemos ▾</span>
        <span className="mt-1 hidden flex-none text-sm font-semibold text-brand group-open:inline">Fechar ▴</span>
      </summary>
      <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
        <li>• <b className="text-ink">Prioridade social:</b> pesam mais as áreas de que a população de baixa renda depende — assistência, saúde, educação, saneamento e habitação; depois trabalho, direitos, transporte público e segurança.</li>
        <li>• <b className="text-ink">Tributação progressiva:</b> quem pode mais paga proporcionalmente mais; impostos sobre renda alta e patrimônio antes de impostos sobre consumo, que pesam mais para os pobres.</li>
        <li>• <b className="text-ink">Proteção nos ajustes:</b> corte em juros, privilégios e benefícios fiscais antes de corte no gasto social e no investimento em infraestrutura social.</li>
        <li>• <b className="text-ink">Evidência antes de conclusão:</b> cada achado mostra os números e a fonte; os caminhos são opções para debate, não receitas prontas. Outras lentes levariam a outras prioridades.</li>
      </ul>
    </details>
  );
}

function Card({ f, place }: { f: Finding; place: string }) {
  const s = SEV[f.severity];
  return (
    <article className="card p-5 sm:p-6" id={f.id}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-0.5 font-bold ${s.cls}`}><span aria-hidden className="mr-1 tracking-tighter">{s.icon}</span>{s.label}</span>
        <span className="rounded-full bg-brand-soft px-2.5 py-0.5 font-semibold text-brand"><span aria-hidden>{TYPE_ICON[f.type]} </span>{TYPE_LABEL[f.type]}</span>
      </div>
      <h3 className="display mt-3 text-xl font-semibold leading-snug">{f.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.summary}</p>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl bg-surface-2 p-3.5 text-sm sm:grid-cols-2">
        {f.evidence.map((e) => (
          <div key={e.label}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-faint">{e.label}</dt>
            <dd className="font-medium tabular-nums">{e.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-brand/25 bg-brand-soft/50 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand">Para quem tem menos</p>
          <p className="mt-1 text-sm leading-relaxed">{f.impact}</p>
        </div>
        <div className="rounded-xl border border-line p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Caminhos possíveis</p>
          <ul className="mt-1 space-y-1.5 text-sm leading-relaxed">{f.options.map((o) => <li key={o} className="flex gap-2"><span aria-hidden className="text-brand">→</span>{o}</li>)}</ul>
        </div>
      </div>
      {f.caveat && <p className="mt-3 text-xs leading-relaxed text-faint">Cuidado ao ler: {f.caveat}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <span className="text-xs text-faint">Fonte: {f.source}</span>
        <span className="flex items-center gap-3">
          <Link href={f.link.href} className="text-sm font-semibold text-brand hover:underline">{f.link.label} →</Link>
          <AskButton compact focus={{ title: f.title, text: `Achado do Diagnóstico (${place}), lente "foco na base da pirâmide". ${f.title}. ${f.summary} Evidências: ${f.evidence.map((e) => `${e.label}: ${e.value}`).join("; ")}. Caminhos possíveis: ${f.options.join(" | ")}`, suggestions: ["Explique esse problema em linguagem simples", "Quais caminhos têm mais impacto para os mais pobres?", "Como cobrar isso dos meus representantes?"] }} />
        </span>
      </div>
    </article>
  );
}

function Detail({ d, place }: { d: Diagnosis; place: string }) {
  const counts = (Object.keys(TYPE_LABEL) as FindingType[]).map((t) => ({ t, n: d.findings.filter((f) => f.type === t).length }));
  const grave = d.findings.filter((f) => f.severity === 3).length;
  return (
    <div className="space-y-8">
      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="card-flat col-span-2 p-4 sm:col-span-3 lg:col-span-1">
          <p className="eyebrow">Achados</p>
          <p className="display mt-1 text-3xl font-semibold">{d.findings.length}</p>
          <p className="text-xs text-faint">{grave ? `${grave} grave${grave > 1 ? "s" : ""}` : "nenhum grave"}</p>
        </div>
        {counts.map(({ t, n }) => (
          <a key={t} href={n ? `#${d.findings.find((f) => f.type === t)!.id}` : undefined} className={`card-flat p-4 ${n ? "transition-shadow hover:shadow-card" : "opacity-60"}`}>
            <p className="text-lg" aria-hidden>{TYPE_ICON[t]}</p>
            <p className="mt-1 text-xs font-semibold leading-snug">{TYPE_LABEL[t]}</p>
            <p className="display text-xl font-semibold">{n}</p>
          </a>
        ))}
      </section>

      {d.map && (
        <section className="card p-5 sm:p-6" aria-label="Mapa do dinheiro">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Mapa do dinheiro · {d.map.year}</p>
              <h2 className="display text-2xl font-semibold">De onde vem e para onde vai</h2>
            </div>
            <AskButton focus={{ title: `Mapa do dinheiro · ${place}`, text: `Receitas de ${d.map.year}: ${d.map.revenue.map((n) => `${n.name} ${n.value}`).join("; ")}. Despesas: ${d.map.expense.map((n) => `${n.name} ${n.value}`).join("; ")}.`, suggestions: ["Para onde vai a maior parte do dinheiro?", "Quanto vai para juros comparado às áreas sociais?"] }} />
          </div>
          <p className="mb-4 mt-1 max-w-3xl text-sm text-muted">Todo o dinheiro que entra (impostos e repasses) passa pelo caixa do governo e sai para as áreas. Siga as faixas para ver o peso de cada uma.</p>
          <MoneyMap map={d.map} />
        </section>
      )}

      <section aria-label="Achados" className="space-y-4">
        <div>
          <p className="eyebrow">Achados, do mais para o menos importante na lente</p>
          <h2 className="display text-2xl font-semibold">Onde estão os gargalos</h2>
        </div>
        {d.findings.length ? d.findings.map((f) => <Card key={f.id} f={f} place={place} />) : <EmptyState title="Nenhum gargalo evidente">Com os dados disponíveis, nenhuma área passou dos limites de alerta. Isso não quer dizer que não haja problemas: confira Indicadores e Expectativa fiscal.</EmptyState>}
      </section>

      {d.notes.length > 0 && <Notice kind="info">{d.notes.join(" ")}</Notice>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((k) => <div key={k} className="skeleton h-24" />)}</div>
      <div className="skeleton h-[26rem]" />
      <div className="skeleton h-72" />
      <p className="text-center text-sm text-muted">Cruzando orçamento, execução, indicadores e impostos…</p>
    </div>
  );
}

async function Content({ scope, place }: { scope: BudgetScope; place: string }) {
  const user = await requireUser();
  const d = await getDiagnosis(scope, user);
  return (
    <>
      {d ? <Detail d={d} place={place} /> : <EmptyState title="Dados indisponíveis">Não consegui reunir o orçamento deste ente agora. Tente novamente mais tarde.</EmptyState>}
      <div className="mt-8 max-w-3xl">
        <Notice kind="info">
          O Diagnóstico cruza dados oficiais já presentes no app: balanços anuais e relatórios bimestrais do Tesouro Nacional (Siconfi), indicadores do IBGE, Ministério da Saúde e outras fontes, e estatísticas de impostos da OCDE. Os limites de alerta (por exemplo, execução 10% abaixo da LOA) e a ordem dos achados são escolhas do Política, explicadas na lente acima.
        </Notice>
      </div>
    </>
  );
}

export default async function DiagnosticoPage({ searchParams }: { searchParams: Promise<{ esfera?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope: BudgetScope = (SCOPE_SLUG[sp.esfera ?? "municipal"] as BudgetScope | undefined) ?? "MUNICIPAL";
  const place = scope === "MUNICIPAL" ? user.municipality : scope === "ESTADUAL" ? UFS[user.uf] : "Brasil";
  return (
    <div>
      <PageHeader eyebrow={`Números · ${place} · lacunas e gargalos do gasto público`} title="Diagnóstico" />
      <ScopeTabs base="/diagnostico" scope={scope} noAll />
      <Lens />
      <Suspense key={scope} fallback={<Skeleton />}>
        <Content scope={scope} place={place} />
      </Suspense>
    </div>
  );
}
