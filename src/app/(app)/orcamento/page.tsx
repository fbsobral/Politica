import Link from "next/link";
import { Explain } from "@/components/explain";
import { EmptyState, Notice, PageHeader, ScopeTabs } from "@/components/ui";
import { BRAZIL_POPULATION, brlShort, getBudget, pct, PERIOD_LABEL, type BudgetData, type BudgetScope, type Slice } from "@/lib/budget";
import { SCOPE_LABEL, SCOPE_SLUG, UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Orçamento" };
export const dynamic = "force-dynamic";

const SCOPES: BudgetScope[] = ["MUNICIPAL", "ESTADUAL", "FEDERAL"];
const DOT: Record<BudgetScope, string> = { MUNICIPAL: "bg-municipal", ESTADUAL: "bg-estadual", FEDERAL: "bg-federal" };
const BAR: Record<BudgetScope, string> = { MUNICIPAL: "bg-municipal", ESTADUAL: "bg-estadual", FEDERAL: "bg-federal" };

function perCapita(b: BudgetData, value: number): number | null {
  const pop = b.scope === "FEDERAL" ? BRAZIL_POPULATION : b.population;
  return pop ? value / pop : null;
}

function Bars({ items, scope, explain }: { items: Slice[]; scope: BudgetScope; explain?: boolean }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.code}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{i.name}</span>
            <span className="flex-none text-xs text-muted"><b className="text-ink">{brlShort(i.value)}</b> · {pct(i.share, i.share < 0.1 ? 1 : 0)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line"><div className={`h-full rounded-full ${BAR[scope]}`} style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} /></div>
          {explain && i.code !== "outros" && (
            <Explain kind="budget" label="O que é isso?" text={`Função orçamentária "${i.name}" no orçamento do ${scope === "MUNICIPAL" ? "município" : scope === "ESTADUAL" ? "estado" : "governo federal"}.`} />
          )}
        </li>
      ))}
    </ul>
  );
}

function Progress({ label, done, of, scope, sub }: { label: string; done: number; of: number; scope: BudgetScope; sub: string }) {
  const p = of > 0 ? Math.min(1, done / of) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted"><b className="text-ink">{brlShort(done)}</b> de {brlShort(of)} · {pct(p, 0)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-line"><div className={`h-full rounded-full ${BAR[scope]}`} style={{ width: `${Math.max(1, p * 100)}%` }} /></div>
      <p className="mt-1 text-[11px] text-faint">{sub}</p>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card-flat p-4">
      <p className="eyebrow">{label}</p>
      <p className="display mt-1 text-2xl font-semibold leading-tight sm:text-3xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}
    </div>
  );
}

function Detail({ b }: { b: BudgetData }) {
  const a = b.annual;
  const c = b.current;
  const pc = a ? perCapita(b, a.expenseTotal) : null;
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo">
        <Kpi label={`Despesa ${a?.year ?? ""}`} value={a ? brlShort(a.expenseTotal) : "—"} hint="empenhada no ano fechado" />
        <Kpi label={`Receita ${a?.year ?? ""}`} value={a && a.revenueTotal ? brlShort(a.revenueTotal) : "—"} hint="realizada (bruta)" />
        <Kpi label="Gasto por habitante" value={pc ? `R$ ${Math.round(pc).toLocaleString("pt-BR")}` : "—"} hint={b.scope === "FEDERAL" ? "por brasileiro, no ano" : "por morador, no ano"} />
        <Kpi label={c ? `Execução ${c.year}` : "Execução do ano"} value={c && c.expense.updated ? pct(c.expense.committed / c.expense.updated, 0) : "—"} hint={c ? `da dotação já empenhada (${PERIOD_LABEL[c.period]})` : "sem dados do ano corrente"} />
      </section>

      {a && a.expense.length > 0 && (
        <section aria-label="Para onde vai o dinheiro" className="card p-5 sm:p-6">
          <h2 className="display text-xl font-semibold">Para onde vai o dinheiro</h2>
          <p className="mb-5 text-xs text-muted">Despesa empenhada em {a.year}, por função de governo.</p>
          <Bars items={a.expense} scope={b.scope} explain />
          {b.scope === "FEDERAL" && <p className="mt-4 text-xs leading-relaxed text-faint">“Encargos Especiais” inclui o pagamento de juros e do principal da dívida pública e transferências obrigatórias a estados e municípios.</p>}
        </section>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {a && a.revenue.length > 0 && (
          <section aria-label="De onde vem" className="card p-5 sm:p-6">
            <h2 className="display text-xl font-semibold">De onde vem o dinheiro</h2>
            <p className="mb-5 text-xs text-muted">Receita realizada em {a.year}, por origem.</p>
            <Bars items={a.revenue} scope={b.scope} />
            {b.scope === "FEDERAL" && <p className="mt-4 text-xs leading-relaxed text-faint">Na União, as receitas de capital incluem a emissão de títulos (operações de crédito), usada para rolar a dívida. Por isso o total é muito maior do que a arrecadação de impostos e contribuições.</p>}
            {b.scope === "MUNICIPAL" && <p className="mt-4 text-xs leading-relaxed text-faint">As barras mostram as origens dentro das receitas correntes. Em muitas cidades, as transferências do estado e da União pesam mais do que os tributos próprios.</p>}
          </section>
        )}

        {c && (
          <section aria-label="Ano corrente" className="card p-5 sm:p-6">
            <h2 className="display text-xl font-semibold">{c.year}: previsto x realizado</h2>
            <p className="mb-5 text-xs text-muted">Acumulado até o {c.period}º bimestre ({PERIOD_LABEL[c.period]}), segundo o relatório bimestral de execução orçamentária.</p>
            <div className="space-y-6">
              <Progress label="Receita arrecadada" done={c.revenue.realized} of={c.revenue.updated} scope={b.scope} sub={`Previsão inicial: ${brlShort(c.revenue.initial)} · atualizada: ${brlShort(c.revenue.updated)}`} />
              <Progress label="Despesa empenhada" done={c.expense.committed} of={c.expense.updated} scope={b.scope} sub={`Dotação inicial: ${brlShort(c.expense.initial)} · atualizada: ${brlShort(c.expense.updated)}`} />
            </div>
          </section>
        )}
      </div>

      {!a && !c && <EmptyState title="Sem dados para esta esfera">O Tesouro Nacional ainda não tem os demonstrativos deste ente, ou a fonte não respondeu agora. Tente de novo mais tarde.</EmptyState>}
    </div>
  );
}

function Compare({ list }: { list: { scope: BudgetScope; b: BudgetData | null }[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {list.map(({ scope, b }) => {
        const a = b?.annual;
        const pc = b && a ? perCapita(b, a.expenseTotal) : null;
        return (
          <section key={scope} className="card p-5">
            <p className="inline-flex items-center gap-2 text-xs font-bold"><span className={`h-2 w-2 rounded-full ${DOT[scope]}`} />{SCOPE_LABEL[scope]}</p>
            <p className="display mt-2 truncate text-lg font-semibold">{b?.entity?.replace(/^Prefeitura Municipal de /, "").replace(/ - [A-Z]{2}$/, "") || SCOPE_LABEL[scope]}</p>
            {a ? (
              <>
                <p className="display mt-1 text-3xl font-semibold">{brlShort(a.expenseTotal)}</p>
                <p className="text-xs text-faint">despesa em {a.year}{pc ? ` · R$ ${Math.round(pc).toLocaleString("pt-BR")} por habitante` : ""}</p>
                <div className="mt-4"><Bars items={a.expense.filter((x) => x.code !== "outros").slice(0, 5)} scope={scope} /></div>
                <Link href={`/orcamento?esfera=${scope.toLowerCase()}`} className="mt-4 inline-block text-sm font-semibold text-brand underline-offset-4 hover:underline">Ver detalhes →</Link>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted">Dados indisponíveis no momento.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default async function OrcamentoPage({ searchParams }: { searchParams: Promise<{ esfera?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const all = sp.esfera === "todas";
  const scope: BudgetScope = (SCOPE_SLUG[sp.esfera ?? "municipal"] as BudgetScope | undefined) ?? "MUNICIPAL";

  const results = all
    ? await Promise.all(SCOPES.map(async (s) => ({ scope: s, b: await getBudget(s, user) })))
    : null;
  const one = !all ? await getBudget(scope, user) : null;
  const updated = (all ? results!.map((r) => r.b?.fetchedAt).filter(Boolean) : [one?.fetchedAt]).filter(Boolean) as string[];
  const place = all ? "Todas as esferas" : scope === "MUNICIPAL" ? user.municipality : scope === "ESTADUAL" ? UFS[user.uf] : "Brasil";

  return (
    <div>
      <PageHeader eyebrow="Orçamento público · Tesouro Nacional (Siconfi)" title={place} />
      <ScopeTabs base="/orcamento" scope={all ? "ALL" : scope} />

      {all ? <Compare list={results!} /> : one ? <Detail b={one} /> : <EmptyState title="Dados indisponíveis">Não consegui buscar os demonstrativos no Tesouro Nacional agora. Tente novamente em alguns minutos.</EmptyState>}

      <div className="mt-8 max-w-3xl">
        <Notice kind="info">
          Fonte: demonstrativos que prefeituras, estados e a União enviam ao Tesouro Nacional (Siconfi). Os valores do ano fechado saem com atraso, e algumas cidades enviam fora do prazo ou incompleto.
          {updated.length > 0 && <> Dados consultados em {new Date(updated.sort()[0]).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</>}
        </Notice>
      </div>
    </div>
  );
}
