import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { addFeed, confirmAllAiTiers, deleteFeed, resetRobotSettings, saveRobotSettings, saveTiers, toggleFeed } from "@/app/admin-actions";
import { TierControls } from "@/components/tier-controls";
import { AdminTabs } from "@/components/admin-tabs";
import { Notice, PageHeader, SourceAvatar } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettings, type Settings } from "@/lib/settings";
import { BRANCH_LABEL, SCOPE_LABEL, SOURCE_CATEGORY_LABEL, UFS } from "@/lib/taxonomy";
import { TIER_LEGEND } from "@/lib/tier-legend";
import { requireAdmin } from "@/lib/user";

export const metadata = { title: "Admin · Fontes e buscas" };
export const dynamic = "force-dynamic";

const LEVELS = [
  { level: "Federal", label: "Federal", hint: "Sem placeholders." },
  { level: "State", label: "Estadual", hint: "Placeholders: {estado} e {uf} — rodam uma vez por estado com usuários." },
  { level: "City", label: "Municipal", hint: "Placeholders: {cidade}, {estado} e {uf} — rodam uma vez por município com usuários." },
] as const;
const POWERS = ["Legislativo", "Executivo", "Judiciario"] as const;

export default async function FontesPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; vq?: string; revisar?: string; n?: string; ordem?: string; nivel?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const vq = sp.vq?.trim();
  const limit = Math.min(1000, Math.max(80, Number(sp.n) || 80));
  const ordem = ["tier", "tier-desc", "nome", "revisao"].includes(sp.ordem ?? "") ? sp.ordem! : "noticias";
  const nivel = ["1", "2", "3", "none"].includes(sp.nivel ?? "") ? sp.nivel! : "";
  const orderBy: Prisma.SourceOrderByWithRelationInput[] =
    ordem === "tier" ? [{ tier: { sort: "asc", nulls: "last" } }, { articles: { _count: "desc" } }]
    : ordem === "tier-desc" ? [{ tier: { sort: "desc", nulls: "last" } }, { articles: { _count: "desc" } }]
    : ordem === "nome" ? [{ name: "asc" }]
    : ordem === "revisao" ? [{ tierBy: { sort: "asc", nulls: "last" } }, { articles: { _count: "desc" } }]
    : [{ articles: { _count: "desc" } }];
  const sources = await db.source.findMany({
    where: {
      ...(vq ? { name: { contains: vq, mode: "insensitive" as const } } : {}),
      ...(sp.revisar ? { tierBy: { not: "admin" } } : {}),
      ...(nivel === "none" ? { tier: null } : nivel ? { tier: Number(nivel) } : {}),
    },
    include: { _count: { select: { articles: true } } },
    orderBy,
    take: limit + 1,
  });
  const hasMore = sources.length > limit;
  const shown = sources.slice(0, limit);
  const reviewCount = await db.source.count({ where: { tierBy: "ai" } });
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
      <nav aria-label="Seções" className="scrollbar-none sticky top-14 z-20 -mx-4 mb-6 flex gap-2 overflow-x-auto border-b border-line bg-paper/90 px-4 py-2.5 backdrop-blur-xl sm:mx-0 sm:rounded-b-2xl sm:px-0">
        {[["geral", "Geral"], ["buscas", "Buscas por esfera"], ["eleicoes", "Eleições"], ["checagens", "Checagens"], ["tiers", "Tiers dos veículos"], ["feeds", "Feeds RSS"]].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="flex-none rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-sm font-medium text-muted hover:text-ink">{label}</a>
        ))}
      </nav>

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
        <section id="geral" className="card scroll-mt-32 p-5 sm:p-6">
          <h2 className="display mb-4 text-xl font-semibold">Geral</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block"><span className={label}>Coletar a cada (minutos)</span><input name="ingestIntervalMinutes" type="number" min={10} max={1440} step={5} defaultValue={cfg.ingestIntervalMinutes} className="input" /></label>
            <label className="block"><span className={label}>Idade máx. nacionais (dias)</span><input name="maxAgeDays" type="number" min={0} max={365} defaultValue={cfg.maxAgeDays} className="input" /></label>
            <label className="block"><span className={label}>Idade máx. locais (dias)</span><input name="localMaxAgeDays" type="number" min={0} max={365} defaultValue={cfg.localMaxAgeDays} className="input" /></label>
            <label className="block"><span className={label}>Guardar histórico por (dias)</span><input name="retentionDays" type="number" min={0} max={3650} defaultValue={cfg.retentionDays} className="input" /></label>
            <label className="block sm:col-span-2 lg:col-span-3"><span className={label}>Modelo do Claude (vazio = padrão)</span><input name="aiModel" defaultValue={cfg.aiModel} placeholder="claude-haiku-5-5" className="input" /></label>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="googleNews" defaultChecked={cfg.googleNews === "1"} /> Buscar no Google News</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="aiClassify" defaultChecked={cfg.aiClassify === "1"} /> Classificar com IA (senão, só regras por palavra-chave)</label>
          </div>
          <label className="mt-4 block">
            <span className={label}>Veículos prioritários (domínios)</span>
            <textarea name="priorityOutlets" defaultValue={cfg.priorityOutlets} rows={2} placeholder="cnnbrasil.com.br, folha.uol.com.br" className="input font-mono !text-[13px]" />
            <span className="mt-1 block text-xs text-faint">Além do feed, o robô faz buscas só nesses sites para o federal, seu estado e sua cidade — cobertura mais funda do que o RSS entrega.</span>
          </label>
          <p className="mt-3 text-xs text-faint"><b>0 = sem limite.</b> Idade máxima: descarta itens mais velhos que isso ao coletar (0 aceita tudo que o feed devolver). Guardar por: 0 mantém todo o histórico para sempre; favoritas nunca são apagadas. <b>Coletar a cada:</b> mínimo de 10 minutos (o robô confere a cada 5). Em produção com tarefas agendadas do Coolify, use uma tarefa a cada 10 minutos com <code>npm run job -- ingest --scheduled</code>. O horário dos resumos por e-mail continua nas variáveis DIGEST_CRON, WEEKLY_DIGEST_CRON e MONTHLY_DIGEST_CRON.</p>
        </section>

        {LEVELS.map(({ level, label: lvl, hint }, idx) => (
          <section key={level} id={idx === 0 ? "buscas" : `buscas-${level.toLowerCase()}`} className="card scroll-mt-32 p-5 sm:p-6">
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

        <section id="eleicoes" className="card scroll-mt-32 p-5 sm:p-6">
          <h2 className="display text-xl font-semibold">Buscas · Eleições</h2>
          <p className="mb-4 text-xs text-muted">Alimenta a página Eleições (notícias por cargo e pesquisas). Placeholders: {"{estado}"} e {"{uf}"}.</p>
          <div className="space-y-3.5">
            <label className="block"><span className={label}>Nacional</span><textarea name="queryElectionFederal" defaultValue={cfg.queryElectionFederal} rows={2} className="input font-mono !text-[13px]" /></label>
            <label className="block"><span className={label}>Por estado</span><textarea name="queryElectionState" defaultValue={cfg.queryElectionState} rows={2} className="input font-mono !text-[13px]" /></label>
          </div>
        </section>

        <section id="checagens" className="card scroll-mt-32 p-5 sm:p-6">
          <h2 className="display text-xl font-semibold">Buscas · Checagem de fatos local</h2>
          <p className="mb-4 text-xs text-muted">Alimenta a página Checagens nas esferas estadual e municipal. Placeholders: {"{estado}"}, {"{cidade}"}, {"{uf}"}.</p>
          <div className="space-y-3.5">
            <label className="block"><span className={label}>Estadual</span><textarea name="queryFactCheckState" defaultValue={cfg.queryFactCheckState} rows={2} className="input font-mono !text-[13px]" /></label>
            <label className="block"><span className={label}>Municipal</span><textarea name="queryFactCheckCity" defaultValue={cfg.queryFactCheckCity} rows={2} className="input font-mono !text-[13px]" /></label>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <SubmitButton className="btn btn-primary" pendingText="Salvando…">Salvar configuração</SubmitButton>
          <SubmitButton formAction={resetRobotSettings} formNoValidate className="btn btn-ghost" pendingText="Restaurando…">Restaurar padrão</SubmitButton>
        </div>
      </form>

      <section id="tiers" className="mt-10 scroll-mt-32">
        <h2 className="display text-2xl font-semibold">Níveis (tiers) dos veículos</h2>
        <p className="mb-4 mt-1 max-w-3xl text-sm text-muted">
          O tier mede <b>alcance e tipo</b> do veículo, não qualidade nem posição política. {([1, 2, 3] as const).map((t) => <span key={t}><b className="text-ink">{TIER_LEGEND[t].label}</b>: {TIER_LEGEND[t].desc} </span>)}
          A lista inicial é curada; veículos novos recebem uma sugestão da IA (selo <span className="chip">IA</span>) que você pode confirmar ou corrigir.
        </p>
        <form action="/admin/fontes#tiers" className="mb-3 flex flex-wrap gap-2">
          <input name="vq" defaultValue={vq} placeholder="Buscar veículo…" className="input max-w-[14rem]" />
          <select name="nivel" defaultValue={nivel} className="input !w-40" aria-label="Filtrar por tier">
            <option value="">Todos os tiers</option><option value="1">Só Tier 1</option><option value="2">Só Tier 2</option><option value="3">Só Tier 3</option><option value="none">Sem tier</option>
          </select>
          <select name="ordem" defaultValue={ordem} className="input !w-56" aria-label="Ordenar por">
            <option value="noticias">Ordenar: mais notícias</option>
            <option value="tier">Ordenar: Tier 1 → 3</option>
            <option value="tier-desc">Ordenar: Tier 3 → 1</option>
            <option value="revisao">Ordenar: não revisados primeiro</option>
            <option value="nome">Ordenar: nome (A–Z)</option>
          </select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="revisar" value="1" defaultChecked={Boolean(sp.revisar)} /> Só os não revisados ({reviewCount} sugeridos pela IA)</label>
          <button className="btn btn-secondary btn-sm">Aplicar</button>
        </form>
        <form action={saveTiers}>
          <TierControls total={shown.length} />
          <div className="card-flat divide-y divide-line">
            {shown.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                <input type="checkbox" name="sel" value={s.id} aria-label={`Marcar ${s.name}`} />
                <SourceAvatar name={s.name} size={28} />
                <div className="min-w-0 flex-1">
                  <span className="truncate text-sm font-semibold">{s.name}</span>
                  <span className="ml-2 text-xs text-faint">{SOURCE_CATEGORY_LABEL[s.category]} · {s._count.articles} notícias</span>
                </div>
                {s.tierBy === "ai" && <span className="chip">IA</span>}
                {s.tierBy === "ai" && <label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" name={`ok_${s.id}`} /> confirmar</label>}
                <select name={`tier_${s.id}`} defaultValue={s.tier ?? ""} className="input !w-32 !py-1.5 text-sm">
                  <option value="">Sem tier</option><option value="1">Tier 1</option><option value="2">Tier 2</option><option value="3">Tier 3</option>
                </select>
              </div>
            ))}
            {!shown.length && <p className="p-4 text-sm text-muted">Nenhum veículo encontrado.</p>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <SubmitButton className="btn btn-primary" pendingText="Salvando…">Salvar alterações dos seletores</SubmitButton>
            {reviewCount > 0 && <SubmitButton formAction={confirmAllAiTiers} className="btn btn-secondary" pendingText="Confirmando…">Confirmar TODAS as {reviewCount} sugestões da IA</SubmitButton>}
            <span className="text-xs text-faint">Mostrando {shown.length} veículos (os com mais notícias primeiro).</span>
            {hasMore && <a href={`?${new URLSearchParams({ ...(vq ? { vq } : {}), ...(sp.revisar ? { revisar: "1" } : {}), ...(nivel ? { nivel } : {}), ...(ordem !== "noticias" ? { ordem } : {}), n: String(limit + 120) })}#tiers`} className="text-sm text-brand underline">Mostrar mais</a>}
          </div>
        </form>
      </section>

      <section id="feeds" className="mt-10 scroll-mt-32">
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
            <SubmitButton className="btn btn-primary w-full" pendingText="Testando o feed…">Testar e adicionar</SubmitButton>
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
