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

const PILLARS = [
  { n: "Alimentação e bebidas", v: 6.8 },
  { n: "Habitação", v: 5.1 },
  { n: "Transportes", v: 2.6 },
  { n: "Comunicação", v: 1.1 },
];

/** Números do governo: LOA x projeção e inflação por pilar frente à meta (dados fictícios). */
export function NumbersMock() {
  const X = (v: number) => (v / 8) * 100;
  return (
    <div className="space-y-3 text-left" aria-hidden>
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Expectativa fiscal · 2026</p>
          <span className="text-[11px] font-bold text-ok">✓ Segue a LOA</span>
        </div>
        <p className="display mt-1 text-2xl font-semibold">R$ 12,6 bi <span className="text-sm font-normal text-muted">projeção da despesa</span></p>
        {[{ n: "Saúde", d: 74, p: 96 }, { n: "Educação", d: 54, p: 71 }, { n: "Urbanismo", d: 36, p: 48 }].map((r) => (
          <div key={r.n} className="mt-2.5">
            <div className="mb-1 flex justify-between text-[12px]"><span className="font-medium">{r.n}</span><span className="text-muted">{r.d}% executado</span></div>
            <div className="relative h-3 rounded-[4px] bg-municipal-soft" style={{ boxShadow: "inset 0 0 0 1px var(--line-strong)" }}>
              <div className="absolute left-0 top-[2px] h-2 rounded-[4px] bg-municipal" style={{ width: `${r.d}%` }} />
              <div className="absolute top-0 h-3 w-3 rounded-full border-2 border-municipal bg-surface" style={{ left: `calc(${r.p}% - 6px)` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Inflação · 12 meses</p>
          <span className="text-[11px] font-bold text-danger">▲ IPCA 4,9% · acima da meta</span>
        </div>
        <div className="relative mt-3 space-y-2">
          <div className="pointer-events-none absolute inset-y-0 bg-ok/10" style={{ left: `calc(7.5rem + (100% - 10.25rem) * ${X(1.5) / 100})`, width: `calc((100% - 10.25rem) * ${(X(4.5) - X(1.5)) / 100})` }} />
          {PILLARS.map((p) => (
            <div key={p.n} className="relative flex items-center gap-2 text-[12px]">
              <span className="w-[7rem] flex-none truncate">{p.n}</span>
              <span className="relative h-2.5 flex-1"><span className="absolute left-0 top-0 h-2.5 rounded-[4px] bg-brand" style={{ width: `${X(p.v)}%` }} /></span>
              <b className="w-9 text-right tabular-nums">{p.v.toLocaleString("pt-BR")}%</b>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-faint">Faixa verde: intervalo da meta. Focus 2027: 4,1%.</p>
      </div>
    </div>
  );
}

/** Assistente: uma pergunta e a resposta (texto fictício). */
export function AssistantMock() {
  return (
    <div className="card overflow-hidden text-left" aria-hidden>
      <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2.5 text-[11px] text-muted">
        <span className="h-2 w-2 rounded-full bg-brand" /> <b className="text-ink">Pergunte</b> · assistente
      </div>
      <div className="space-y-3 p-4 text-[13px] leading-relaxed">
        <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-white">A prefeitura está gastando o que prometeu em saúde?</p>
        <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2.5 text-muted">
          Até outubro, a cidade empenhou <b className="text-ink">74%</b> do previsto para saúde. Pelo ritmo dos anos anteriores, deve fechar o ano perto do valor da LOA. Atenção básica está um pouco à frente; hospitais, um pouco atrás.
          <span className="mt-1.5 block text-[11px] text-faint">Fonte: relatório bimestral (RREO), Tesouro Nacional</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["E a educação?", "O que é empenho?"].map((t) => <span key={t} className="rounded-full border border-line-strong px-2.5 py-1 text-[11px] font-semibold text-muted">{t}</span>)}
        </div>
      </div>
    </div>
  );
}
