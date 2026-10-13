import { resetRobotSettings, saveRobotSettings } from "@/app/admin-actions";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { Notice, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/user";
import { getSettings, type Settings } from "@/lib/settings";

export const metadata = { title: "Admin · Buscas" };
export const dynamic = "force-dynamic";

const LEVELS = [
  { level: "Federal", label: "Federal", hint: "Sem placeholders." },
  { level: "State", label: "Estadual", hint: "Placeholders: {estado} e {uf} — rodam uma vez por estado com usuários." },
  { level: "City", label: "Municipal", hint: "Placeholders: {cidade}, {estado} e {uf} — rodam uma vez por município com usuários." },
] as const;
const POWERS = ["Legislativo", "Executivo", "Judiciario"] as const;

const SECTIONS = [
  ["esferas", "Por esfera e poder"],
  ["prioritarios", "Veículos prioritários"],
  ["eleicoes", "Eleições"],
  ["checagens", "Checagens locais"],
] as const;

export default async function BuscasPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [cfg, cities] = await Promise.all([getSettings(), db.user.findMany({ where: { uf: { not: null } }, select: { uf: true, municipality: true }, distinct: ["uf", "municipality"] })]);
  const area = "input font-mono !text-[13px]";
  const label = "eyebrow mb-1.5 block";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Conteúdo" title="Buscas do Google News" />
      <div className="space-y-2">
        {sp.ok && <Notice kind="ok">{sp.ok}</Notice>}
        {sp.erro && <Notice kind="erro">{sp.erro}</Notice>}
      </div>

      <div className="card-flat p-5 text-sm leading-relaxed text-muted">
        Além dos <a href="/admin/feeds" className="font-semibold text-brand underline">feeds RSS</a>, o robô faz estas buscas no Google News. As buscas estaduais e municipais rodam só para os locais dos usuários cadastrados
        {cities.length > 0 && <> (agora: {[...new Set(cities.map((c) => c.uf))].join(", ")} · {cities.map((c) => c.municipality).join(", ")})</>}.
        Deixe um campo vazio para desligar aquela busca. Para ligar ou desligar o Google News por completo, veja <a href="/admin/robo#parametros" className="font-semibold text-brand underline">Robô → Parâmetros</a>.
      </div>

      <nav aria-label="Seções" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {SECTIONS.map(([id, text]) => <a key={id} href={`#${id}`} className="flex-none rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-sm font-medium text-muted hover:text-ink">{text}</a>)}
      </nav>

      <form action={saveRobotSettings} className="space-y-6">
        <input type="hidden" name="_back" value="/admin/buscas" />
        <input type="hidden" name="_group" value="buscas" />

        <section id="esferas" className="card scroll-mt-24 p-5 sm:p-6">
          <h2 className="display text-xl font-semibold">Por esfera e poder</h2>
          <p className="mb-5 text-xs text-muted">Três buscas por esfera — uma para cada poder (Legislativo, Executivo e Judiciário).</p>
          <div className="space-y-7">
            {LEVELS.map(({ level, label: lvl, hint }) => (
              <div key={level}>
                <h3 className="mb-1 font-semibold">{lvl}</h3>
                <p className="mb-3 text-xs text-faint">{hint}</p>
                <div className="space-y-3">
                  {POWERS.map((p) => {
                    const key = `query${level}${p}` as keyof Settings;
                    return (
                      <label key={key} className="block"><span className={label}>{p === "Judiciario" ? "Judiciário" : p}</span><textarea name={key} defaultValue={cfg[key]} rows={2} className={area} /></label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="prioritarios" className="card scroll-mt-24 p-5 sm:p-6">
          <h2 className="display text-xl font-semibold">Veículos prioritários</h2>
          <p className="mb-4 text-xs text-muted">Domínios separados por vírgula ou linha. Além do feed, o robô faz buscas só nesses sites para o federal, o estado e a cidade dos usuários — cobertura mais funda do que o RSS entrega.</p>
          <textarea name="priorityOutlets" defaultValue={cfg.priorityOutlets} rows={2} placeholder="cnnbrasil.com.br, folha.uol.com.br" className={area} />
        </section>

        <section id="eleicoes" className="card scroll-mt-24 p-5 sm:p-6">
          <h2 className="display text-xl font-semibold">Eleições</h2>
          <p className="mb-4 text-xs text-muted">Alimenta a página Eleições (notícias por cargo e pesquisas). Placeholders: {"{estado}"} e {"{uf}"}.</p>
          <div className="space-y-3">
            <label className="block"><span className={label}>Nacional</span><textarea name="queryElectionFederal" defaultValue={cfg.queryElectionFederal} rows={2} className={area} /></label>
            <label className="block"><span className={label}>Por estado</span><textarea name="queryElectionState" defaultValue={cfg.queryElectionState} rows={2} className={area} /></label>
          </div>
        </section>

        <section id="checagens" className="card scroll-mt-24 p-5 sm:p-6">
          <h2 className="display text-xl font-semibold">Checagens locais</h2>
          <p className="mb-4 text-xs text-muted">Alimenta a página Checagens nas esferas estadual e municipal. Placeholders: {"{estado}"}, {"{cidade}"}, {"{uf}"}.</p>
          <div className="space-y-3">
            <label className="block"><span className={label}>Estadual</span><textarea name="queryFactCheckState" defaultValue={cfg.queryFactCheckState} rows={2} className={area} /></label>
            <label className="block"><span className={label}>Municipal</span><textarea name="queryFactCheckCity" defaultValue={cfg.queryFactCheckCity} rows={2} className={area} /></label>
          </div>
        </section>

        <div className="sticky bottom-20 z-10 flex flex-wrap gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-pop backdrop-blur lg:bottom-4">
          <SubmitButton className="btn btn-primary" pendingText="Salvando…">Salvar buscas</SubmitButton>
          <ConfirmButton formAction={resetRobotSettings} message="Restaurar todas as buscas para o padrão? Os textos que você editou serão perdidos." className="btn btn-ghost" pendingText="Restaurando…">Restaurar padrão</ConfirmButton>
        </div>
      </form>
    </div>
  );
}
