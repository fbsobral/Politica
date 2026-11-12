import { Fragment, Suspense } from "react";
import { BudgetPlanChart } from "@/components/budget-plan-chart";
import { AskButton } from "@/components/agent/ask-button";
import { FiscalLineChart } from "@/components/fiscal-line-chart";
import { InfoTip } from "@/components/info-tip";
import { EmptyState, Notice, PageHeader, ScopeTabs } from "@/components/ui";
import { brlShort, pct, type BudgetScope } from "@/lib/budget";
import { pib12Label, pibYtdLabel, PIB_RULES } from "@/lib/pib-pct";
import { brDateTime } from "@/lib/stamp";
import { getFiscal, getFiscalSeries, getPrimaryPct, getPrimaryYtd, type PrimaryYtd, type PrimaryPct, loaStatus, type FiscalData } from "@/lib/fiscal";
import { SCOPE_SLUG, UFS } from "@/lib/taxonomy";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Expectativa fiscal" };
export const dynamic = "force-dynamic";

const MONTH = ["", "fevereiro", "abril", "junho", "agosto", "outubro", "dezembro"];
const MONTH_NAME = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

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
  const elapsed = period / 6;
  const ritmo = loa > 0 ? done / loa / elapsed : null;
  const above = ritmo !== null && ritmo >= 1;
  const good = kind === "revenue" ? above : null;
  return (
    <section className="card flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{title}</p>
        <span className="flex items-center gap-1.5">
          <InfoTip label={`Sobre ${title}`}>
            <span className="block">{msg}</span>
            <span className="mt-1.5 block text-muted">A projeção do fechamento é feita {period < 6 ? (seasonal ? "pela sazonalidade do ano passado" : "proporcionalmente a 12 meses") : "com o ano fechado"}.</span>
            <span className="mt-1.5 block text-muted"><b className="text-ink">Ritmo</b> = percentual do previsto já realizado ÷ parte do ano que já passou ({pct(elapsed, 0)}). Acima de 100% está acima do esperado.</span>
          </InfoTip>
          <AskButton compact focus={{
            title: `${title} · ${MONTH[period]}`,
            text: `${title} (${kind === "revenue" ? "arrecadação" : "despesa empenhada"}), realizado até ${MONTH[period]}: ${brlShort(done)}${loa > 0 ? ` (${pct(done / loa, 0)} do previsto na LOA de ${brlShort(loa)}; previsto atualizado ${brlShort(updated)})` : ""}. Pace: ${loa > 0 ? `${pct(done / loa / (period / 6), 0)} (acima de 100% = acima do esperado; esperado ${pct(period / 6, 0)} do ano)` : "sem LOA"}. Projeção para o fechamento: ${brlShort(projected)}, ${label}${st && st !== "segue" ? ` (${signed(d)})` : ""}.`,
            suggestions: ["O que este número significa?", "O pace está bom para esta época do ano?", "O que explica a diferença para a LOA?"],
          }} />
        </span>
      </div>
      <p className="display mt-1.5 text-2xl font-semibold leading-tight">{brlShort(done)}</p>
      <p className="min-h-[2rem] text-[11px] leading-snug text-faint">realizado até {MONTH[period]}{loa > 0 ? ` · ${pct(done / loa, 0)} do previsto na LOA` : ""}</p>
      <div className="min-h-[2.75rem]">
        {ritmo !== null && loa > 0 && (
          <>
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-[11px]" title="Ritmo = percentual do previsto já realizado dividido pelo percentual do ano que já passou">
              <span className="text-muted">Ritmo</span>
              <b className={`tabular-nums ${good === null ? "text-gold" : good ? "text-ok" : "text-danger"}`}>{above ? "▲" : "▼"} {pct(ritmo, 0)}</b>
              <span className="text-faint">· esperado {pct(elapsed, 0)}</span>
            </p>
            <div className="relative mt-1.5 h-3" role="img" aria-label={`Realizado: ${pct(done / loa, 0)} do previsto; esperado até ${MONTH[period]}: ${pct(elapsed, 0)}`}>
              <div className="absolute inset-0 rounded-full bg-ink/10" />
              <div className="absolute left-0 top-[2px] h-2 rounded-full" style={{ width: `${Math.min(100, (done / loa) * 100)}%`, background: `var(--${scope.toLowerCase()})` }} />
              <div className="absolute -top-0.5 h-4 w-0.5 bg-ink" style={{ left: `calc(${Math.min(100, elapsed * 100)}% - 1px)` }} />
            </div>
          </>
        )}
      </div>
      <dl className="mt-auto grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1.5 border-t border-line pt-2.5 text-xs">
        <dt className="whitespace-nowrap text-muted">Projeção</dt>
        <dd className="whitespace-nowrap text-right font-semibold tabular-nums">{brlShort(projected)}</dd>
        <dt className="whitespace-nowrap text-muted">vs LOA</dt>
        <dd className={`whitespace-nowrap text-right font-bold ${st === "segue" ? "text-ok" : bad ? "text-danger" : "text-muted"}`}>
          {st === "segue" ? "✓ segue" : st === "acima" ? `▲ acima (${signed(d)})` : st === "abaixo" ? `▼ abaixo (${signed(d)})` : "•"}
        </dd>
        <dt className="whitespace-nowrap text-muted">Na LOA</dt><dd className="whitespace-nowrap text-right font-semibold tabular-nums">{brlShort(loa)}</dd>
        <dt className="whitespace-nowrap text-muted">Atualizado</dt>
        <dd className="whitespace-nowrap text-right tabular-nums">{brlShort(updated)}{loa > 0 && updated !== loa ? <span className="text-faint"> ({signed(updated / loa - 1)})</span> : null}</dd>
      </dl>
    </section>
  );
}

/** Categorias que mais se afastam da LOA na projeção (para o resumo). */
function Detail({ f, pibPct, ytd }: { f: FiscalData; pibPct: PrimaryPct | null; ytd: PrimaryYtd | null }) {
  const t = f.totals;
  const pr = f.projection["total:revenue"] ?? { value: t.revenue.done, seasonal: false };
  const pe = f.projection["total:expense"] ?? { value: t.expense.done, seasonal: false };
  const loaBalance = t.revenue.initial - t.expense.initial;
  const projBalance = pr.value - pe.value;
  const doneBalance = t.revenue.done - t.expense.done;
  const prim = f.primary;
  // União: o número principal é o do Banco Central (soma mensal, SGS 4639, + = déficit); o RREO fica como linha de apoio
  const bcMain = f.scope === "FEDERAL" && ytd ? -ytd.flow : null;
  const mainVal = bcMain ?? prim?.realized ?? null;
  return (
    <div className="space-y-8">
      <p className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm" role="status">
        <b>Último dado de {f.year}:</b> até {MONTH[f.period]} (RREO do {f.period}º bimestre{f.period === 6 ? ", ano fechado" : ""}).{" "}
        {f.period < 6 && <span className="text-muted">Faltam {MONTH_NAME[f.period * 2 + 1]} e {MONTH_NAME[f.period * 2 + 2]}: o {f.period + 1}º bimestre ainda não foi publicado (o prazo legal é de até 30 dias depois que ele fecha). Nos indicadores do Banco Central já há dados mais recentes, como o % do PIB em 12 meses. </span>}
        <span className="text-muted">Dados coletados do Tesouro Nacional em <b className="text-ink">{brDateTime(f.fetchedAt)}</b> e renovados a cada 24 horas.</span>
      </p>
      <p className="max-w-3xl text-sm text-muted">
        A lei orçamentária (LOA) fixa quanto se espera arrecadar e quanto se pode gastar no ano. Aqui comparamos o que já foi realizado até {MONTH[f.period]} de {f.year} com essas metas e projetamos onde o ano deve fechar.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Verdict title="Receita" scope={f.scope} done={t.revenue.done} projected={pr.value} loa={t.revenue.initial} updated={t.revenue.updated} kind="revenue" seasonal={pr.seasonal} period={f.period} />
        <Verdict title="Despesa (empenhada)" scope={f.scope} done={t.expense.done} projected={pe.value} loa={t.expense.initial} updated={t.expense.updated} kind="expense" seasonal={pe.seasonal} period={f.period} />
        <section className="card flex h-full flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="eyebrow">Saldo do orçamento</p>
            <span className="flex items-center gap-1.5">
              <InfoTip label="Sobre o saldo do orçamento">
                <span className="block">Receita realizada menos despesa empenhada até {MONTH[f.period]}. A projeção é a receita projetada menos a despesa projetada.</span>
                {f.scope === "FEDERAL" && <span className="mt-1.5 block text-muted">Na União a receita inclui a emissão de títulos para rolar a dívida; por isso o saldo do orçamento é diferente do resultado primário.</span>}
              </InfoTip>
              <AskButton compact focus={{
              title: "Saldo do orçamento",
              text: `Saldo do orçamento (${f.entity}), realizado até ${MONTH[f.period]} de ${f.year}: ${brlShort(doneBalance)} (receita realizada menos despesa empenhada). Projeção para o fechamento: ${brlShort(projBalance)}. Saldo na LOA: ${brlShort(loaBalance)}. ${f.scope === "FEDERAL" ? "Na União a receita inclui a emissão de títulos para rolar a dívida; o saldo do orçamento é diferente do resultado primário." : ""}`,
              suggestions: ["O que é o saldo do orçamento?", "Por que o saldo está negativo?", "Qual a diferença entre saldo e resultado primário?"],
            }} />
            </span>
          </div>
          <p className="display mt-1.5 text-2xl font-semibold leading-tight">{brlShort(doneBalance)}</p>
          <p className="min-h-[2rem] text-[11px] leading-snug text-faint">receita menos despesa empenhada, até {MONTH[f.period]}</p>
          <div className="hidden min-h-[2.75rem] xl:block" aria-hidden />
          <dl className="mt-auto grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1.5 border-t border-line pt-2.5 text-xs">
            <dt className="whitespace-nowrap text-muted">Projeção</dt>
            <dd className="whitespace-nowrap text-right font-semibold tabular-nums">{brlShort(projBalance)}</dd>
            <dt className="whitespace-nowrap text-muted">Situação</dt>
            <dd className={`whitespace-nowrap text-right font-bold ${projBalance >= 0 ? "text-ok" : "text-danger"}`}>{projBalance >= 0 ? "▲ sobra" : "▼ falta"}</dd>
            <dt className="whitespace-nowrap text-muted">Na LOA</dt><dd className="whitespace-nowrap text-right font-semibold tabular-nums">{brlShort(loaBalance)}</dd>
            <dt className="whitespace-nowrap text-muted">Atualizado</dt><dd className="whitespace-nowrap text-right tabular-nums">{brlShort(t.revenue.updated - t.expense.updated)}</dd>
          </dl>
        </section>
        <section className="card flex h-full flex-col p-4" aria-label="Resultado primário">
          <div className="flex items-start justify-between gap-2">
            <p className="eyebrow">Resultado primário</p>
            <span className="flex items-center gap-1.5">
              <InfoTip label="Sobre o resultado primário">
                <span className="block">Receitas menos despesas, sem contar os juros da dívida. Superávit é o que sobra antes de pagar os juros; déficit é o que falta.</span>
                <span className="mt-1.5 block text-muted">{f.scope === "FEDERAL" ? "Valor em R$ (União): Banco Central, SGS 4639, de janeiro até o último mês publicado." : "Valor em R$: RREO, Anexo 06 (Tesouro Nacional/Siconfi), de janeiro até o último bimestre publicado."} A meta da LDO vale para o ano inteiro; comparar com o parcial é só uma referência.</span>
                {f.scope === "FEDERAL" && <span className="mt-1.5 block text-muted"><b className="text-ink">Como ler os percentuais do PIB.</b> Todos vêm do Banco Central (BC), que reporta assim o resultado do Governo Federal e Banco Central. {PIB_RULES.ytd} {PIB_RULES.m12} O valor em R$ em destaque também é do BC (soma dos resultados mensais, SGS 4639).</span>}
                {pibPct && <span className="mt-1.5 block text-muted">% do PIB: Banco Central, SGS {pibPct.code} ({pibPct.perimeter}), acumulado em 12 meses até {pibPct.month}.{f.scope === "FEDERAL" ? "" : " O Banco Central não publica o percentual por estado ou município."}</span>}
              </InfoTip>
              <AskButton compact focus={{
              title: "Resultado primário",
              text: `Resultado primário (${f.entity}) até ${MONTH[f.period]} de ${f.year}: ${prim?.realized != null ? brlShort(prim.realized) : "ainda não publicado"} (receitas primárias menos despesas primárias, sem juros; RREO Anexo 06). Meta da LDO para o ano: ${prim?.meta != null ? brlShort(prim.meta) : "não declarada"}. ${pibPct ? `Em % do PIB, acumulado em 12 meses até ${pibPct.month}: ${pibPct.pct > 0 ? "déficit de " : "superávit de "}${Math.abs(pibPct.pct).toLocaleString("pt-BR")}% (Banco Central, SGS ${pibPct.code}, ${pibPct.perimeter}).` : ""}`,
              suggestions: ["O que é resultado primário?", "Por que ele não inclui os juros?", "Isso está dentro da meta?"],
            }} />
            </span>
          </div>
          {mainVal != null && prim ? (
            <>
              <p className="display mt-1.5 text-2xl font-semibold leading-tight">{brlShort(mainVal)}</p>
              <p className="min-h-[2rem] text-[11px] leading-snug text-faint">{bcMain != null && ytd ? `receitas menos despesas primárias, de janeiro a ${MONTH_NAME[ytd.month]} · Banco Central` : `receitas menos despesas primárias, de janeiro a ${MONTH[f.period]} · RREO (Tesouro)`}</p>
              <div className="hidden min-h-[2.75rem] xl:block" aria-hidden />
              <dl className="mt-auto grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1.5 border-t border-line pt-2.5 text-xs">
                {f.scope === "FEDERAL" ? (
                  <>
                    <dt className="whitespace-nowrap text-muted">Situação</dt>
                    <dd className={`whitespace-nowrap text-right font-bold ${mainVal >= 0 ? "text-ok" : "text-danger"}`}>{mainVal >= 0 ? "▲ superávit" : "▼ déficit"}</dd>
                    {[ytd].map((v, i) => v && (
                      <Fragment key={`ytd${i}`}>
                        <dt className="whitespace-nowrap text-muted" title={`Banco Central: soma do resultado mensal de janeiro a ${MONTH_NAME[v.month]} (SGS ${v.code}, ${v.perimeter}) ÷ PIB dos mesmos meses`}>{pibYtdLabel(v.month)} <span className="text-faint">BC</span></dt>
                        <dd className="whitespace-nowrap text-right font-semibold tabular-nums">{`${v.pct > 0 ? "déficit " : "superávit "}${Math.abs(v.pct).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}</dd>
                      </Fragment>
                    ))}
                    <dt className="whitespace-nowrap text-muted" title={pibPct ? `Banco Central, SGS ${pibPct.code} (${pibPct.perimeter}), acumulado em 12 meses até ${pibPct.month}` : undefined}>{pibPct ? pib12Label(Number(pibPct.month.slice(0, 2))) : "% PIB 12 meses"} <span className="text-faint">BC</span></dt>
                    <dd className="whitespace-nowrap text-right font-semibold tabular-nums">{pibPct ? `${pibPct.pct > 0 ? "déficit " : pibPct.pct < 0 ? "superávit " : ""}${Math.abs(pibPct.pct).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "—"}</dd>
                  </>
                ) : (
                  <>
                    <dt className="whitespace-nowrap text-muted" title="A meta vale para o ano inteiro">Meta LDO</dt>
                    <dd className="whitespace-nowrap text-right font-semibold tabular-nums">{prim.meta != null ? brlShort(prim.meta) : "não declarada"}</dd>
                    <dt className="whitespace-nowrap text-muted">Situação</dt>
                    <dd className={`whitespace-nowrap text-right font-bold ${prim.meta != null ? (mainVal >= prim.meta ? "text-ok" : "text-danger") : mainVal >= 0 ? "text-ok" : "text-danger"}`}>
                      {prim.meta != null ? (mainVal >= prim.meta ? "▲ acima da meta" : "▼ abaixo da meta") : mainVal >= 0 ? "▲ superávit" : "▼ déficit"}
                    </dd>
                    <dt className="whitespace-nowrap text-muted" title={pibPct ? `Banco Central, SGS ${pibPct.code} (${pibPct.perimeter}), acumulado em 12 meses até ${pibPct.month}` : undefined}>% PIB (todos)</dt>
                    <dd className="whitespace-nowrap text-right font-semibold tabular-nums">{pibPct ? `${pibPct.pct > 0 ? "déficit " : pibPct.pct < 0 ? "superávit " : ""}${Math.abs(pibPct.pct).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "—"}</dd>
                    <dt className="whitespace-nowrap text-muted">Vs. meta</dt><dd className="whitespace-nowrap text-right tabular-nums">{prim.meta != null ? brlShort(mainVal - prim.meta) : "—"}</dd>
                  </>
                )}
              </dl>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">O resultado primário ainda não foi publicado no RREO deste período para {f.scope === "FEDERAL" ? "a União" : f.scope === "ESTADUAL" ? "o estado" : "o município"}.</p>
          )}
        </section>
      </div>

      <Suspense fallback={<div className="skeleton h-[28rem]" aria-busy="true" />}>
        <SeriesSection scope={f.scope} />
      </Suspense>

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

async function SeriesSection({ scope }: { scope: BudgetScope }) {
  const user = await requireUser();
  const sr = await getFiscalSeries(scope, user);
  if (!sr || !sr.annual.length) return null;
  return (
    <section aria-label="Evolução ao longo dos anos" className="card p-4 sm:p-5">
      <p className="eyebrow">Evolução</p>
      <h2 className="display text-2xl font-semibold">Receita, despesa, saldo e resultado primário</h2>
      <p className="mb-4 mt-1 text-sm text-muted">As mesmas quatro caixas de cima ao longo do tempo. Escolha o período e ligue ou desligue cada linha.</p>
      <FiscalLineChart annual={sr.annual} bimesters={sr.bimesters} currentYear={sr.currentYear} currentPeriod={sr.currentPeriod} firstYear={sr.firstYear} entity={sr.entity} pibSource={sr.pibSource} />
    </section>
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
  // % do PIB no ano (mesmo período do valor em R$): só faz sentido para a União, comparada com o PIB do país
  const ytd = f && scope === "FEDERAL" ? await getPrimaryYtd(f.year) : null;
  return (
    <>
      {f ? <Detail f={f} pibPct={pibPct} ytd={ytd} /> : <EmptyState title="Dados indisponíveis">Não encontrei o relatório bimestral (RREO) deste ente no Tesouro Nacional, ou a fonte não respondeu agora. Tente novamente em alguns minutos.</EmptyState>}
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
