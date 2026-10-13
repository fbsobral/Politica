import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { runJobNow } from "@/app/admin-actions";
import { AdminTabs } from "@/components/admin-tabs";
import { IconRobot } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Notice, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { JOBS } from "@/lib/jobs";
import { requireAdmin } from "@/lib/user";

export const metadata = { title: "Admin · Robô" };
export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  ingest: "Coletar notícias agora",
  digest: "Enviar resumo diário",
  digestWeekly: "Enviar resumo semanal",
  digestMonthly: "Enviar resumo mensal",
  politicians: "Atualizar representantes",
  candidates: "Atualizar candidatos (TSE)",
  reclassifyElections: "Reclassificar notícias de eleição",
  cleanup: "Limpar notícias antigas",
};

export default async function RoboPage({ searchParams }: { searchParams: Promise<{ iniciado?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [runs, articles, users, pols] = await Promise.all([
    db.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 25 }),
    db.article.count(),
    db.user.count(),
    db.politician.count(),
  ]);
  const stats = [["Notícias", articles], ["Usuários", users], ["Representantes", pols]] as const;
  return (
    <div>
      <PageHeader eyebrow="Administração" title="Robô de notícias" />
      <AdminTabs active="robo" />
      {sp.iniciado && <div className="mb-5"><Notice kind="info">“{sp.iniciado}” iniciado em segundo plano. Atualize a página em instantes.</Notice></div>}

      <div className="mb-6 grid grid-cols-3 gap-3">
        {stats.map(([l, n]) => (
          <div key={l} className="card-flat p-4"><p className="eyebrow">{l}</p><p className="display mt-1 text-3xl font-semibold">{n.toLocaleString("pt-BR")}</p></div>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {Object.keys(LABEL).filter((j) => j in JOBS).map((j) => (
          <form key={j} action={runJobNow.bind(null, j)}><SubmitButton className="btn btn-secondary" pendingText="Iniciando…"><IconRobot width={18} height={18} /> {LABEL[j]}</SubmitButton></form>
        ))}
      </div>

      <h2 className="display mb-3 text-xl font-semibold">Execuções recentes</h2>
      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {runs.map((r) => (
          <li key={r.id} className="card-flat flex items-start gap-3 p-3.5">
            <span className="mt-0.5 text-lg" aria-hidden>{!r.finishedAt ? "⏳" : r.ok ? "✅" : "❌"}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3"><b>{r.job}</b><span className="text-xs text-muted">{formatDistanceToNow(r.startedAt, { addSuffix: true, locale: ptBR })}</span></div>
              {r.info && <p className="mt-0.5 break-words font-mono text-xs text-muted">{r.info.length > 220 ? r.info.slice(0, 220) + "…" : r.info}</p>}
            </div>
          </li>
        ))}
        {!runs.length && <li className="text-sm text-muted">Nenhuma execução registrada ainda.</li>}
      </ul>
    </div>
  );
}
