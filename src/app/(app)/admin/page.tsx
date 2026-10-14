import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { runJobNow } from "@/app/admin-actions";
import { IconRobot } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { Notice, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/user";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

const rel = (d: Date) => formatDistanceToNow(d, { addSuffix: true, locale: ptBR });

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const aiSince = new Date(Date.now() - 24 * 3600 * 1000);
  const [aiUsage, ai7] = await Promise.all([
    db.aiUsage.groupBy({ by: ["kind"], where: { at: { gte: aiSince } }, _sum: { inputTokens: true, outputTokens: true, cachedTokens: true }, _count: true }),
    db.aiUsage.aggregate({ where: { at: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } }, _sum: { inputTokens: true, outputTokens: true } }),
  ]);
  const pingRow = await db.setting.findUnique({ where: { key: "schedulerPing" } });
  const ping = pingRow ? new Date(pingRow.value) : null;
  const schedulerAlive = Boolean(ping && Date.now() - ping.getTime() < 20 * 60000);
  const [cfg, lastRun, lastOk, runs, articles24, byScope, users, pendingInvites, feedErrors, aiPending, unclassified, feeds, noTier] = await Promise.all([
    getSettings(),
    db.jobRun.findFirst({ where: { job: "ingest" }, orderBy: { startedAt: "desc" } }),
    db.jobRun.findFirst({ where: { job: "ingest", ok: true, finishedAt: { not: null } }, orderBy: { finishedAt: "desc" } }),
    db.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 6 }),
    db.article.count({ where: { createdAt: { gte: since }, factCheck: false } }),
    db.article.groupBy({ by: ["scope"], where: { createdAt: { gte: since }, factCheck: false }, _count: true }),
    db.user.count(),
    db.user.count({ where: { clerkId: { startsWith: "pending:" } } }),
    db.feedSource.findMany({ where: { active: true, lastError: { not: null } }, select: { name: true, lastError: true } }),
    db.source.count({ where: { tierBy: "ai" } }),
    db.article.count({ where: { classified: false } }),
    db.feedSource.count({ where: { active: true } }),
    db.source.count({ where: { tier: null } }),
  ]);

  const interval = Math.min(1440, Math.max(10, Number(cfg.ingestIntervalMinutes) || 60));
  const nextAt = lastRun ? new Date(lastRun.startedAt.getTime() + interval * 60000) : null;
  const env = [
    ["Anthropic (classificação e resumos)", Boolean(process.env.ANTHROPIC_API_KEY)],
    ["Resend (e-mails)", Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.EMAIL_FROM)],
    ["Clerk (login)", Boolean(process.env.CLERK_SECRET_KEY)],
    ["CRON_SECRET (gatilho HTTP)", Boolean(process.env.CRON_SECRET)],
  ] as const;

  const todo: { n: number; text: string; href: string; tone: "warn" | "info" }[] = [
    { n: feedErrors.length, text: `feed(s) com erro: ${feedErrors.map((f) => f.name).slice(0, 3).join(", ")}${feedErrors.length > 3 ? "…" : ""}`, href: "/admin/feeds", tone: "warn" as const },
    { n: aiPending, text: "veículo(s) com tier sugerido pela IA aguardando revisão", href: "/admin/veiculos?revisar=1", tone: "info" as const },
    { n: pendingInvites, text: "convite(s) de usuário pendente(s)", href: "/admin/usuarios", tone: "info" as const },
    { n: unclassified, text: "notícia(s) esperando classificação", href: "/admin/robo", tone: "info" as const },
  ].filter((t) => t.n > 0);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administração" title="Visão geral" />
      <div className="space-y-2">
        {sp.ok && <Notice kind="ok">{sp.ok}</Notice>}
        {sp.erro && <Notice kind="erro">{sp.erro}</Notice>}
      </div>

      {!schedulerAlive && (
        <Notice kind="erro">
          O agendador não dá sinal {ping ? `desde ${rel(ping)}` : "(nunca deu sinal)"}, então a coleta automática não está rodando. Em produção o próprio site agenda as rotinas ao subir (a menos que EMBEDDED_WORKER=0); reinicie/faça redeploy do app. Enquanto isso, use “Coletar notícias agora”.
        </Notice>
      )}

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card-flat p-4">
          <p className="eyebrow">Última coleta</p>
          <p className="display mt-1 text-xl font-semibold">{lastOk?.finishedAt ? rel(lastOk.finishedAt) : "—"}</p>
          <p className={`text-xs ${lastRun && !lastRun.ok && lastRun.finishedAt ? "text-danger" : "text-faint"}`}>{lastRun ? (!lastRun.finishedAt ? "em andamento…" : lastRun.ok ? "concluída com sucesso" : "a última tentativa falhou") : "nunca executou"}</p>
        </div>
        <div className="card-flat p-4">
          <p className="eyebrow">Próxima coleta</p>
          <p className={`display mt-1 text-xl font-semibold ${nextAt && nextAt.getTime() < Date.now() && !schedulerAlive ? "text-danger" : ""}`}>{nextAt ? (nextAt.getTime() < Date.now() ? (schedulerAlive ? "no próximo ciclo" : "atrasada") : rel(nextAt)) : "—"}</p>
          <p className="text-xs text-faint">a cada {interval} min · <Link href="/admin/robo" className="underline">alterar</Link></p>
        </div>
        <div className="card-flat p-4">
          <p className="eyebrow">Notícias (24 h)</p>
          <p className="display mt-1 text-xl font-semibold">{articles24.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-faint">{(["MUNICIPAL", "ESTADUAL", "FEDERAL"] as const).map((s) => `${s[0]}${s.slice(1).toLowerCase()}: ${byScope.find((b) => b.scope === s)?._count ?? 0}`).join(" · ")}</p>
        </div>
        <div className="card-flat p-4">
          <p className="eyebrow">Usuários</p>
          <p className="display mt-1 text-xl font-semibold">{users}</p>
          <p className="text-xs text-faint">{feeds} feeds ativos · {noTier} veículos sem tier</p>
        </div>
      </section>

      <section aria-label="Uso de IA">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="display text-xl font-semibold">Uso da IA (Claude) nas últimas 24 h</h2>
          <span className="text-xs text-faint">{Number(cfg.aiDailyTokenBudget) > 0 ? `limite diário: ${Number(cfg.aiDailyTokenBudget).toLocaleString("pt-BR")} tokens` : "sem limite diário"} · <Link href="/admin/robo#parametros" className="underline">ajustar</Link></span>
        </div>
        {(() => {
          const total = aiUsage.reduce((a, u) => a + (u._sum.inputTokens ?? 0) + (u._sum.outputTokens ?? 0), 0);
          const budget = Number(cfg.aiDailyTokenBudget) || 0;
          const LABEL: Record<string, string> = { classify: "Classificação das notícias", summary: "Resumos de matérias", explain: "Explicações da agenda", digest: "Resumos por e-mail", sources: "Categoria de veículos", tiers: "Tiers de veículos", other: "Outros" };
          const week = (ai7._sum.inputTokens ?? 0) + (ai7._sum.outputTokens ?? 0);
          return (
            <div className="card-flat p-4">
              <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <p><span className="display text-2xl font-semibold">{total.toLocaleString("pt-BR")}</span> <span className="text-sm text-muted">tokens em 24 h</span></p>
                <p className="text-sm text-muted">{week.toLocaleString("pt-BR")} em 7 dias</p>
                {budget > 0 && <p className={`text-sm font-semibold ${total >= budget ? "text-danger" : "text-muted"}`}>{Math.min(100, Math.round((total / budget) * 100))}% do limite{total >= budget ? " — IA pausada" : ""}</p>}
              </div>
              {budget > 0 && <div className="mb-3 h-1.5 rounded-full bg-line"><div className={`h-full rounded-full ${total >= budget ? "bg-danger" : "bg-brand"}`} style={{ width: `${Math.min(100, (total / budget) * 100)}%` }} /></div>}
              <ul className="divide-y divide-line text-sm">
                {aiUsage.sort((a, b) => (b._sum.inputTokens ?? 0) + (b._sum.outputTokens ?? 0) - (a._sum.inputTokens ?? 0) - (a._sum.outputTokens ?? 0)).map((u) => (
                  <li key={u.kind} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{LABEL[u.kind] ?? u.kind} <span className="text-xs text-faint">· {u._count} chamadas</span></span>
                    <span className="text-xs text-muted">entrada {(u._sum.inputTokens ?? 0).toLocaleString("pt-BR")} · saída {(u._sum.outputTokens ?? 0).toLocaleString("pt-BR")}{(u._sum.cachedTokens ?? 0) > 0 ? ` · cache ${(u._sum.cachedTokens ?? 0).toLocaleString("pt-BR")}` : ""}</span>
                  </li>
                ))}
                {!aiUsage.length && <li className="py-2 text-muted">Nenhum uso registrado ainda.</li>}
              </ul>
              <p className="mt-2 text-xs text-faint">Tokens de saída custam mais que os de entrada; tokens em cache custam uma fração.</p>
            </div>
          );
        })()}
      </section>

      <section aria-label="Pendências">
        <h2 className="display mb-3 text-xl font-semibold">Precisa de atenção</h2>
        {todo.length ? (
          <ul className="space-y-2">
            {todo.map((t) => (
              <li key={t.href + t.text}>
                <Link href={t.href} className="card-flat flex items-center gap-3 p-3.5 transition-shadow hover:shadow-card">
                  <span className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-bold ${t.tone === "warn" ? "bg-danger text-white" : "bg-gold text-ink"}`}>{t.n}</span>
                  <span className="flex-1 text-sm">{t.text}</span>
                  <span aria-hidden className="text-faint">→</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="card-flat p-4 text-sm text-muted">✓ Tudo em ordem: nenhum feed com erro, nada aguardando revisão.</p>
        )}
      </section>

      <section aria-label="Ações rápidas" className="flex flex-wrap items-center gap-2">
        <form action={runJobNow.bind(null, "ingest")}>
          <SubmitButton className="btn btn-primary" pendingText="Iniciando…"><IconRobot width={18} height={18} /> Coletar notícias agora</SubmitButton>
        </form>
        <Link href="/admin/robo" className="btn btn-secondary">Mais ações do robô</Link>
        <Link href="/admin/usuarios" className="btn btn-secondary">Cadastrar usuário</Link>
      </section>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section aria-label="Ambiente">
          <h2 className="display mb-3 text-xl font-semibold">Ambiente</h2>
          <ul className="card-flat divide-y divide-line">
            {env.map(([label, ok]) => (
              <li key={label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>{label}</span>
                <span className={ok ? "font-semibold text-ok" : "font-semibold text-danger"}>{ok ? "✓ configurado" : "✗ ausente"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Execuções recentes">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="display text-xl font-semibold">Execuções recentes</h2>
            <Link href="/admin/robo#execucoes" className="text-sm text-brand underline">ver todas</Link>
          </div>
          <ul className="card-flat divide-y divide-line">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span aria-hidden>{!r.finishedAt ? "⏳" : r.ok ? "✅" : "❌"}</span>
                <b className="flex-1">{r.job}</b>
                <span className="text-xs text-faint">{rel(r.startedAt)}</span>
              </li>
            ))}
            {!runs.length && <li className="p-4 text-sm text-muted">Nenhuma execução registrada ainda.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
