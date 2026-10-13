import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { addFeed, deleteFeed, resetRobotSettings, saveRobotSettings, toggleFeed } from "@/app/admin-actions";
import { AdminTabs } from "@/components/admin-tabs";
import { Notice, PageHeader, SourceAvatar } from "@/components/ui";
import { db } from "@/lib/db";
import { getSettings, type Settings } from "@/lib/settings";
import { BRANCH_LABEL, SCOPE_LABEL, SOURCE_CATEGORY_LABEL, UFS } from "@/lib/taxonomy";
import { requireAdmin } from "@/lib/user";

export const metadata = { title: "Admin · Fontes e buscas" };
export const dynamic = "force-dynamic";

const LEVELS = [
  { level: "Federal", label: "Federal", hint: "Sem placeholders." },
  { level: "State", label: "Estadual", hint: "Placeholders: {estado} e {uf} — rodam uma vez por estado com usuários." },
  { level: "City", label: "Municipal", hint: "Placeholders: {cidade}, {estado} e {uf} — rodam uma vez por município com usuários." },
] as const;
const POWERS = ["Legislativo", "Executivo", "Judiciario"] as const;

export default async function FontesPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [cfg, feeds, cities] = await Promise.all([
    getSettings(),
    db.feedSource.findMany({ orderBy: [{ scope: "desc" }, { name: "asc" }] }),
    db.user.findMany({ where: { uf: { not: null } }, select: { uf: true, municipality: true }, distinct: ["uf", "municipality"] }),
  ]);
  const label = "eyebrow mb-1.5 block";

  return (
    <div>
      <PageHeader eyebrow="Administração" title="Fontes e buscas do robô" />
      <AdminTabs active="fontes" />
      <div className="mb-5 space-y-2">
        {sp.ok && <Notice kind="ok">{sp.ok}</Notice>}
        {sp.erro && <Notice kind="erro">{sp.erro}</Notice>}
      </div>

      <div className="mb-6 card-flat p-5 text-sm leading-relaxed text-muted">
        <b className="text-ink">Como o robô funciona:</b> a cada hora ele lê os <b>feeds RSS</b> cadastrados abaixo e faz <b>buscas no Google News</b> — 3 por esfera (uma para cada poder: Legislativo, Executivo e Judiciário). As buscas estaduais e municipais rodam só para os locais dos usuários cadastrados
        {cities.length > 0 && <> (agora: {[...new Set(cities.map((c) => c.uf))].join(", ")} · {cities.map((c) => c.municipality).join(", ")})</>}.
        Depois deduplica e classifica cada notícia (esfera, poder, categoria) com o Claude.
      </div>

      <form action={saveRobotSettings} className="space-y-6">
        <section className="card p-5 sm:p-6">
          <h2 className="display mb-4 text-xl font-semibold">Geral</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block"><span className={label}>Idade máxima (dias)</span><input name="maxAgeDays" type="number" min={1} max={14} defaultValue={cfg.maxAgeDays} className="input" /></label>
            <label className="block"><span className={label}>Guardar notícias por (dias)</span><input name="retentionDays" type="number" min={7} max={730} defaultValue={cfg.retentionDays} className="input" /></label>
            <label className="block sm:col-span-2"><span className={label}>Modelo do Claude (vazio = padrão)</span><input name="aiModel" defaultValue={cfg.aiModel} placeholder="claude-haiku-5-5" className="input" /></label>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="googleNews" defaultChecked={cfg.googleNews === "1"} /> Buscar no Google News</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="aiClassify" defaultChecked={cfg.aiClassify === "1"} /> Classificar com IA (senão, só regras por palavra-chave)</label>
          </div>
          <p className="mt-3 text-xs text-faint">Horários (coleta de hora em hora, resumo às 7h) ficam nas variáveis INGEST_CRON e DIGEST_CRON do worker.</p>
        </section>

        {LEVELS.map(({ level, label: lvl, hint }) => (
          <section key={level} className="card p-5 sm:p-6">
            <h2 className="display text-xl font-semibold">Buscas · {lvl}</h2>
            <p className="mb-4 text-xs text-muted">{hint} Deixe vazio para desligar aquela busca.</p>
            <div className="space-y-3.5">
              {POWERS.map((p) => {
                const key = `query${level}${p}` as keyof Settings;
                return (
                  <label key={key} className="block">
                    <span className={label}>{p === "Judiciario" ? "Judiciário" : p}</span>
                    <textarea name={key} defaultValue={cfg[key]} rows={2} className="input font-mono !text-[13px]" />
                  </label>
                );
              })}
            </div>
          </section>
        ))}

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary">Salvar configuração</button>
          <button formAction={resetRobotSettings} className="btn btn-ghost" formNoValidate>Restaurar padrão</button>
        </div>
      </form>

      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2.5"><span className="display text-2xl font-semibold">Feeds RSS</span><span className="chip">{feeds.length}</span></h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <form action={addFeed} className="card h-fit space-y-3.5 p-5">
            <h3 className="display text-lg font-semibold">Adicionar feed</h3>
            <label className="block"><span className={label}>Nome do veículo</span><input name="name" required className="input" placeholder="Ex.: O Vale" /></label>
            <label className="block"><span className={label}>URL do RSS</span><input name="feedUrl" type="url" required className="input" placeholder="https://…/feed" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className={label}>Esfera</span>
                <select name="scope" defaultValue="FEDERAL" className="input"><option value="FEDERAL">Federal</option><option value="ESTADUAL">Estadual</option><option value="MUNICIPAL">Municipal</option></select>
              </label>
              <label className="block"><span className={label}>Poder</span>
                <select name="branch" defaultValue="" className="input"><option value="">Automático (IA)</option><option value="LEGISLATIVO">Legislativo</option><option value="EXECUTIVO">Executivo</option><option value="JUDICIARIO">Judiciário</option></select>
              </label>
            </div>
            <label className="block"><span className={label}>Tipo de veículo</span>
              <select name="category" defaultValue="REGIONAL" className="input">{Object.entries(SOURCE_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className={label}>UF</span>
                <select name="uf" defaultValue="" className="input"><option value="">—</option>{Object.keys(UFS).map((u) => <option key={u}>{u}</option>)}</select>
              </label>
              <label className="block"><span className={label}>Município</span><input name="municipality" className="input" placeholder="Só se municipal" /></label>
            </div>
            <p className="text-xs text-faint">UF e município valem para feeds locais; o feed é testado antes de salvar.</p>
            <button className="btn btn-primary w-full">Testar e adicionar</button>
          </form>

          <ul className="space-y-2.5">
            {feeds.map((f) => (
              <li key={f.id} className={`card-flat flex flex-wrap items-center gap-3 p-3.5 ${f.active ? "" : "opacity-60"}`}>
                <SourceAvatar name={f.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{f.name}</span>
                    <span className="chip">{SCOPE_LABEL[f.scope]}{f.municipality ? ` · ${f.municipality}` : f.uf ? ` · ${f.uf}` : ""}</span>
                    {f.branch && <span className="chip">{BRANCH_LABEL[f.branch]}</span>}
                  </div>
                  <div className="truncate text-xs text-muted">{f.feedUrl}</div>
                  <div className="text-xs">
                    {f.lastError ? <span className="text-danger">erro: {f.lastError}</span> : f.lastOkAt ? <span className="text-faint">ok {formatDistanceToNow(f.lastOkAt, { addSuffix: true, locale: ptBR })} · {f.lastCount} itens recentes</span> : <span className="text-faint">ainda não coletado</span>}
                  </div>
                </div>
                <form action={toggleFeed.bind(null, f.id)}><button className="btn btn-ghost btn-sm">{f.active ? "Pausar" : "Ativar"}</button></form>
                <form action={deleteFeed.bind(null, f.id)}><button className="btn btn-danger btn-sm">Excluir</button></form>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
