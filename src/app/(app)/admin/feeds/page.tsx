import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { addFeed, deleteFeed, toggleFeed } from "@/app/admin-actions";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { Notice, PageHeader, SourceAvatar } from "@/components/ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/user";
import { BRANCH_LABEL, SCOPE_LABEL, SOURCE_CATEGORY_LABEL, UFS } from "@/lib/taxonomy";

export const metadata = { title: "Admin · Feeds RSS" };
export const dynamic = "force-dynamic";

export default async function FeedsPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; ver?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const ver = ["erro", "pausados"].includes(sp.ver ?? "") ? sp.ver! : "todos";
  const all = await db.feedSource.findMany({ orderBy: [{ scope: "desc" }, { name: "asc" }] });
  const errors = all.filter((f) => f.active && f.lastError).length;
  const paused = all.filter((f) => !f.active).length;
  const feeds = all.filter((f) => (ver === "erro" ? f.active && f.lastError : ver === "pausados" ? !f.active : true));
  const label = "eyebrow mb-1.5 block";
  const chip = (v: string, text: string, n?: number) => (
    <Link key={v} href={v === "todos" ? "/admin/feeds" : `/admin/feeds?ver=${v}`} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${ver === v ? "border-brand bg-brand-soft text-brand" : "border-line-strong bg-surface text-muted hover:text-ink"}`}>
      {text}{n !== undefined && <span className="ml-1.5 text-xs opacity-70">{n}</span>}
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Conteúdo" title="Feeds RSS" />
      <div className="space-y-2">
        {sp.ok && <Notice kind="ok">{sp.ok}</Notice>}
        {sp.erro && <Notice kind="erro">{sp.erro}</Notice>}
      </div>
      <p className="max-w-3xl text-sm text-muted">
        Fontes lidas diretamente a cada coleta. Cada veículo novo vira também um item em <Link href="/admin/veiculos" className="font-semibold text-brand underline">Veículos e tiers</Link>. Para buscas no Google News, veja <Link href="/admin/buscas" className="font-semibold text-brand underline">Buscas</Link>.
      </p>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <form action={addFeed} className="card h-fit space-y-3.5 p-5 xl:sticky xl:top-20">
          <h2 className="display text-lg font-semibold">Adicionar feed</h2>
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
          <p className="text-xs text-faint">UF e município valem para feeds locais. O feed é testado antes de salvar.</p>
          <SubmitButton className="btn btn-primary w-full" pendingText="Testando o feed…">Testar e adicionar</SubmitButton>
        </form>

        <section aria-label="Lista de feeds" className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            {chip("todos", "Todos", all.length)}
            {chip("erro", "Com erro", errors)}
            {chip("pausados", "Pausados", paused)}
          </div>
          <ul className="space-y-2.5">
            {feeds.map((f) => (
              <li key={f.id} className={`card-flat flex flex-wrap items-center gap-3 p-3.5 ${f.active ? "" : "opacity-60"}`}>
                <SourceAvatar name={f.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">{f.name}</span>
                    <span className="chip">{SCOPE_LABEL[f.scope]}{f.municipality ? ` · ${f.municipality}` : f.uf ? ` · ${f.uf}` : ""}</span>
                    {f.branch && <span className="chip">{BRANCH_LABEL[f.branch]}</span>}
                    {f.factCheck && <span className="chip !bg-municipal-soft !text-municipal">checagem</span>}
                  </div>
                  <div className="truncate text-xs text-muted">{f.feedUrl}</div>
                  <div className="text-xs">
                    {f.lastError ? <span className="text-danger">erro: {f.lastError}</span> : f.lastOkAt ? <span className="text-faint">ok {formatDistanceToNow(f.lastOkAt, { addSuffix: true, locale: ptBR })} · {f.lastCount} itens recentes</span> : <span className="text-faint">ainda não coletado</span>}
                  </div>
                </div>
                <form action={toggleFeed.bind(null, f.id)}><button className="btn btn-ghost btn-sm">{f.active ? "Pausar" : "Ativar"}</button></form>
                <form action={deleteFeed.bind(null, f.id)}><ConfirmButton message={`Excluir o feed “${f.name}”? As notícias já coletadas continuam no app.`}>Excluir</ConfirmButton></form>
              </li>
            ))}
            {!feeds.length && <li className="card-flat p-5 text-sm text-muted">Nenhum feed nesta visão.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
