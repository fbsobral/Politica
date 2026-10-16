import { IconStar } from "@/components/icons";
import { PartyBadge, SourceAvatar } from "@/components/ui";

/* Mockups estáticos e ilustrativos (dados fictícios) usados na página inicial. */

const NEWS = [
  { src: "Portal Nacional", tier: 1, title: "Congresso aprova projeto que amplia o programa de crédito para pequenos negócios", chip: "Economia", poder: "Legislativo", t: "12 min", scope: "Federal", dot: "bg-federal" },
  { src: "Diário da Região", tier: 2, title: "Prefeitura anuncia reforma de 14 unidades básicas de saúde até março", chip: "Saúde", poder: "Executivo", t: "38 min", scope: "Municipal", dot: "bg-municipal" },
  { src: "Rádio Capital", tier: 2, title: "Assembleia debate novo piso para professores da rede estadual", chip: "Educação", poder: "Legislativo", t: "1 h", scope: "Estadual", dot: "bg-estadual" },
];

export function FeedMock() {
  return (
    <div className="card overflow-hidden text-left shadow-pop" aria-hidden>
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-4 py-3">
        {["Todas", "Municipal", "Estadual", "Federal"].map((t, i) => (
          <span key={t} className={`rounded-full px-3 py-1 text-xs font-semibold ${i === 0 ? "bg-ink text-paper" : "text-muted"}`}>{t}</span>
        ))}
        <span className="ml-auto hidden text-[11px] text-faint sm:block">● atualizadas há 12 min</span>
      </div>
      <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5">
        {["Todos os poderes", "Legislativo", "Executivo", "Judiciário"].map((t, i) => (
          <span key={t} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${i === 0 ? "border-brand bg-brand-soft text-brand" : "border-line-strong text-muted"}`}>{t}</span>
        ))}
      </div>
      <ul className="divide-y divide-line">
        {NEWS.map((n) => (
          <li key={n.title} className="flex gap-3 px-4 py-3.5">
            <SourceAvatar name={n.src} size={26} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                <b className="text-ink">{n.src}</b>
                <span className={`rounded px-1.5 py-px text-[10px] font-bold ${n.tier === 1 ? "bg-gold/25 text-ink" : "bg-ink/10"}`}>T{n.tier}</span>
                <span>há {n.t}</span>
              </div>
              <p className="display mt-1 text-[0.95rem] font-semibold leading-snug">{n.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-semibold"><span className={`h-1.5 w-1.5 rounded-full ${n.dot}`} />{n.scope}</span>
                <span className="chip !bg-brand-soft !text-brand !text-[10px]">{n.chip}</span>
                <span className="chip !text-[10px]">{n.poder}</span>
              </div>
            </div>
            <IconStar className="mt-1 flex-none text-faint" width={16} height={16} />
          </li>
        ))}
      </ul>
      <div className="border-t border-line bg-brand-soft/60 px-4 py-3">
        <p className="eyebrow !text-brand">Resumo da matéria · IA</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">O Congresso aprovou a ampliação das linhas de crédito para microempreendedores, com juros reduzidos nos dois primeiros anos. O texto segue para sanção e prevê regulamentação em até 90 dias…</p>
      </div>
    </div>
  );
}

const PEOPLE = [
  { name: "Maria Souza", role: "Prefeita", party: "PXX" },
  { name: "Carlos Almeida", role: "Governador", party: "PYY" },
  { name: "Ana Ribeiro", role: "Deputada federal", party: "PZZ" },
  { name: "João Pereira", role: "Senador", party: "PWW" },
];

export function PeopleMock() {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" aria-hidden>
      {PEOPLE.map((p) => (
        <div key={p.name} className="card-flat flex items-center gap-3 p-3">
          <SourceAvatar name={p.name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow !text-[10px]">{p.role}</p>
            <p className="display truncate text-base font-semibold leading-tight">{p.name}</p>
            <div className="mt-0.5"><PartyBadge party={p.party} /></div>
          </div>
          <span className="rounded-full border border-line-strong px-2.5 py-1 text-[11px] font-semibold text-muted">Seguir</span>
        </div>
      ))}
    </div>
  );
}

export function EmailMock() {
  return (
    <div className="card overflow-hidden text-left" aria-hidden>
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5 text-[11px] text-muted">
        <span className="h-2 w-2 rounded-full bg-gold" /> Política · <b className="text-ink">Resumo da semana</b>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div>
          <p className="display text-lg font-semibold">Resumo da semana · 6 a 12 de outubro</p>
          <p className="mt-0.5 text-[12px] text-muted">O que mais mexeu com a política na sua cidade, no seu estado e no país.</p>
        </div>
        <div>
          <p className="border-b border-line pb-1 text-[12px] font-bold">Município</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">A semana foi marcada pela votação do orçamento e pelo anúncio de obras de saneamento…</p>
        </div>
        <div>
          <p className="border-b border-line pb-1 text-[12px] font-bold">No Congresso · votações</p>
          <ul className="mt-1.5 space-y-1.5 text-[12px]">
            <li className="flex items-center gap-2"><span className="rounded-full bg-municipal-soft px-2 py-px text-[10px] font-bold text-municipal">Aprovada</span><span className="text-muted">Câmara · PL do crédito para pequenos negócios</span></li>
            <li className="flex items-center gap-2"><span className="rounded-full bg-danger/10 px-2 py-px text-[10px] font-bold text-danger">Rejeitada</span><span className="text-muted">Senado · Requerimento de urgência</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
