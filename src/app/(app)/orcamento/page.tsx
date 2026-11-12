import Link from "next/link";
import { Fragment, Suspense } from "react";
import { BudgetChart } from "@/components/budget-chart";
import { BudgetShareTable, ExpenseShareTables } from "@/components/budget-share-table";
import { InfoTip } from "@/components/info-tip";
import { brDateTime } from "@/lib/stamp";
import { PrimaryChart } from "@/components/primary-chart";
import { getPrimaryHistory } from "@/lib/primary";
import { AskButton, type AskFocus } from "@/components/agent/ask-button";
import { Explain } from "@/components/explain";
import { EmptyState, Notice, PageHeader, ScopeTabs } from "@/components/ui";
import { BRAZIL_POPULATION, brlShort, getBudget, getBudgetHistory, pct, PERIOD_LABEL, type BudgetData, type BudgetScope, type Slice } from "@/lib/budget";
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

type Kind = "expense" | "revenue" | "nature";
const KIND_LABEL: Record<Kind, string> = { expense: "Função orçamentária", revenue: "Fonte de receita", nature: "Tipo de gasto" };

function Bars({ items, scope, explain, child, parent }: { items: Slice[]; scope: BudgetScope; explain?: Kind; child?: boolean; parent?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const bar = (i: Slice) => (
    <>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className={`min-w-0 truncate ${child ? "text-[13px]" : "font-medium"}`}>{i.name}</span>
        <span className="flex-none text-xs text-muted">
          <b className="text-ink">{brlShort(i.value)}</b> · {pct(i.share, i.share < 0.1 ? 1 : 0)}
          {child && i.shareOfParent !== undefined && <span className="text-faint"> ({pct(i.shareOfParent, 0)} do grupo)</span>}
        </span>
      </div>
      <div className={`${child ? "h-1.5" : "h-2"} overflow-hidden rounded-full bg-line`}><div className={`h-full rounded-full ${BAR[scope]} ${child ? "opacity-70" : ""}`} style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} /></div>
    </>
  );
  return (
    <ul className={child ? "space-y-2.5" : "space-y-3"}>
      {items.map((i) => (
        <li key={i.code}>
          {i.children && i.children.length > 0 ? (
            <details className="group">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                {bar(i)}
                <span className="mt-1 inline-block text-[11px] font-semibold text-brand group-open:hidden">▸ ver {i.children.length} subcategorias</span>
                <span className="mt-1 hidden text-[11px] font-semibold text-brand group-open:inline-block">▾ ocultar subcategorias</span>
              </summary>
              <div className="mt-2 border-l-2 border-line pl-3">
                <Bars items={i.children} scope={scope} child explain={explain} parent={i.name} />
              </div>
            </details>
          ) : (
            bar(i)
          )}
          {explain && i.code !== "outros" && !i.code.endsWith(".out") && (
            <Explain kind="budget" label="O que é isso?" text={`${child ? (explain === "expense" ? "Subfunção" : "Item de receita") : KIND_LABEL[explain]} "${i.name}"${parent ? `, dentro de "${parent}"` : ""}, no orçamento do ${scope === "MUNICIPAL" ? "município" : scope === "ESTADUAL" ? "estado" : "governo federal"}.`} />
          )}
        </li>
      ))}
    </ul>
  );
}

/** Texto compacto de uma lista de fatias (com subcategorias) para o assistente. */
function sliceText(items: Slice[], depth = 0): string {
  return items
    .filter((i) => i.code !== "outros")
    .slice(0, depth === 0 ? 12 : 6)
    .map((i) => `${"  ".repeat(depth)}- ${i.name}: ${brlShort(i.value)} (${pct(i.share, 1)})${i.children?.length && depth < 1 ? `\n${sliceText(i.children, depth + 1)}` : ""}`)
    .join("\n");
}

function askBudget(b: BudgetData, what: string, body: string, suggestions: string[]): AskFocus {
  return { title: `${what} · ${b.entity}`, text: `${what} (${b.entity}, ano ${b.annual?.year}). Valores do ano fechado, como declarados ao Tesouro Nacional (Siconfi):\n${body}`, suggestions };
}

type MiniRow = [string, string];
function MiniCard({ title, big, caption, note, ask, rows, bar, link }: { title: string; big: string; caption: string; note: string; ask: AskFocus; rows: MiniRow[]; bar?: { fill: number; tick: number; scope: BudgetScope }; link?: { href: string; label: string } }) {
  return (
    <section className="card flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{title}</p>
        <span className="flex items-center gap-1.5">
          <InfoTip label={`Sobre ${title}`}><span className="block">{note}</span></InfoTip>
          <AskButton compact focus={ask} />
        </span>
      </div>
      <p className="display mt-1.5 text-2xl font-semibold leading-tight">{big}</p>
      <p className="min-h-[2rem] text-[11px] leading-snug text-faint">{caption}</p>
      <div className="min-h-[2.75rem]">
        {bar && (
          <div className="relative mt-3 h-3" role="img" aria-label={`Executado: ${pct(bar.fill, 0)}; esperado até agora: ${pct(bar.tick, 0)}`}>
            <div className="absolute inset-0 rounded-full bg-ink/10" />
            <div className="absolute left-0 top-[2px] h-2 rounded-full" style={{ width: `${Math.min(100, bar.fill * 100)}%`, background: `var(--${bar.scope.toLowerCase()})` }} />
            <div className="absolute -top-0.5 h-4 w-0.5 bg-ink" style={{ left: `calc(${Math.min(100, bar.tick * 100)}% - 1px)` }} />
          </div>
        )}
      </div>
      <dl className="mt-auto grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1.5 border-t border-line pt-2.5 text-xs">
        {rows.map(([k, v]) => (
          <Fragment key={k}>
            <dt className="whitespace-nowrap text-muted">{k}</dt>
            <dd className="truncate text-right font-semibold tabular-nums" title={v}>{v}</dd>
          </Fragment>
        ))}
      </dl>
      {link && <Link href={link.href} className="mt-2 text-xs font-semibold text-brand hover:underline">{link.label}</Link>}
    </section>
  );
}

function Detail({ b }: { b: BudgetData }) {
  const a = b.annual;
  const c = b.current;
  const pc = a ? perCapita(b, a.expenseTotal) : null;
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Resumo">
        {(() => {
          const top = a?.expense.find((x) => x.code !== "outros");
          const top3 = a ? a.expense.filter((x) => x.code !== "outros").slice(0, 3).reduce((acc, x) => acc + x.share, 0) : 0;
          const tax = a?.revenue.find((r) => r.code === "RO1.1");
          const transfer = a?.revenue.find((r) => r.code === "RO1.7");
          const pop = b.scope === "FEDERAL" ? BRAZIL_POPULATION : b.population;
          const rc = a && a.revenueTotal ? perCapita(b, a.revenueTotal) : null;
          const perWho = b.scope === "FEDERAL" ? "brasileiro" : "morador";
          const elapsed = c ? c.period / 6 : null;
          const exec = c && c.expense.updated ? c.expense.committed / c.expense.updated : null;
          const pace = exec !== null && elapsed ? exec / elapsed : null;
          return (
            <>
              <MiniCard
                title={`Despesa ${a?.year ?? ""}`} big={a ? brlShort(a.expenseTotal) : "—"} caption="empenhada no ano fechado"
                note="Tudo o que o governo comprometeu gastar no ano, como declarado ao Tesouro Nacional (despesa empenhada). Inclui salários, serviços, obras e também o pagamento de juros e do principal da dívida."
                ask={{ title: `Despesa ${a?.year ?? ""} · ${b.entity}`, text: `Despesa empenhada de ${b.entity} em ${a?.year}: ${a ? brlShort(a.expenseTotal) : "?"}${pc ? `, R$ ${Math.round(pc).toLocaleString("pt-BR")} por ${perWho}` : ""}. Maior área: ${top ? `${top.name} (${pct(top.share, 0)})` : "?"}; as 3 maiores somam ${pct(top3, 0)}.`, suggestions: ["Para onde vai a maior parte da despesa?", "Esse gasto por habitante é alto?", "O que está incluso nessa despesa?"] }}
                rows={[["Por " + perWho, pc ? `R$ ${Math.round(pc).toLocaleString("pt-BR")}` : "—"], ["Maior área", top ? top.name : "—"], ["3 maiores juntas", a ? pct(top3, 0) : "—"]]}
              />
              <MiniCard
                title={`Receita ${a?.year ?? ""}`} big={a && a.revenueTotal ? brlShort(a.revenueTotal) : "—"} caption="realizada (bruta), no ano fechado"
                note={b.scope === "FEDERAL" ? "Tudo o que o governo arrecadou no ano (receita realizada, bruta). Na União, as receitas de capital incluem a emissão de títulos (operações de crédito), usada para rolar a dívida; por isso o total pode ser maior que a despesa." : b.scope === "MUNICIPAL" ? "Tudo o que o governo arrecadou no ano (receita realizada, bruta). Em muitas cidades, as transferências do estado e da União pesam mais do que os tributos próprios." : "Tudo o que o governo arrecadou no ano (receita realizada, bruta)."}
                ask={{ title: `Receita ${a?.year ?? ""} · ${b.entity}`, text: `Receita realizada de ${b.entity} em ${a?.year}: ${a ? brlShort(a.revenueTotal) : "?"}. Tributos próprios: ${tax ? pct(tax.share, 0) : "?"}; transferências: ${transfer ? pct(transfer.share, 0) : "?"}.`, suggestions: ["De onde vem a maior parte da receita?", "O que são transferências?", "Essa cidade depende de repasses?"] }}
                rows={[["Tributos próprios", tax ? pct(tax.share, 0) : "—"], ["Transferências", transfer ? pct(transfer.share, 0) : "—"], ["Por " + perWho, rc ? `R$ ${Math.round(rc).toLocaleString("pt-BR")}` : "—"]]}
              />
              <MiniCard
                title="Gasto por habitante" big={pc ? `R$ ${Math.round(pc).toLocaleString("pt-BR")}` : "—"} caption={b.scope === "FEDERAL" ? "por brasileiro, no ano" : "por morador, no ano"}
                note="Despesa empenhada dividida pela população. Serve para comparar entes de tamanhos diferentes; população do último dado disponível."
                ask={{ title: `Gasto por habitante · ${b.entity}`, text: `Despesa empenhada por ${perWho} em ${b.entity} no ano ${a?.year}: ${pc ? `R$ ${Math.round(pc).toLocaleString("pt-BR")}` : "?"} (população ${pop ? pop.toLocaleString("pt-BR") : "?"}).`, suggestions: ["Esse valor é alto ou baixo?", "Como comparar com outras cidades?", "O que entra nesse cálculo?"] }}
                rows={[["Despesa total", a ? brlShort(a.expenseTotal) : "—"], ["Receita por " + perWho, rc ? `R$ ${Math.round(rc).toLocaleString("pt-BR")}` : "—"], ["População", pop ? pop.toLocaleString("pt-BR") : "—"]]}
              />
              <MiniCard
                title={c ? `Execução ${c.year}` : "Execução do ano"} big={exec !== null ? pct(exec, 0) : "—"} caption={c ? `da dotação já empenhada (${PERIOD_LABEL[c.period]})` : "sem dados do ano corrente"}
                note="Quanto da dotação atualizada do ano corrente já foi empenhada até o último bimestre. O pace compara isso com a parte do ano que já passou: acima de 100% está acima do esperado."
                ask={{ title: `Execução ${c?.year ?? ""} · ${b.entity}`, text: `Execução do orçamento de ${b.entity} em ${c?.year} (${c ? PERIOD_LABEL[c.period] : "?"}): ${exec !== null ? pct(exec, 0) : "?"} da dotação atualizada empenhada${pace !== null ? `; pace ${pct(pace, 0)} (${pace >= 1 ? "acima" : "abaixo"} do esperado para ${elapsed !== null ? pct(elapsed, 0) : "?"} do ano` + ")" : ""}.`, suggestions: ["O gasto está no ritmo esperado?", "O que significa execução do orçamento?", "Onde ver o previsto x realizado?"] }}
                bar={exec !== null && elapsed !== null ? { fill: exec, tick: elapsed, scope: b.scope } : undefined}
                rows={[["Empenhado", c ? brlShort(c.expense.committed) : "—"], ["Dotação atualizada", c ? brlShort(c.expense.updated) : "—"], ["Pace", pace !== null ? `${pace >= 1 ? "▲" : "▼"} ${pct(pace, 0)}` : "—"]]}
                link={c ? { href: `/expectativa-fiscal?esfera=${b.scope.toLowerCase()}`, label: "Expectativa fiscal →" } : undefined}
              />
            </>
          );
        })()}
      </section>
      <p className="-mt-4 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm" role="status">
        <b>Último dado:</b> ano fechado de {a?.year ?? "—"}{c ? <>; {c.year} até {PERIOD_LABEL[c.period]}</> : ""}.{" "}
        <span className="text-muted">Coletado do Tesouro Nacional em <b className="text-ink">{brDateTime(b.fetchedAt)}</b>.</span>
      </p>

      <section aria-label="Evolução em 10 anos">
        <p className="eyebrow">Série histórica</p>
        <div className="flex items-start justify-between gap-3">
          <h2 className="display text-2xl font-semibold">Evolução nos últimos 10 anos</h2>
          <AskButton focus={{ title: `Evolução do orçamento · ${b.entity}`, text: `Gráfico de 10 anos do orçamento de ${b.entity}: despesa por função, receita por origem e despesa por tipo de gasto (Siconfi). Resumo do último ano fechado ${a?.year}:\nDespesa total ${a ? brlShort(a.expenseTotal) : "?"}; receita total ${a ? brlShort(a.revenueTotal) : "?"}.\nPrincipais despesas:\n${a ? sliceText(a.expense) : ""}\nPara a série completa e as projeções, use a tela.`, suggestions: ["Como o orçamento mudou nos últimos anos?", "Quais áreas cresceram mais?", "O que significa corrigir pela inflação?"] }} />
        </div>
        <p className="mb-4 mt-1 max-w-3xl text-sm text-muted">Compare como a receita e a despesa mudaram ao longo do tempo. Filtre o período, escolha uma categoria e veja os valores corrigidos pela inflação ou por habitante.</p>
        <Suspense fallback={<div className="skeleton h-[26rem]" aria-busy="true" />}>
          <History scope={b.scope} />
        </Suspense>
      </section>

      <section aria-label="Resultado primário">
        <p className="eyebrow">Superávit ou déficit</p>
        <div className="flex items-start justify-between gap-3">
          <h2 className="display text-2xl font-semibold">Resultado primário ano a ano</h2>
        </div>
        <p className="mb-4 mt-1 max-w-3xl text-sm text-muted">Quanto sobrou (superávit) ou faltou (déficit) entre o que o governo arrecadou e o que gastou no ano, sem contar os juros da dívida. Toque num ano para ver quais receitas e despesas explicam o resultado.</p>
        <Suspense fallback={<div className="skeleton h-[22rem]" aria-busy="true" />}>
          <Primary scope={b.scope} />
        </Suspense>
      </section>

      {a && (a.expense.length > 0 || a.revenue.length > 0) && (
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
          {/* mesmo destaque para os dois lados: de onde vem e para onde vai */}
          <section aria-label="De onde vem o dinheiro" className="min-w-0">
            <p className="eyebrow !text-municipal">Entradas</p>
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="display text-2xl font-semibold">De onde vem o dinheiro</h2>
              <span className="flex items-center gap-1.5">
                {b.scope !== "ESTADUAL" && (
                  <InfoTip label="Sobre as receitas">
                    <span className="block">{b.scope === "FEDERAL" ? "Na União, as receitas de capital incluem a emissão de títulos (operações de crédito), usada para rolar a dívida. Por isso o total pode ser maior do que o que o governo arrecada de fato em tributos." : "Em muitas cidades, as transferências do estado e da União pesam mais do que os tributos próprios."}</span>
                  </InfoTip>
                )}
                <AskButton focus={askBudget(b, "De onde vem o dinheiro", `Receita total ${brlShort(a.revenueTotal)}. Por origem:\n${sliceText(a.revenue)}`, ["Explique de onde vem o dinheiro desta cidade", "O que são transferências?", "Quanto vem de impostos próprios?"])} />
              </span>
            </div>
            <p className="mb-3 text-xs text-muted">Receita realizada em {a.year}: <b className="text-ink">{brlShort(a.revenueTotal)}</b>, por origem. Toque num cabeçalho para ordenar e em ▸ para abrir as subcategorias.</p>
            {a.revenue.length > 0 ? <BudgetShareTable items={a.revenue} scope={b.scope} view="revenue" year={a.year} population={b.scope === "FEDERAL" ? BRAZIL_POPULATION : b.population} entity={b.entity} /> : <p className="text-sm text-muted">Sem detalhamento da receita para este ano.</p>}
          </section>

          <section aria-label="Para onde vai o dinheiro" className="min-w-0">
            <p className="eyebrow !text-estadual">Saídas</p>
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="display text-2xl font-semibold">Para onde vai o dinheiro</h2>
              <span className="flex items-center gap-1.5">
                <InfoTip label="Sobre as despesas">
                  <span className="block">{b.scope === "FEDERAL" ? "“Encargos Especiais” inclui o pagamento de juros e do principal da dívida pública e transferências obrigatórias a estados e municípios; por isso costuma ser a maior linha da despesa da União. " : ""}“Pessoal” inclui salários, encargos e também aposentadorias e pensões pagas pelo regime próprio. Investimentos são obras e equipamentos; o restante é custeio do dia a dia.</span>
                </InfoTip>
                <AskButton focus={askBudget(b, "Para onde vai o dinheiro", `Despesa total ${brlShort(a.expenseTotal)}. Por função de governo (com subfunções):\n${sliceText(a.expense)}${a.nature?.length ? `\nPor tipo de gasto:\n${sliceText(a.nature)}` : ""}`, ["Para onde vai o dinheiro, em linguagem simples?", "Quanto vai para saúde e educação?", "Quanto vai para investimento?"])} />
              </span>
            </div>
            <p className="mb-3 text-xs text-muted">Despesa empenhada em {a.year}: <b className="text-ink">{brlShort(a.expenseTotal)}</b>, pela área do governo ou pelo tipo de gasto.</p>
            {a.expense.length > 0 ? <ExpenseShareTables expense={a.expense} nature={a.nature ?? []} scope={b.scope} year={a.year} population={b.scope === "FEDERAL" ? BRAZIL_POPULATION : b.population} entity={b.entity} /> : <p className="text-sm text-muted">Sem detalhamento da despesa para este ano.</p>}
          </section>
        </div>
      )}

      {c && (
        <Link href={`/expectativa-fiscal?esfera=${b.scope.toLowerCase()}`} className="card-flat flex items-center justify-between gap-4 p-4 transition-shadow hover:shadow-card sm:p-5">
          <span>
            <b className="block">{c.year}: previsto x realizado</b>
            <span className="text-sm text-muted">Veja se a arrecadação e os gastos estão seguindo a LOA, por área e subárea, em Expectativa fiscal.</span>
          </span>
          <span className="flex-none text-sm font-semibold text-brand">Abrir →</span>
        </Link>
      )}

      {!a && !c && <EmptyState title="Sem dados para esta esfera">O Tesouro Nacional ainda não tem os demonstrativos deste ente, ou a fonte não respondeu agora. Tente de novo mais tarde.</EmptyState>}
    </div>
  );
}

async function Primary({ scope }: { scope: BudgetScope }) {
  const user = await requireUser();
  const p = await getPrimaryHistory(scope, user);
  if (!p) return <EmptyState title="Resultado primário indisponível">Não encontrei os balanços anuais deste ente no Tesouro Nacional, ou a fonte não respondeu agora.</EmptyState>;
  const last = p.years.at(-1);
  const lines = p.years.map((y) => `${y.year}: ${y.result >= 0 ? "superávit" : "déficit"} de ${brlShort(Math.abs(y.result))} (receita primária ${brlShort(y.revenueTotal)}, despesa primária ${brlShort(y.expenseTotal)}, juros ${brlShort(y.interest)})`).join("\n");
  const parts = last ? `\nEm ${last.year}, receitas: ${last.revenue.map((r) => `${r.name} ${brlShort(r.value)}`).join("; ")}. Despesas: ${last.expenseNature.map((r) => `${r.name} ${brlShort(r.value)}`).join("; ")}.` : "";
  return (
    <>
      <div className="-mt-12 mb-4 flex justify-end">
        <AskButton focus={{ title: `Resultado primário · ${p.entity}`, text: `Resultado primário (receita primária menos despesa primária, sem juros da dívida) de ${p.entity}, calculado pelo Política com os balanços anuais do Tesouro (Siconfi):\n${lines}${parts}`, suggestions: ["O que é resultado primário?", "O que explica a piora ou a melhora?", "Ter déficit é sempre ruim?"] }} />
      </div>
      <PrimaryChart data={p} />
    </>
  );
}

async function History({ scope }: { scope: BudgetScope }) {
  const user = await requireUser();
  const h = await getBudgetHistory(scope, user);
  if (!h) return <EmptyState title="Série histórica indisponível">Não consegui montar os últimos anos agora. Tente novamente em alguns minutos.</EmptyState>;
  return <BudgetChart scope={h.scope} entity={h.entity} years={h.years} expense={h.expense} revenue={h.revenue} nature={h.nature} totals={h.totals} population={h.population} deflator={h.deflator} partial={h.partial} />;
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

type DbUser = Awaited<ReturnType<typeof requireUser>>;

function Skeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando orçamento">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}</div>
      <div className="skeleton h-[28rem]" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><div className="skeleton h-80" /><div className="skeleton h-80" /></div>
      <p className="text-center text-sm text-muted">Buscando os dados no Tesouro Nacional… na primeira vez pode levar alguns segundos.</p>
    </div>
  );
}

async function Content({ user, all, scope }: { user: DbUser; all: boolean; scope: BudgetScope }) {
  const results = all ? await Promise.all(SCOPES.map(async (s) => ({ scope: s, b: await getBudget(s, user) }))) : null;
  const one = !all ? await getBudget(scope, user) : null;
  const updated = (all ? results!.map((r) => r.b?.fetchedAt).filter(Boolean) : [one?.fetchedAt]).filter(Boolean) as string[];
  return (
    <>
      {all ? <Compare list={results!} /> : one ? <Detail b={one} /> : <EmptyState title="Dados indisponíveis">Não consegui buscar os demonstrativos no Tesouro Nacional agora. Tente novamente em alguns minutos.</EmptyState>}

      <div className="mt-8 max-w-3xl">
        <Notice kind="info">
          Fonte: demonstrativos que prefeituras, estados e a União enviam ao Tesouro Nacional (Siconfi). Os valores do ano fechado saem com atraso, e algumas cidades enviam fora do prazo ou incompleto.
          {updated.length > 0 && <> Dados consultados em {new Date(updated.sort()[0]).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</>}
        </Notice>
      </div>
    </>
  );
}

export default async function OrcamentoPage({ searchParams }: { searchParams: Promise<{ esfera?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const all = sp.esfera === "todas";
  const scope: BudgetScope = (SCOPE_SLUG[sp.esfera ?? "municipal"] as BudgetScope | undefined) ?? "MUNICIPAL";
  const place = all ? "Todas as esferas" : scope === "MUNICIPAL" ? user.municipality : scope === "ESTADUAL" ? UFS[user.uf] : "Brasil";

  // cabeçalho e abas aparecem na hora; os dados (lentos) carregam dentro do Suspense, que reinicia a cada esfera
  return (
    <div>
      <PageHeader eyebrow={`Números · ${place} · Tesouro Nacional (Siconfi)`} title="Orçamento" />
      <ScopeTabs base="/orcamento" scope={all ? "ALL" : scope} />
      <Suspense key={all ? "todas" : scope} fallback={<Skeleton />}>
        <Content user={user} all={all} scope={scope} />
      </Suspense>
    </div>
  );
}
