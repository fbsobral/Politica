import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { resetRobotSettings, runJobNow, saveRobotSettings } from "@/app/admin-actions";
import { ConfirmButton } from "@/components/confirm-button";
import { IconRobot } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Notice, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/user";
import { JOBS } from "@/lib/jobs";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Admin · Robô" };
export const dynamic = "force-dynamic";

const rel = (d: Date) => formatDistanceToNow(d, { addSuffix: true, locale: ptBR });

const GROUPS: { title: string; hint: string; jobs: { job: string; label: string; desc: string }[] }[] = [
  {
    title: "Notícias",
    hint: "Coleta e classificação",
    jobs: [
      { job: "ingest", label: "Coletar notícias agora", desc: "Lê feeds e buscas, deduplica e classifica." },
      { job: "reclassifyElections", label: "Reclassificar eleições", desc: "Refaz cargo e pesquisa nas notícias eleitorais." },
    ],
  },
  {
    title: "Dados políticos",
    hint: "Representantes e candidatos",
    jobs: [
      { job: "politicians", label: "Atualizar representantes", desc: "Deputados, senadores e eleitos do TSE." },
      { job: "candidates", label: "Atualizar candidatos (TSE)", desc: "Presidente, governador e senado." },
    ],
  },
  {
    title: "E-mails",
    hint: "Resumos para os usuários",
    jobs: [
      { job: "digest", label: "Resumo diário", desc: "Envia agora para quem ativou." },
      { job: "digestWeekly", label: "Resumo semanal", desc: "Envia agora para quem ativou." },
      { job: "digestMonthly", label: "Resumo mensal", desc: "Envia agora para quem ativou." },
    ],
  },
  { title: "Manutenção", hint: "Limpeza", jobs: [{ job: "cleanup", label: "Limpar notícias antigas", desc: "Respeita o tempo de histórico configurado." }] },
];

export default async function RoboPage({ searchParams }: { searchParams: Promise<{ iniciado?: string; ok?: string; erro?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [cfg, runs] = await Promise.all([getSettings(), db.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 60 })]);
  const lastBy = new Map<string, (typeof runs)[number]>();
  for (const r of runs) if (!lastBy.has(r.job)) lastBy.set(r.job, r);
  const label = "eyebrow mb-1.5 block";

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Operação" title="Robô" />
      <div className="space-y-2">
        {sp.iniciado && <Notice kind="info">“{sp.iniciado}” iniciado em segundo plano. Acompanhe em “Execuções” abaixo (atualize a página em instantes).</Notice>}
        {sp.ok && <Notice kind="ok">{sp.ok}</Notice>}
        {sp.erro && <Notice kind="erro">{sp.erro}</Notice>}
      </div>

      <section aria-label="Ações" className="space-y-4">
        <h2 className="display text-xl font-semibold">Ações</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g.title} className="card-flat p-4">
              <p className="eyebrow">{g.title}</p>
              <p className="mb-3 text-xs text-faint">{g.hint}</p>
              <ul className="space-y-3">
                {g.jobs.filter((j) => j.job in JOBS).map((j) => {
                  const last = lastBy.get(j.job);
                  return (
                    <li key={j.job} className="flex items-center gap-3">
                      <form action={runJobNow.bind(null, j.job)}>
                        <SubmitButton className="btn btn-secondary btn-sm" pendingText="Iniciando…"><IconRobot width={16} height={16} /> {j.label}</SubmitButton>
                      </form>
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="text-muted">{j.desc}</p>
                        <p className="text-faint">{last ? `${!last.finishedAt ? "⏳ rodando" : last.ok ? "✅" : "❌"} ${rel(last.startedAt)}` : "nunca executado"}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="parametros" className="scroll-mt-24" aria-label="Parâmetros">
        <h2 className="display mb-3 text-xl font-semibold">Parâmetros da coleta</h2>
        <form action={saveRobotSettings} className="card space-y-5 p-5 sm:p-6">
          <input type="hidden" name="_back" value="/admin/robo" />
          <input type="hidden" name="_group" value="geral" />
          <input type="hidden" name="__cb_googleNews" value="1" />
          <input type="hidden" name="__cb_aiClassify" value="1" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block"><span className={label}>Coletar a cada (min)</span><input name="ingestIntervalMinutes" type="number" min={10} max={1440} step={5} defaultValue={cfg.ingestIntervalMinutes} className="input" /></label>
            <label className="block"><span className={label}>Idade máx. nacionais (dias)</span><input name="maxAgeDays" type="number" min={0} max={365} defaultValue={cfg.maxAgeDays} className="input" /></label>
            <label className="block"><span className={label}>Idade máx. locais (dias)</span><input name="localMaxAgeDays" type="number" min={0} max={365} defaultValue={cfg.localMaxAgeDays} className="input" /></label>
            <label className="block"><span className={label}>Guardar histórico (dias)</span><input name="retentionDays" type="number" min={0} max={3650} defaultValue={cfg.retentionDays} className="input" /></label>
          </div>
          <label className="block max-w-md"><span className={label}>Modelo do Claude (vazio = padrão)</span><input name="aiModel" defaultValue={cfg.aiModel} placeholder="claude-haiku-5-5" className="input" /></label>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="googleNews" defaultChecked={cfg.googleNews === "1"} /> Buscar no Google News</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="aiClassify" defaultChecked={cfg.aiClassify === "1"} /> Classificar com IA (senão, só regras)</label>
          </div>
          <p className="text-xs leading-relaxed text-faint">
            <b>0 = sem limite.</b> “Idade máxima” descarta itens mais velhos ao coletar; “Guardar histórico” 0 mantém tudo para sempre (favoritas nunca são apagadas).
            O robô confere a cada 5 minutos e coleta quando o intervalo passou (mínimo 10). Em produção com o agendador do Coolify, use uma tarefa a cada 10 minutos com <code>npm run job -- ingest --scheduled</code>. Horários dos resumos por e-mail: variáveis DIGEST_CRON, WEEKLY_DIGEST_CRON e MONTHLY_DIGEST_CRON. As buscas do Google News ficam em <a className="underline" href="/admin/buscas">Buscas</a>.
          </p>
          <div className="flex flex-wrap gap-2">
            <SubmitButton className="btn btn-primary" pendingText="Salvando…">Salvar parâmetros</SubmitButton>
            <ConfirmButton formAction={resetRobotSettings} message="Restaurar os parâmetros gerais para o padrão?" className="btn btn-ghost" pendingText="Restaurando…">Restaurar padrão</ConfirmButton>
          </div>
        </form>
      </section>

      <section id="execucoes" className="scroll-mt-24" aria-label="Execuções">
        <h2 className="display mb-3 text-xl font-semibold">Execuções</h2>
        <ul className="space-y-2">
          {runs.slice(0, 30).map((r) => (
            <li key={r.id} className="card-flat flex items-start gap-3 p-3.5">
              <span className="mt-0.5 text-lg" aria-hidden>{!r.finishedAt ? "⏳" : r.ok ? "✅" : "❌"}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3"><b>{r.job}</b><span className="text-xs text-muted">{rel(r.startedAt)}</span></div>
                {r.info && <p className="mt-0.5 break-words font-mono text-xs text-muted">{r.info.length > 220 ? r.info.slice(0, 220) + "…" : r.info}</p>}
              </div>
            </li>
          ))}
          {!runs.length && <li className="text-sm text-muted">Nenhuma execução registrada ainda.</li>}
        </ul>
      </section>
    </div>
  );
}
