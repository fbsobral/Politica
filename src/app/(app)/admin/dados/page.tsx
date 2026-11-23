import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { runDataJob } from "@/app/admin-actions";
import { IconRobot } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Notice, PageHeader, StatTile } from "@/components/ui";
import { datasetHealth, indicatorHealth, type Cadence } from "@/lib/data-health";
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

/** Próximo dia 2 às 3h (horário de Brasília), quando roda a atualização mensal completa. */
function nextMonthly(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= 2 ? 1 : 0), 2);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

export default async function DadosPage({ searchParams }: { searchParams: Promise<{ iniciado?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [sets, inds, runs] = await Promise.all([datasetHealth(), indicatorHealth(), db.jobRun.findMany({ where: { job: { in: ["dataMonthly", "indicators", "budget", "marketData", "studies"] } }, orderBy: { startedAt: "desc" }, take: 40 })]);
  const lastBy = new Map<string, (typeof runs)[number]>();
  for (const r of runs) if (!lastBy.has(r.job)) lastBy.set(r.job, r);
  const monthly = lastBy.get("dataMonthly");
  const late = inds.filter((i) => i.status !== "ok");
  const sorted = [...inds].sort((a, b) => (a.status === b.status ? CADENCE_ORDER.indexOf(a.cadence) - CADENCE_ORDER.indexOf(b.cadence) || a.name.localeCompare(b.name, "pt-BR") : a.status === "ok" ? 1 : b.status === "ok" ? -1 : a.status.localeCompare(b.status)));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Operação" title="Dados" />
      {sp.iniciado && <Notice kind="info">“{sp.iniciado}” iniciado em segundo plano. Atualize a página em alguns minutos para ver o resultado.</Notice>}

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Bases em dia" value={`${sets.filter((s) => s.status === "ok").length} de ${sets.length}`} tone={sets.every((s) => s.status === "ok") ? "up" : "down"} />
        <StatTile label="Indicadores em dia" value={`${inds.length - late.length} de ${inds.length}`} tone={late.length ? "down" : "up"} hint={late.length ? `${late.length} atrasados ou sem dado` : undefined} />
        <StatTile label="Atualização completa" value={monthly ? rel(monthly.startedAt) : "nunca"} hint={monthly ? (monthly.finishedAt ? (monthly.ok ? "terminou bem" : "terminou com erro") : "rodando agora") : undefined} />
        <StatTile label="Próxima completa" value={nextMonthly()} hint="todo dia 2, às 3h" />
      </section>

      <section className="card-flat space-y-2 p-4 text-sm leading-relaxed text-muted sm:p-5">
        <p className="font-semibold text-ink">Como os dados se atualizam</p>
        <ul className="space-y-1">
          <li>• <b className="text-ink">Todo dia, 6h10:</b> inflação, juros, expectativas do Focus e Ibovespa.</li>
          <li>• <b className="text-ink">Toda segunda:</b> orçamento (5h) e indicadores dos locais dos usuários (5h30), incluindo o IPEA.</li>
          <li>• <b className="text-ink">Todo dia 2, às 3h:</b> atualização completa de todas as bases (indicadores, IPEA, orçamento, mercado, impostos e salários), mesmo as que ainda não venceram.</li>
          <li>• <b className="text-ink">Ao abrir uma página:</b> a série vencida é atualizada em segundo plano; a que falta é buscada na hora.</li>
          <li>• <b className="text-ink">Ano corrente:</b> entra como parcial (até o último mês ou trimestre publicado) e é comparado com o mesmo período do ano anterior.</li>
        </ul>
        <form action={runDataJob.bind(null, "dataMonthly")} className="pt-2">
          <SubmitButton className="btn btn-primary btn-sm" pendingText="Iniciando…"><IconRobot width={16} height={16} /> Atualizar tudo agora</SubmitButton>
        </form>
      </section>

      <section aria-label="Bases">
        <h2 className="display mb-3 text-xl font-semibold">Bases</h2>
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

      <section aria-label="Indicadores">
        <h2 className="display text-xl font-semibold">Indicadores</h2>
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
    </div>
  );
}
