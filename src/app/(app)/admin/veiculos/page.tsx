import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { confirmAllAiTiers, saveTiers } from "@/app/admin-actions";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { TierControls } from "@/components/tier-controls";
import { Notice, PageHeader, SourceAvatar } from "@/components/ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/user";
import { SOURCE_CATEGORY_LABEL } from "@/lib/taxonomy";
import { TIER_LEGEND } from "@/lib/tier-legend";

export const metadata = { title: "Admin · Veículos e tiers" };
export const dynamic = "force-dynamic";

type SP = { ok?: string; erro?: string; vq?: string; revisar?: string; n?: string; ordem?: string; nivel?: string };

export default async function VeiculosPage({ searchParams }: { searchParams: Promise<SP> }) {
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
  const [sources, reviewCount, counts] = await Promise.all([
    db.source.findMany({
      where: {
        ...(vq ? { name: { contains: vq, mode: "insensitive" as const } } : {}),
        ...(sp.revisar ? { tierBy: { not: "admin" } } : {}),
        ...(nivel === "none" ? { tier: null } : nivel ? { tier: Number(nivel) } : {}),
      },
      include: { _count: { select: { articles: true } } },
      orderBy,
      take: limit + 1,
    }),
    db.source.count({ where: { tierBy: "ai" } }),
    db.source.groupBy({ by: ["tier"], _count: true }),
  ]);
  const hasMore = sources.length > limit;
  const shown = sources.slice(0, limit);
  const nOf = (t: number | null) => counts.find((c) => c.tier === t)?._count ?? 0;
  const more = `?${new URLSearchParams({ ...(vq ? { vq } : {}), ...(sp.revisar ? { revisar: "1" } : {}), ...(nivel ? { nivel } : {}), ...(ordem !== "noticias" ? { ordem } : {}), n: String(limit + 120) })}`;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Conteúdo" title="Veículos e tiers" />
      <div className="space-y-2">
        {sp.ok && <Notice kind="ok">{sp.ok}</Notice>}
        {sp.erro && <Notice kind="erro">{sp.erro}</Notice>}
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Distribuição">
        {([1, 2, 3] as const).map((t) => (
          <Link key={t} href={`/admin/veiculos?nivel=${t}`} className="card-flat p-4 transition-shadow hover:shadow-card">
            <p className="eyebrow">{TIER_LEGEND[t].label}</p>
            <p className="display mt-1 text-2xl font-semibold">{nOf(t)}</p>
            <p className="text-[11px] leading-snug text-faint">{TIER_LEGEND[t].desc}</p>
          </Link>
        ))}
        <Link href="/admin/veiculos?nivel=none" className="card-flat p-4 transition-shadow hover:shadow-card">
          <p className="eyebrow">Sem tier</p>
          <p className="display mt-1 text-2xl font-semibold">{nOf(null)}</p>
          <p className="text-[11px] text-faint">{reviewCount} sugestões da IA aguardando revisão</p>
        </Link>
      </section>

      <p className="max-w-3xl text-sm text-muted">
        O tier mede <b>alcance e tipo</b> do veículo, não qualidade nem posição política. A lista inicial é curada; veículos novos recebem uma sugestão da IA (selo <span className="chip">IA</span>) que você confirma ou corrige. Cada usuário escolhe quais tiers entram nos seus resumos por e-mail, e o feed tem o filtro “Nível do veículo”.
      </p>

      <form action="/admin/veiculos" className="flex flex-wrap gap-2">
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
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="revisar" value="1" defaultChecked={Boolean(sp.revisar)} /> Só não revisados ({reviewCount})</label>
        <button className="btn btn-secondary btn-sm">Aplicar</button>
        {(vq || nivel || sp.revisar || ordem !== "noticias") && <Link href="/admin/veiculos" className="btn btn-ghost btn-sm">Limpar</Link>}
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
          {reviewCount > 0 && <ConfirmButton formAction={confirmAllAiTiers} className="btn btn-secondary" message={`Confirmar TODAS as ${reviewCount} sugestões da IA como definitivas?`} pendingText="Confirmando…">Confirmar TODAS as {reviewCount} sugestões da IA</ConfirmButton>}
          <span className="text-xs text-faint">Mostrando {shown.length} veículos.</span>
          {hasMore && <Link href={more} className="text-sm text-brand underline">Mostrar mais</Link>}
        </div>
      </form>
    </div>
  );
}
