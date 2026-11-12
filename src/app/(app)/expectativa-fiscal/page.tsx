import { Suspense } from "react";
import { BudgetPlanChart } from "@/components/budget-plan-chart";
import { AskButton } from "@/components/agent/ask-button";
import { EmptyState, Notice, PageHeader, ScopeTabs } from "@/components/ui";
import { brlShort, pct, type BudgetScope } from "@/lib/budget";
import { brDateTime } from "@/lib/stamp";
import { getFiscal, getPrimaryPct, type PrimaryPct, loaStatus, type FiscalData } from "@/lib/fiscal";
import { SCOPE_SLUG, UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Expectativa fiscal" };
export const dynamic = "force-dynamic";

const MONTH = ["", "fevereiro", "abril", "junho", "agosto", "outubro", "dezembro"];

const signed = (d: number) => `${d >= 0 ? "+" : "−"}${pct(Math.abs(d), 1)}`;

/** Cartão de veredito: projeção do fechamento frente ao previsto na LOA. */
function Verdict({ title, scope, done, projected, loa, updated, kind, seasonal, period }: { title: string; scope: BudgetScope; done: number; projected: number; loa: number; updated: number; kind: "revenue" | "expense"; seasonal: boolean; period: number }) {
  const st = loaStatus(projected, loa);
  const d = loa > 0 ? projected / loa - 1 : 0;
  const bad = st !== null && st !== "segue" && (kind === "revenue" ? st === "abaixo" : st === "acima");
  const label = st === "segue" ? "Segue a LOA" : st === "acima" ? "Acima da LOA" : st === "abaixo" ? "Abaixo da LOA" : "Sem LOA declarada";
  const msg =
    kind === "revenue"
      ? st === "abaixo"
        ? "A arrecadação deve ficar abaixo do que a lei orçamentária previu: falta dinheiro para o que foi planejado."
        : st === "acima"
          ? "A arrecadação deve superar o previsto na lei orçamentária."
          : "A arrecadação caminha para o valor previsto na lei orçamentária."
      : st === "acima"
        ? "Os gastos devem passar do que a lei orçamentária aprovou, com créditos adicionais."
        : st === "abaixo"
          ? "Os gastos devem ficar abaixo do aprovado: parte do orçamento não deve ser executada."
          : "Os gastos caminham para o valor aprovado na lei orçamentária.";
  return (
    <section className="card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{title}</p>
        <AskButton compact focus={{
          title: `${title} · ${MONTH[period]}`,
          text: `${title} (${kind === "revenue" ? "arrecadação" : "despesa empenhada"}), realizado até ${MONTH[period]}: ${brlShort(done)}${loa > 0 ? ` (${pct(done / loa, 0)} do previsto na LOA de ${brlShort(loa)}; previsto atualizado ${brlShort(updated)})` : ""}. Pace: ${loa > 0 ? `${pct(done / loa / (period / 6), 0)} (acima de 100% = acima do esperado; esperado ${pct(period / 6, 0)} do ano)` : "sem LOA"}. Projeção para o fechamento: ${brlShort(projected)}, ${label}${st && st !== "segue" ? ` (${signed(d)})` : ""}.`,
          suggestions: ["O que este número significa?", "O pace está bom para esta época do ano?", "O que explica a diferença para a LOA?"],
        }} />
      </div>
      <p className="display mt-2 text-3xl font-semibold leading-tight">{brlShort(done)}</p>
      <p className="min-h-[2.5rem] text-sm text-faint">realizado até {MONTH[period]}{loa > 0 ? ` · ${pct(done / loa, 0)} do previsto na LOA` : ""}</p>
      {loa > 0 && (() => {
        const elapsed = period / 6;
        const ritmo = done / loa / elapsed;
        const above = ritmo >= 1;
        const good = kind === "revenue" ? above : null;
        return (
          <div className="min-h-[3.25rem]">
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-xs" title="Ritmo = percentual do previsto já realizado dividido pelo percentual do ano que já passou">
            <span className="text-muted">Ritmo</span>
            <b className={`tabular-nums ${good === null ? "text-gold" : good ? "text-ok" : "text-danger"}`}>{above ? "▲" : "▼"} {pct(ritmo, 0)}</b>
            <span className="text-muted">{above ? "acima" : "abaixo"} do esperado ({pct(elapsed, 0)} do ano)</span>
          </p>
          <div className="relative mt-2 h-3.5" role="img" aria-label={`Realizado: ${pct(done / loa, 0)} do previsto; esperado até ${MONTH[period]}: ${pct(elapsed, 0)}`}>
            <div className="absolute inset-0 rounded-full bg-ink/10" />
            <div className="absolute left-0 top-[3px] h-2 rounded-full" style={{ width: `${Math.min(100, (done / loa) * 100)}%`, background: `var(--${scope.toLowerCase()})` }} />
            <div className="absolute -top-0.5 h-[18px] w-0.5 bg-ink" style={{ left: `calc(${Math.min(100, elapsed * 100)}% - 1px)` }} />
          </div>
          </div>
        );
      })()}
      <dl className="mt-3 grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-2 border-t border-line pt-3 text-sm">
        <dt className="text-muted">Projeção do ano</dt>
        <dd className="whitespace-nowrap text-right font-semibold tabular-nums">{brlShort(projected)}</dd>
        <dt className="text-muted">Frente à LOA</dt>
        <dd className={`whitespace-nowrap text-right font-bold ${st === "segue" ? "text-ok" : bad ? "text-danger" : "text-muted"}`}>{st === "segue" ? "✓" : st === "acima" ? "▲" : st === "abaixo" ? "▼" : "•"} {label}{st && st !== "segue" ? ` (${signed(d)})` : ""}</dd>
        <dt className="text-muted">Previsto na LOA</dt><dd className="whitespace-nowrap text-right font-semibold tabular-nums">{brlShort(loa)}</dd>
        <dt className="text-muted">Atualizado</dt><dd className="whitespace-nowrap text-right tabular-nums">{brlShort(updated)}{loa > 0 && updated !== loa ? <span className="text-faint"> ({signed(updated / loa - 1)})</span> : null}</dd>
      </dl>
      <p className="mt-auto pt-3 text-xs leading-relaxed text-muted">{msg} <span className="text-faint">Projeção {period < 6 ? (seasonal ? "pela sazonalidade do ano passado" : "proporcional a 12 meses") : "do ano fechado"}.</span></p>
    </section>
  );
}

/** Categorias que mais se afastam da LOA na projeção (para o resumo). */
function Detail({ f, pibPct }: { f: FiscalData; pibPct: PrimaryPct | null }) {
  const t = f.totals;
  const pr = f.projection["total:revenue"] ?? { value: t.revenue.done, seasonal: false };
  const pe = f.projection["total:expense"] ?? { value: t.expense.done, seasonal: false };
  const loaBalance = t.revenue.initial - t.expense.initial;
  const projBalance = pr.value - pe.value;
  const doneBalance = t.revenue.done - t.expense.done;
  const prim = f.primary;
  return (
    <div className="space-y-8">
      <p className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm" role="status">
        <b>Último dado de {f.year}:</b> até {MONTH[f.period]} (RREO do {f.period}º bimestre{f.period === 6 ? ", ano fechado" : ""}).{" "}
        <span className="text-muted">Dados coletados do Tesouro Nacional em <b className="text-ink">{brDateTime(f.fetchedAt)}</b> e renovados a cada 24 horas.</span>
      </p>
      <p className="max-w-3xl text-sm text-muted">
        A lei orçamentária (LOA) fixa quanto se espera arrecadar e quanto se pode gastar no ano. Aqui comparamos o que já foi realizado até {MONTH[f.period]} de {f.year} com essas metas e projetamos onde o ano deve fechar.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Verdict title="Receita" scope={f.scope} done={t.revenue.done} projected={pr.value} loa={t.revenue.initial} updated={t.revenue.updated} kind="revenue" seasonal={pr.seasonal} period={f.period} />
        <Verdict title="Despesa (empenhada)" scope={f.scope} done={t.expense.done} projected={pe.value} loa={t.expense.initial} updated={t.expense.updated} kind="expense" seasonal={pe.seasonal} period={f.period} />
        <section className="card flex h-full flex-col p-5">
          <div className="flex items-start justify-between gap-2">
            <p className="eyebrow">Saldo do orçamento</p>
            <AskButton compact focus={{
              title: "Saldo do orçamento",
              text: `Saldo do orçamento (${f.entity}), realizado até ${MONTH[f.period]} de ${f.year}: ${brlShort(doneBalance)} (receita realizada menos despesa empenhada). Projeção para o fechamento: ${brlShort(projBalance)}. Saldo na LOA: ${brlShort(loaBalance)}. ${f.scope === "FEDERAL" ? "Na União a receita inclui a emissão de títulos para rolar a dívida; o saldo do orçamento é diferente do resultado primário." : ""}`,
              suggestions: ["O que é o saldo do orçamento?", "Por que o saldo está negativo?", "Qual a diferença entre saldo e resultado primário?"],
            }} />
          </div>
          <p className="display mt-2 text-3xl font-semibold leading-tight">{brlShort(doneBalance)}</p>
          <p className="min-h-[2.5rem] text-sm text-faint">receita realizada menos despesa empenhada, até {MONTH[f.period]}</p>
          <div className="hidden min-h-[3.25rem] xl:block" aria-hidden />

          <dl className="mt-3 grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-2 border-t border-line pt-3 text-sm">
            <dt className="text-muted">Projeção do ano</dt>
            <dd className="whitespace-nowrap text-right font-semibold tabular-nums">{brlShort(projBalance)}</dd>
            <dt className="text-muted">Situação</dt>
            <dd className={`whitespace-nowrap text-right font-bold ${projBalance >= 0 ? "text-ok" : "text-danger"}`}>{projBalance >= 0 ? "▲ Sobra prevista" : "▼ Falta prevista"}</dd>
            <dt className="text-muted">Saldo na LOA</dt><dd className="whitespace-nowrap text-right font-semibold tabular-nums">{brlShort(loaBalance)}</dd>
            <dt className="text-muted">Saldo atualizado</dt><dd className="whitespace-nowrap text-right tabular-nums">{brlShort(t.revenue.updated - t.expense.updated)}</dd>
          </dl>
          <p className="mt-auto pt-3 text-xs leading-relaxed text-faint">A projeção é a receita projetada menos a despesa projetada. {f.scope === "FEDERAL" ? "Na União a receita inclui a emissão de títulos para rolar a dívida, por isso o saldo do orçamento é diferente do resultado primário." : ""}</p>
        </section>
        <section className="card flex h-full flex-col p-5" aria-label="Resultado primário">
          <div className="flex items-start justify-between gap-2">
            <p className="eyebrow">Resultado primário</p>
            <AskButton compact focus={{
              title: "Resultado primário",
              text: `Resultado primário (${f.entity}) até ${MONTH[f.period]} de ${f.year}: ${prim?.realized != null ? brlShort(prim.realized) : "ainda não publicado"} (receitas primárias menos despesas primárias, sem juros; RREO Anexo 06). Meta da LDO para o ano: ${prim?.meta != null ? brlShort(prim.meta) : "não declarada"}. ${pibPct ? `Em % do PIB, acumulado em 12 meses até ${pibPct.month}: ${pibPct.pct > 0 ? "déficit de " : "superávit de "}${Math.abs(pibPct.pct).toLocaleString("pt-BR")}% (Banco Central, SGS ${pibPct.code}, ${pibPct.perimeter}).` : ""}`,
              suggestions: ["O que é resultado primário?", "Por que ele não inclui os juros?", "Isso está dentro da meta?"],
            }} />
          </div>
          {prim?.realized != null ? (
            <>
              <p className="display mt-2 text-3xl font-semibold leading-tight">{brlShort(prim.realized)}</p>
              <p className="min-h-[2.5rem] text-sm text-faint">receitas menos despesas primárias (sem juros), até {MONTH[f.period]}</p>
              <div className="hidden min-h-[3.25rem] xl:block" aria-hidden />

              <dl className="mt-3 grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-2 border-t border-line pt-3 text-sm">
                <dt className="text-muted" title="A meta vale para o ano inteiro">Meta da LDO</dt>
                <dd className="whitespace-nowrap text-right font-semibold tabular-nums">{prim.meta != null ? brlShort(prim.meta) : "não declarada"}</dd>
                <dt className="text-muted">Situação</dt>
                <dd className={`whitespace-nowrap text-right font-bold ${prim.meta != null ? (prim.realized >= prim.meta ? "text-ok" : "text-danger") : prim.realized >= 0 ? "text-ok" : "text-danger"}`}>
                  {prim.meta != null ? (prim.realized >= prim.meta ? "▲ Acima da meta" : "▼ Abaixo da meta") : prim.realized >= 0 ? "▲ Superávit primário" : "▼ Déficit primário"}
                </dd>
                <dt className="text-muted" title={pibPct ? `Banco Central, SGS ${pibPct.code} (${pibPct.perimeter}), acumulado em 12 meses até ${pibPct.month}` : undefined}>{f.scope === "FEDERAL" ? "% do PIB (12 meses)" : "% do PIB (todos os entes)"}</dt>
                <dd className="whitespace-nowrap text-right font-semibold tabular-nums">{pibPct ? `${pibPct.pct > 0 ? "déficit de " : pibPct.pct < 0 ? "superávit de " : ""}${Math.abs(pibPct.pct).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "indisponível"}</dd>
                <dt className="text-muted">Vs. meta</dt><dd className="whitespace-nowrap text-right tabular-nums">{prim.meta != null ? brlShort(prim.realized - prim.meta) : "—"}</dd>
              </dl>
              <p className="mt-auto pt-3 text-xs leading-relaxed text-muted">Superávit é o que sobra antes de pagar os juros da dívida; déficit é o que falta. Valor: RREO, Anexo 06 (Tesouro Nacional/Siconfi). {pibPct ? `% do PIB: Banco Central, SGS ${pibPct.code} (${pibPct.perimeter}), acumulado em 12 meses${f.scope === "FEDERAL" ? "" : "; o BC não publica o percentual por estado ou município"}.` : ""}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">O resultado primário ainda não foi publicado no RREO deste período para {f.scope === "FEDERAL" ? "a União" : f.scope === "ESTADUAL" ? "o estado" : "o município"}.</p>
          )}
        </section>
      </div>

      {(f.plan.expense.length > 0 || f.plan.revenue.length > 0 || f.plan.nature.length > 0) && (
        <section aria-label="Por categoria">
          <p className="eyebrow">Por categoria e subcategoria</p>
          <h2 className="display text-2xl font-semibold">Cada área frente à LOA</h2>
          <p className="mb-4 mt-1 max-w-3xl text-sm text-muted">Receitas à esquerda e despesas à direita. Barra clara: previsto. Barra cheia: realizado até agora. Círculo: onde o ano deve fechar. Toque numa área para ver as subáreas.</p>
          <BudgetPlanChart scope={f.scope} year={f.year} period={f.period} plan={f.plan} projection={f.projection} />
        </section>
      )}

      {!f.hasHistory && f.period < 6 && <Notice kind="info">Não encontrei os relatórios do ano anterior para medir a sazonalidade; a projeção usa a média proporcional a 12 meses e é menos precisa.</Notice>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-64" />)}</div>
      <div className="skeleton h-40" />
      <div className="skeleton h-[28rem]" />
      <p className="text-center text-sm text-muted">Buscando os relatórios bimestrais no Tesouro Nacional… na primeira vez pode levar alguns segundos.</p>
    </div>
  );
}

async function Content({ scope }: { scope: BudgetScope }) {
  const user = await requireUser();
  const [f, pibPct] = await Promise.all([getFiscal(scope, user), getPrimaryPct(scope)]);
  return (
    <>
      {f ? <Detail f={f} pibPct={pibPct} /> : <EmptyState title="Dados indisponíveis">Não encontrei o relatório bimestral (RREO) deste ente no Tesouro Nacional, ou a fonte não respondeu agora. Tente novamente em alguns minutos.</EmptyState>}
      <div className="mt-8 max-w-3xl">
        <Notice kind="info">
          Fonte: Relatório Resumido da Execução Orçamentária (RREO), que prefeituras, estados e a União enviam a cada dois meses ao Tesouro Nacional (Siconfi): Anexo 1 (receitas e despesas), Anexo 2 (despesa por função) e Anexo 6 (metas fiscais da LDO).
          {f && <> Dados consultados em {new Date(f.fetchedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</>}
        </Notice>
      </div>
    </>
  );
}

export default async function ExpectativaFiscalPage({ searchParams }: { searchParams: Promise<{ esfera?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope: BudgetScope = (SCOPE_SLUG[sp.esfera ?? "municipal"] as BudgetScope | undefined) ?? "MUNICIPAL";
  const place = scope === "MUNICIPAL" ? user.municipality : scope === "ESTADUAL" ? UFS[user.uf] : "Brasil";
  return (
    <div>
      <PageHeader eyebrow={`Números · ${place} · previsto x realizado (RREO)`} title="Expectativa fiscal" />
      <ScopeTabs base="/expectativa-fiscal" scope={scope} noAll />
      <Suspense key={scope} fallback={<Skeleton />}>
        <Content scope={scope} />
      </Suspense>
    </div>
  );
}
