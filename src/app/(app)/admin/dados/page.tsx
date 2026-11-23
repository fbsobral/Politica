import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { Suspense } from "react";
import { runDataJob, saveDataFrequencies } from "@/app/admin-actions";
import { IconRobot } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Notice, PageHeader, StatTile } from "@/components/ui";
import { datasetHealth, indicatorHealth, type Cadence } from "@/lib/data-health";
import { DATA_JOBS, FREQS, getFrequencies, nextSlot } from "@/lib/data-schedule";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/user";

export const metadata = { title: "Admin · Dados" };
export const dynamic = "force-dynamic";

const rel = (d: Date | null) => (d ? formatDistanceToNow(d, { addSuffix: true, locale: ptBR }) : "—");
const STATUS = {
  ok: { label: "✓ em dia", cls: "text-ok" },
  atrasada: { label: "▲ atrasada", cls: "text-danger" },
  atrasado: { label: "▲ atrasado", cls: "text-danger" },
  "sem-dado": { label: "— sem dado", cls: "text-faint" },
} as const;
const CADENCE_ORDER: Cadence[] = ["diária", "mensal", "trimestral", "anual", "decenal"];

export default async function DadosPage({ searchParams }: { searchParams: Promise<{ iniciado?: string; salvo?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  // só o que é rápido aqui em cima; as tabelas de situação carregam em seções separadas (Suspense)
  const [runs, freqs] = await Promise.all([db.jobRun.findMany({ where: { job: { in: ["dataMonthly", "dataScheduled", ...DATA_JOBS.map((j) => j.job)] } }, orderBy: { startedAt: "desc" }, take: 80 }).catch(() => []), getFrequencies()]);
  const next = DATA_JOBS.map((j) => nextSlot(freqs[j.job])).sort((a, b) => a.getTime() - b.getTime())[0];
  const lastBy = new Map<string, (typeof runs)[number]>();
  for (const r of runs) if (!lastBy.has(r.job)) lastBy.set(r.job, r);
  const monthly = lastBy.get("dataMonthly");

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Operação" title="Dados" />
      {sp.salvo && <Notice kind="ok">Frequências salvas. Valem a partir da próxima conferência (todo dia, às 3h).</Notice>}
      {sp.iniciado && <Notice kind="info">“{sp.iniciado === "dataMonthly" ? "Atualizar tudo" : sp.iniciado}” iniciado em segundo plano. A atualização completa leva de 10 a 30 minutos; atualize esta página depois para ver o resultado.</Notice>}

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3">
        <StatTile label="Atualização completa" value={monthly ? rel(monthly.startedAt) : "nunca"} hint={monthly ? (monthly.finishedAt ? (monthly.ok ? "terminou bem" : "terminou com erro") : "rodando agora") : undefined} />
        <StatTile label="Próxima atualização" value={next ? next.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) : "—"} hint="às 3h, pela frequência de cada grupo" />
      </section>

      <section className="card-flat space-y-2 p-4 text-sm leading-relaxed text-muted sm:p-5">
        <p className="font-semibold text-ink">Como os dados se atualizam</p>
        <ul className="space-y-1">
          <li>• <b className="text-ink">Padrão: uma vez por mês, todo dia 2, às 3h:</b> atualização de todas as bases (indicadores, IPEA, orçamento, inflação e juros, Ibovespa, impostos, salários e lucros, representantes e candidatos). A frequência de cada grupo pode ser mudada abaixo.</li>
          <li>• <b className="text-ink">Entre uma atualização e outra:</b> as páginas usam o que está guardado. Só o que ainda não existe é buscado na hora, na primeira visita.</li>
          <li>• <b className="text-ink">Ano corrente:</b> entra como parcial (até o último mês ou trimestre publicado na data da atualização) e é comparado com o mesmo período do ano anterior.</li>
          <li>• <b className="text-ink">Fora do mensal:</b> só a coleta de notícias, os resumos por e-mail e a limpeza, que não são dados estatísticos.</li>
        </ul>
        <form action={runDataJob.bind(null, "dataMonthly")} className="pt-2">
          <SubmitButton className="btn btn-primary btn-sm" pendingText="Iniciando…"><IconRobot width={16} height={16} /> Atualizar tudo agora</SubmitButton>
        </form>
      </section>

      <section aria-label="Frequência">
        <h2 className="display text-xl font-semibold">Frequência de atualização</h2>
        <p className="mb-3 mt-1 text-sm text-muted">Padrão: tudo mensal, no dia 2. O robô confere todo dia às 3h e só busca os grupos cujo prazo venceu; com tudo no mensal, nos outros dias ele não busca nada.</p>
        <form action={saveDataFrequencies} className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="px-2.5 py-2 text-left font-medium">Grupo de dados</th>
                <th className="px-2.5 py-2 text-left font-medium">Frequência</th>
                <th className="px-2.5 py-2 text-right font-medium">Próxima</th>
                <th className="px-2.5 py-2 text-right font-medium">Última</th>
              </tr>
            </thead>
            <tbody>
              {DATA_JOBS.map((j) => {
                const run = lastBy.get(j.job);
                return (
                  <tr key={j.job} className="border-t border-line">
                    <td className="px-2.5 py-2"><b className="font-medium">{j.label}</b><span className="block text-[11px] text-faint">{j.desc}</span></td>
                    <td className="px-2.5 py-2">
                      <select name={`freq_${j.job}`} defaultValue={freqs[j.job]} className="input py-1.5 text-sm" aria-label={`Frequência: ${j.label}`}>
                        {FREQS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums">{nextSlot(freqs[j.job]).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</td>
                    <td className="px-2.5 py-2 text-right text-muted">{run ? `${!run.finishedAt ? "⏳" : run.ok ? "✅" : "❌"} ${rel(run.startedAt)}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-line p-2.5"><SubmitButton className="btn btn-primary btn-sm" pendingText="Salvando…">Salvar frequências</SubmitButton></div>
        </form>
      </section>

      <Suspense fallback={<div className="skeleton h-72" aria-label="Carregando a situação das bases" />}>
        <Bases lastBy={lastBy} />
      </Suspense>
      <Suspense fallback={<div className="skeleton h-96" aria-label="Carregando a situação dos indicadores" />}>
        <Indicators />
      </Suspense>
    </div>
  );
}

type Run = { job: string; startedAt: Date; finishedAt: Date | null; ok: boolean | null };

async function Bases({ lastBy }: { lastBy: Map<string, Run> }) {
  const sets = await datasetHealth().catch((err) => (console.error("[admin:dados] bases", err), null));
  if (!sets) return <Notice kind="erro">Não consegui ler a situação das bases agora (o banco pode estar ocupado com a atualização). Tente de novo em alguns minutos.</Notice>;
  return (
      <section aria-label="Bases">
        <h2 className="display mb-3 text-xl font-semibold">Bases <span className="text-base font-normal text-muted">· {sets.filter((s) => s.status === "ok").length} de {sets.length} em dia</span></h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="px-2.5 py-2 text-left font-medium">Base</th>
                <th className="px-2.5 py-2 text-left font-medium">Fonte publica</th>
                <th className="px-2.5 py-2 text-right font-medium">Séries</th>
                <th className="px-2.5 py-2 text-right font-medium">Atualizada</th>
                <th className="px-2.5 py-2 text-right font-medium">Mais antiga</th>
                <th className="px-2.5 py-2 text-right font-medium">Situação</th>
                <th className="px-2.5 py-2 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((s) => {
                const run = lastBy.get(s.job);
                return (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-2.5 py-2">
                      <Link href={s.href} className="font-medium hover:underline">{s.name}</Link>
                      <span className="block text-[11px] text-faint">{s.source}</span>
                    </td>
                    <td className="px-2.5 py-2">{s.cadence}<span className="block text-[11px] text-faint">atualizar em até {s.maxAgeDays} dias</span></td>
                    <td className="px-2.5 py-2 text-right tabular-nums">{s.count}{s.stale > 0 && <span className="block text-[11px] text-danger">{s.stale} vencidas</span>}</td>
                    <td className="px-2.5 py-2 text-right">{rel(s.newest)}</td>
                    <td className="px-2.5 py-2 text-right text-muted">{rel(s.oldest)}</td>
                    <td className={`px-2.5 py-2 text-right text-xs font-bold ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</td>
                    <td className="px-2.5 py-2 text-right">
                      <form action={runDataJob.bind(null, s.job)}>
                        <SubmitButton className="btn btn-secondary btn-sm" pendingText="…">Atualizar</SubmitButton>
                      </form>
                      <span className="mt-0.5 block text-[10px] text-faint">{run ? `${!run.finishedAt ? "⏳" : run.ok ? "✅" : "❌"} ${rel(run.startedAt)}` : "job nunca rodou"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
  );
}

async function Indicators() {
  const inds = await indicatorHealth().catch((err) => (console.error("[admin:dados] indicadores", err), null));
  if (!inds) return <Notice kind="erro">Não consegui ler a situação dos indicadores agora. Tente de novo em alguns minutos.</Notice>;
  const late = inds.filter((i) => i.status !== "ok");
  const sorted = [...inds].sort((a, b) => (a.status === b.status ? CADENCE_ORDER.indexOf(a.cadence) - CADENCE_ORDER.indexOf(b.cadence) || a.name.localeCompare(b.name, "pt-BR") : a.status === "ok" ? 1 : b.status === "ok" ? -1 : a.status.localeCompare(b.status)));
  return (
      <section aria-label="Indicadores">
        <h2 className="display text-xl font-semibold">Indicadores <span className="text-base font-normal text-muted">· {inds.length - late.length} de {inds.length} em dia</span></h2>
        <p className="mb-3 mt-1 text-sm text-muted">Último ano guardado de cada indicador (do Brasil; ou dos estados e cidades, quando não há dado nacional). “Em dia” quando chega ao ano esperado para a frequência da fonte: mensal e trimestral já com o parcial deste ano; anual com até 2 anos de atraso, que é o normal do IBGE e do Banco Mundial; Censo, 2022.</p>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="px-2.5 py-2 text-left font-medium">Indicador</th>
                <th className="px-2.5 py-2 text-left font-medium">Frequência</th>
                <th className="px-2.5 py-2 text-right font-medium">Último dado</th>
                <th className="px-2.5 py-2 text-right font-medium">Esperado</th>
                <th className="px-2.5 py-2 text-right font-medium">Buscado</th>
                <th className="px-2.5 py-2 text-right font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((i) => (
                <tr key={i.id} className="border-t border-line">
                  <td className="max-w-0 px-2.5 py-2"><span className="block truncate font-medium" title={i.name}>{i.name}</span><span className="block truncate text-[11px] text-faint" title={i.source}>{i.source}</span></td>
                  <td className="px-2.5 py-2">{i.cadence}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums">{i.lastYear ?? "—"}{i.partial && <span className="block text-[11px] text-estadual">parcial: {i.partial}</span>}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums text-muted">{i.expected}</td>
                  <td className="px-2.5 py-2 text-right text-muted">{rel(i.fetchedAt)}</td>
                  <td className={`px-2.5 py-2 text-right text-xs font-bold ${STATUS[i.status].cls}`}>{STATUS[i.status].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
  );
}
