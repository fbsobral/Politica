/* Miniaturas ilustrativas das telas do app para os tours (dados fictícios). HTML puro: nítidas e com o tema claro/escuro. */

import { IconLogo } from "@/components/icons";

/** Destaque pulsante no ponto que o passo explica. */
function Hl({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`tour-hl relative rounded-lg ${className}`}>{children}</div>;
}

function Frame({ title, children, scope }: { title: string; children: React.ReactNode; scope?: "M" | "E" | "F" }) {
  const dot = scope === "E" ? "bg-estadual" : scope === "F" ? "bg-federal" : "bg-municipal";
  return (
    <div className="h-full overflow-hidden rounded-t-xl border border-b-0 border-line bg-paper text-left shadow-pop">
      <div className="flex items-center gap-1.5 border-b border-line bg-surface px-2.5 py-1.5">
        <span className="scale-75 [&_svg]:h-5 [&_svg]:w-5"><IconLogo /></span>
        <span className="truncate text-[10px] font-semibold">{title}</span>
        <span className="ml-auto flex items-center gap-1 rounded-full border border-line px-1.5 py-px text-[8px] text-muted"><span className={`h-1 w-1 rounded-full ${dot}`} />Campinas · SP</span>
      </div>
      <div className="space-y-1.5 p-2.5">{children}</div>
    </div>
  );
}

const Tabs = ({ items, on = 0, hl }: { items: string[]; on?: number; hl?: boolean }) => {
  const t = (
    <div className="flex gap-1 rounded-lg border border-line bg-surface p-0.5">
      {items.map((x, i) => <span key={x} className={`flex-1 truncate rounded-md px-1.5 py-0.5 text-center text-[9px] font-semibold ${i === on ? "bg-ink text-paper" : "text-muted"}`}>{x}</span>)}
    </div>
  );
  return hl ? <Hl>{t}</Hl> : t;
};

const Chip = ({ children, on }: { children: React.ReactNode; on?: boolean }) => (
  <span className={`whitespace-nowrap rounded-full border px-1.5 py-px text-[8.5px] font-semibold ${on ? "border-brand bg-brand-soft text-brand" : "border-line-strong text-muted"}`}>{children}</span>
);

const SCOPE: Record<string, string> = { M: "bg-municipal", E: "bg-estadual", F: "bg-federal" };

function News({ src, title, s = "M", tag, star }: { src: string; title: string; s?: string; tag: string; star?: boolean }) {
  return (
    <div className="flex gap-2 rounded-lg border border-line bg-surface p-1.5">
      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-soft text-[8px] font-bold text-brand">{src[0]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[8px] text-muted"><b className="text-ink">{src}</b> · há 20 min</p>
        <p className="truncate text-[10px] font-semibold leading-tight">{title}</p>
        <div className="mt-0.5 flex gap-1"><span className="inline-flex items-center gap-0.5 rounded-full bg-ink/5 px-1 text-[7.5px] font-semibold"><span className={`h-1 w-1 rounded-full ${SCOPE[s]}`} />{s === "M" ? "Municipal" : s === "E" ? "Estadual" : "Federal"}</span><span className="rounded-full bg-brand-soft px-1 text-[7.5px] font-semibold text-brand">{tag}</span></div>
      </div>
      <span className={`text-[11px] leading-none ${star ? "text-gold" : "text-faint"}`}>★</span>
    </div>
  );
}

function Person({ name, role, party, follow }: { name: string; role: string; party: string; follow?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface p-1.5">
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gold/30 text-[9px] font-bold">{name[0]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[7.5px] font-bold uppercase tracking-wide text-faint">{role}</p>
        <p className="truncate text-[10px] font-semibold leading-tight">{name} <span className="rounded bg-ink/10 px-1 text-[7.5px]">{party}</span></p>
      </div>
      <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${follow ? "bg-brand text-white" : "border border-line-strong text-muted"}`}>{follow ? "Seguindo" : "Seguir"}</span>
    </div>
  );
}

function Bar({ label, v, fill = "bg-municipal", soft = "bg-municipal-soft", proj, pace, value }: { label: string; v: number; fill?: string; soft?: string; proj?: number; pace?: number; value?: string }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[8.5px]"><span className="font-medium">{label}</span><span className="text-muted">{value ?? `${v}%`}</span></div>
      <div className={`relative h-2 rounded-[3px] ${soft}`} style={{ boxShadow: "inset 0 0 0 1px var(--line-strong)" }}>
        <div className={`absolute left-0 top-[2px] h-1 rounded-[3px] ${fill}`} style={{ width: `${v}%` }} />
        {pace !== undefined && <div className="absolute -top-0.5 h-3 w-px bg-ink" style={{ left: `${pace}%` }} />}
        {proj !== undefined && <div className="absolute -top-[1px] h-2.5 w-2.5 rounded-full border-2 border-municipal bg-surface" style={{ left: `calc(${proj}% - 5px)` }} />}
      </div>
    </div>
  );
}

function Line({ pts, band, dots, h = 64 }: { pts: number[]; band?: [number, number]; dots?: { x: number; y: number }[]; h?: number }) {
  const W = 260, max = 10;
  const x = (i: number, n = pts.length + (dots ? 3 : 0)) => 6 + (i / (n - 1)) * (W - 12);
  const y = (v: number) => 4 + (1 - v / max) * (h - 8);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="w-full" aria-hidden>
      {[0.25, 0.5, 0.75].map((t) => <line key={t} x1="0" x2={W} y1={h * t} y2={h * t} stroke="var(--line)" strokeDasharray="2 3" />)}
      {band && <rect x="0" width={W} y={y(band[1])} height={y(band[0]) - y(band[1])} fill="var(--ok)" fillOpacity="0.14" />}
      <polyline points={pts.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" />
      {dots?.map((d, i) => <circle key={i} cx={x(pts.length - 1 + d.x)} cy={y(d.y)} r="3.5" fill="var(--surface)" stroke="var(--brand)" strokeWidth="1.8" />)}
    </svg>
  );
}

function Kpi({ l, v, s }: { l: string; v: string; s?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-1.5">
      <p className="text-[7px] font-bold uppercase tracking-wide text-faint">{l}</p>
      <p className="text-[12px] font-semibold leading-tight">{v}</p>
      {s && <p className="text-[7.5px] font-bold">{s}</p>}
    </div>
  );
}

const Bubble = ({ me, children }: { me?: boolean; children: React.ReactNode }) => (
  <p className={`max-w-[85%] rounded-xl px-2 py-1 text-[9px] leading-snug ${me ? "ml-auto rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-surface text-muted"}`}>{children}</p>
);

const SCOPES = ["Todas", "Municipal", "Estadual", "Federal"];
const PILLARS: [string, number][] = [["Alimentação", 82], ["Habitação", 62], ["Transportes", 34], ["Comunicação", 14]];

export const SCREENS: Record<string, () => React.ReactNode> = {
  welcome: () => (
    <Frame title="Início">
      <Tabs items={SCOPES} />
      <div className="grid grid-cols-3 gap-1">
        {[["Notícias", "bg-municipal"], ["Pessoas", "bg-estadual"], ["Números", "bg-federal"]].map(([t, c]) => (
          <div key={t} className="rounded-lg border border-line bg-surface p-1.5"><span className={`block h-1.5 w-4 rounded-full ${c}`} /><p className="mt-1 text-[9px] font-semibold">{t}</p></div>
        ))}
      </div>
      <News src="Diário da Região" title="Prefeitura anuncia reforma de 14 unidades de saúde" tag="Saúde" />
    </Frame>
  ),
  feed: () => (
    <Frame title="Feed">
      <Tabs items={SCOPES} on={1} />
      <News src="Diário da Região" title="Câmara aprova novo plano de mobilidade urbana" tag="Transporte" />
      <News src="Portal Nacional" s="F" title="Senado vota hoje proposta sobre crédito rural" tag="Economia" />
      <News src="Rádio Capital" s="E" title="Assembleia debate piso dos professores" tag="Educação" />
    </Frame>
  ),
  "feed-tabs": () => (
    <Frame title="Feed">
      <Tabs items={SCOPES} on={1} hl />
      <News src="Diário da Região" title="Câmara aprova novo plano de mobilidade urbana" tag="Transporte" />
      <News src="Jornal da Cidade" title="Licitação de creches entra na fase final" tag="Educação" />
    </Frame>
  ),
  "feed-filters": () => (
    <Frame title="Feed">
      <Tabs items={SCOPES} />
      <Hl className="space-y-1 p-0.5">
        <div className="flex gap-1"><Chip on>Todos os poderes</Chip><Chip>Legislativo</Chip><Chip>Executivo</Chip><Chip>Judiciário</Chip></div>
        <div className="flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[8.5px] text-faint">⌕ Buscar notícias…<span className="ml-auto rounded bg-ink/5 px-1 text-muted">Filtros · 2</span></div>
      </Hl>
      <News src="Portal Nacional" s="F" title="STF julga ação sobre royalties" tag="Justiça" />
    </Frame>
  ),
  "feed-summary": () => (
    <Frame title="Notícia">
      <News src="Portal Nacional" s="F" title="Congresso aprova crédito para pequenos negócios" tag="Economia" star />
      <Hl className="rounded-lg border border-line bg-brand-soft/70 p-2">
        <p className="text-[7.5px] font-bold uppercase tracking-wide text-brand">Resumo · IA</p>
        <p className="mt-0.5 text-[9px] leading-snug text-muted">O Congresso aprovou a ampliação das linhas de crédito para microempreendedores, com juros menores nos dois primeiros anos. O texto segue para sanção…</p>
        <p className="mt-1 text-[8.5px] font-semibold text-brand">Ler a matéria completa →</p>
      </Hl>
    </Frame>
  ),
  people: () => (
    <Frame title="Representantes">
      <Tabs items={["Municipal", "Estadual", "Federal", "Seguindo"]} />
      <Person name="Maria Souza" role="Prefeita" party="PXX" follow />
      <Person name="Carlos Lima" role="Vereador" party="PYY" />
      <Person name="Ana Ribeiro" role="Deputada federal" party="PZZ" />
    </Frame>
  ),
  "people-list": () => (
    <Frame title="Representantes">
      <Tabs items={["Municipal", "Estadual", "Federal", "Seguindo"]} hl />
      <Person name="Maria Souza" role="Prefeita" party="PXX" />
      <Person name="Carlos Lima" role="Vereador" party="PYY" />
      <Person name="Beatriz Rocha" role="Vereadora" party="PWW" />
    </Frame>
  ),
  "people-profile": () => (
    <Frame title="Ana Ribeiro">
      <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/30 text-[11px] font-bold">A</span><div><p className="text-[11px] font-semibold">Ana Ribeiro <span className="rounded bg-ink/10 px-1 text-[8px]">PZZ</span></p><p className="text-[8px] text-muted">Deputada federal · 2023–2027</p></div></div>
      <Hl className="grid grid-cols-2 gap-1">
        <Kpi l="Projetos de autoria" v="38" s={<span className="text-muted">12 em 2026</span>} />
        <Kpi l="Gastos (cota)" v="R$ 412 mil" s={<span className="text-muted">no ano</span>} />
      </Hl>
      <News src="Portal Nacional" s="F" title="Deputada apresenta projeto sobre saneamento" tag="Saneamento" />
    </Frame>
  ),
  "people-follow": () => (
    <Frame title="Ana Ribeiro">
      <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/30 text-[11px] font-bold">A</span><div><p className="text-[11px] font-semibold">Ana Ribeiro</p><p className="text-[8px] text-muted">Deputada federal · PZZ</p></div></div>
      <Hl className="flex gap-1.5 p-0.5"><span className="rounded-full bg-brand px-2 py-0.5 text-[9px] font-semibold text-white">✓ Seguindo</span><span className="rounded-full border border-brand px-2 py-0.5 text-[9px] font-semibold text-brand">🔔 Receber alertas</span></Hl>
      <div className="rounded-lg border border-line bg-surface p-1.5 text-[8.5px] text-muted"><b className="text-ink">Novo alerta:</b> “Ana Ribeiro” citada em 2 notícias hoje</div>
    </Frame>
  ),
  party: () => (
    <Frame title="Partidos">
      <div className="flex gap-1">{["PXX", "PYY", "PZZ", "PWW"].map((p, i) => <span key={p} className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${i === 0 ? "bg-ink text-paper" : "bg-surface text-muted"}`}>{p}</span>)}</div>
      <Hl className="grid grid-cols-3 gap-1"><Kpi l="Prefeitos" v="612" /><Kpi l="Deputados" v="68" /><Kpi l="Senadores" v="9" /></Hl>
      <News src="Portal Nacional" s="F" title="PXX define pré-candidatos para 2026" tag="Eleições" />
    </Frame>
  ),
  quiz: () => (
    <Frame title="Você · perfil político">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="space-y-1">
          <p className="text-[9.5px] font-semibold leading-tight">O Estado deve controlar preços de combustíveis?</p>
          {["Concordo", "Discordo"].map((o, i) => <span key={o} className={`block rounded-md border px-1.5 py-0.5 text-[8.5px] ${i === 1 ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line text-muted"}`}>{o}</span>)}
        </div>
        <Hl className="relative h-[62px] w-[62px] rounded-md border border-line bg-surface">
          <span className="absolute inset-x-0 top-1/2 h-px bg-line-strong" /><span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
          <span className="absolute left-[58%] top-[30%] h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-surface" />
          {[["22%", "62%"], ["70%", "20%"], ["40%", "40%"]].map(([l, t]) => <span key={l} className="absolute h-1.5 w-1.5 rounded-full bg-muted/60" style={{ left: l, top: t }} />)}
        </Hl>
      </div>
      <p className="text-[8.5px] text-muted">Mais próximos: <b className="text-ink">PYY 82%</b> · PZZ 74% · PXX 51%</p>
    </Frame>
  ),
  agenda: () => (
    <Frame title="Agenda e votações" scope="F">
      <Tabs items={["Câmara e Senado", "Câmara", "Senado"]} />
      {[["Ter 10/11 · 14h", "Plenário da Câmara — sessão deliberativa"], ["Qua 11/11 · 10h", "CAE do Senado — reforma tributária"]].map(([d, t]) => (
        <div key={t} className="rounded-lg border border-line bg-surface p-1.5"><p className="text-[8px] font-bold text-federal">{d}</p><p className="text-[9.5px] font-semibold leading-tight">{t}</p></div>
      ))}
      <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface p-1.5"><span className="rounded-full bg-municipal-soft px-1.5 text-[8px] font-bold text-municipal">Aprovada</span><span className="truncate text-[9px]">PL do crédito para pequenos negócios</span></div>
    </Frame>
  ),
  "agenda-explain": () => (
    <Frame title="Agenda e votações" scope="F">
      <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface p-1.5"><span className="rounded-full bg-municipal-soft px-1.5 text-[8px] font-bold text-municipal">Aprovada</span><span className="truncate text-[9px] font-semibold">PL 1.234/2026 · crédito rural</span></div>
      <Hl className="rounded-lg border border-line bg-brand-soft/70 p-2">
        <p className="text-[8.5px] font-bold text-brand">▾ Saiba mais</p>
        <p className="mt-0.5 text-[9px] leading-snug text-muted">O projeto aumenta o limite de crédito com juros menores para pequenos produtores. Foi aprovado por 312 a 98 e segue para o Senado.</p>
      </Hl>
    </Frame>
  ),
  elections: () => (
    <Frame title="Eleições 2026">
      <Tabs items={["Geral", "Presidente", "Governador", "Senado"]} on={2} hl />
      <div className="rounded-lg border border-line bg-surface p-1.5">
        <p className="text-[7.5px] font-bold uppercase tracking-wide text-faint">Pesquisa · 30/10</p>
        {[["Candidata A", 38], ["Candidato B", 31], ["Candidato C", 12]].map(([n, v]) => (
          <div key={n} className="mt-0.5 flex items-center gap-1.5 text-[8.5px]"><span className="w-16 truncate">{n}</span><span className="h-1.5 rounded-full bg-brand" style={{ width: `${Number(v) * 1.6}px` }} /><b>{v}%</b></div>
        ))}
      </div>
    </Frame>
  ),
  factcheck: () => (
    <Frame title="Checagens">
      <Tabs items={["Todas", "Municipal", "Estadual", "Federal"]} />
      {[["Falso", "bg-danger/15 text-danger", "Vídeo de obra parada não é da cidade"], ["Verdadeiro", "bg-ok/15 text-ok", "Gasto com saúde subiu 8% em 2025"]].map(([v, c, t], i) => {
        const card = <div className="flex items-center gap-1.5 rounded-lg border border-line bg-surface p-1.5"><span className={`rounded-full px-1.5 text-[8px] font-bold ${c}`}>{v}</span><span className="truncate text-[9.5px] font-semibold">{t}</span></div>;
        return i === 0 ? <Hl key={t}>{card}</Hl> : <div key={t}>{card}</div>;
      })}
      <p className="text-[8px] text-faint">Agências independentes · fonte em cada checagem</p>
    </Frame>
  ),
  gazette: () => (
    <Frame title="Diário Oficial">
      <Hl className="flex items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-1 text-[9px]">⌕ <b>licitação creche</b></Hl>
      {["Edição de 03/11 — Aviso de licitação nº 45: construção de creche no Jardim…", "Edição de 28/10 — Homologação da licitação de reforma de creches…"].map((t) => (
        <div key={t} className="rounded-lg border border-line bg-surface p-1.5 text-[8.5px] leading-snug text-muted">{t}</div>
      ))}
    </Frame>
  ),
  alerts: () => (
    <Frame title="Alertas">
      <Hl className="flex gap-1 p-0.5"><span className="flex-1 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[9px]">Jardim das Flores</span><span className="rounded-md bg-brand px-2 py-0.5 text-[9px] font-semibold text-white">Criar</span></Hl>
      {[["transporte público", "3 avisos"], ["Maria Souza", "1 aviso"]].map(([k, n]) => (
        <div key={k} className="flex items-center justify-between rounded-lg border border-line bg-surface p-1.5 text-[9px]"><b>{k}</b><span className="text-muted">{n} · Pausar</span></div>
      ))}
      <div className="rounded-lg border border-line bg-surface p-1.5 text-[8.5px] text-muted">✉ Resumo diário · semanal · mensal</div>
    </Frame>
  ),
  favorites: () => (
    <Frame title="Favoritos">
      <News src="Portal Nacional" s="F" title="Congresso aprova crédito para pequenos negócios" tag="Economia" star />
      <News src="Diário da Região" title="Prefeitura anuncia reforma de unidades de saúde" tag="Saúde" star />
    </Frame>
  ),
  numbers: () => (
    <Frame title="Números">
      <div className="grid grid-cols-3 gap-1"><Kpi l="Despesa" v="R$ 4,5 bi" /><Kpi l="IPCA 12m" v="4,9%" s={<span className="text-danger">▲ acima</span>} /><Kpi l="Score" v="64" /></div>
      <Bar label="Saúde" v={74} proj={96} value="74% · segue a LOA" />
      <Bar label="Educação" v={54} proj={71} value="54%" />
    </Frame>
  ),
  "budget-kpis": () => (
    <Frame title="Orçamento">
      <Tabs items={["Todas", "Municipal", "Estadual", "Federal"]} on={1} hl />
      <div className="grid grid-cols-2 gap-1"><Kpi l="Despesa 2025" v="R$ 4,5 bi" /><Kpi l="Receita 2025" v="R$ 4,6 bi" /><Kpi l="Por habitante" v="R$ 3.910" /><Kpi l="Execução 2026" v="79%" /></div>
    </Frame>
  ),
  "budget-line": () => (
    <Frame title="Orçamento · evolução">
      <div className="flex gap-1"><Chip on>Para onde vai</Chip><Chip>De onde vem</Chip><Chip on>R$</Chip><Chip>IPCA</Chip></div>
      <Hl className="rounded-lg border border-line bg-surface p-1"><Line pts={[3, 3.4, 3.2, 3.8, 4.1, 4.4, 4.6, 5.1, 5.3]} h={70} /></Hl>
      <div className="flex gap-1"><Chip on>Total</Chip><Chip on>Saúde</Chip><Chip on>Educação</Chip><Chip>+ 9</Chip></div>
    </Frame>
  ),
  "budget-bars": () => (
    <Frame title="Para onde vai o dinheiro">
      <Bar label="Saúde" v={92} fill="bg-estadual" soft="bg-line" value="R$ 1,2 bi · 27%" />
      <Hl className="ml-2 space-y-1 border-l-2 border-line pl-2">
        <Bar label="Atenção básica" v={60} fill="bg-estadual" soft="bg-line" value="R$ 610 mi" />
        <Bar label="Hospitais" v={44} fill="bg-estadual" soft="bg-line" value="R$ 450 mi" />
      </Hl>
      <Bar label="Educação" v={78} fill="bg-estadual" soft="bg-line" value="R$ 1,0 bi · 23%" />
    </Frame>
  ),
  "fiscal-cards": () => (
    <Frame title="Expectativa fiscal">
      <Hl className="grid grid-cols-3 gap-1">
        <Kpi l="Receita" v="R$ 10,1 bi" s={<span className="text-danger">▼ −6,5% LOA</span>} />
        <Kpi l="Despesa" v="R$ 12,6 bi" s={<span className="text-ok">✓ Segue a LOA</span>} />
        <Kpi l="Saldo" v="−R$ 2,5 bi" s={<span className="text-danger">▼ falta</span>} />
      </Hl>
      <Bar label="Receita arrecadada" v={75} pace={83} value="R$ 8,3 de 11 bi" />
    </Frame>
  ),
  "fiscal-proj": () => (
    <Frame title="Expectativa fiscal">
      <Kpi l="Despesa · projeção do fechamento" v="R$ 12,6 bi" s={<span className="text-ok">✓ Segue a LOA (+4%)</span>} />
      <Hl className="rounded-lg border border-line bg-surface p-1"><Line pts={[0.6, 1.5, 2.6, 3.9, 5.2, 6.6]} dots={[{ x: 1, y: 8.2 }]} band={[7.4, 8.6]} h={58} /></Hl>
    </Frame>
  ),
  "fiscal-bars": () => (
    <Frame title="Cada área frente à LOA">
      <Hl className="space-y-1.5 p-0.5">
        <Bar label="Urbanismo" v={30} pace={68} proj={42} value="▼ 57% abaixo" />
        <Bar label="Saúde" v={70} pace={80} proj={92} value="✓ segue" />
        <Bar label="Transporte" v={66} pace={70} proj={88} value="✓ segue" />
      </Hl>
      <p className="text-[8px] text-faint">Barra clara: previsto · cheia: realizado · ○ projeção</p>
    </Frame>
  ),
  "infl-meta": () => (
    <Frame title="Inflação" scope="F">
      <div className="grid grid-cols-2 gap-1"><Kpi l="IPCA 12 meses" v="4,9%" s={<span className="text-danger">▲ Acima da meta</span>} /><Kpi l="Meta" v="3%" s={<span className="text-muted">1,5% a 4,5%</span>} /></div>
      <Hl className="rounded-lg border border-line bg-surface p-1"><Line pts={[9.5, 9.8, 8, 5.4, 5, 4.6, 4.8, 4.9]} band={[1.5, 4.5]} h={56} /></Hl>
    </Frame>
  ),
  "infl-focus": () => (
    <Frame title="Inflação · expectativas" scope="F">
      <Hl className="rounded-lg border border-line bg-surface p-1"><Line pts={[5.4, 5, 4.6, 4.8, 4.9]} band={[1.5, 4.5]} dots={[{ x: 1, y: 4.8 }, { x: 2, y: 4.1 }, { x: 3, y: 3.6 }]} h={62} /></Hl>
      <p className="text-[8.5px] text-muted">Focus: <b className="text-ink">2026 4,8%</b> · 2027 4,1% · 2028 3,6%</p>
    </Frame>
  ),
  "infl-pillars": () => (
    <Frame title="O que puxa a inflação" scope="F">
      <div className="flex gap-1"><Chip on>Grupos do IPCA</Chip><Chip>Tipos de preço</Chip><Chip>Núcleos</Chip></div>
      <Hl className="relative space-y-1 p-0.5">
        <span className="absolute inset-y-0 left-[38%] w-[18%] bg-ok/15" />
        {PILLARS.map(([n, v]) => (
          <div key={n} className="relative flex items-center gap-1.5 text-[8.5px]"><span className="w-[4.2rem] truncate">{n}</span><span className="h-1.5 rounded-[3px] bg-brand" style={{ width: `${v * 0.55}%` }} /><b className={`ml-auto ${v > 30 ? "text-danger" : "text-ok"}`}>{v > 30 ? "▲" : "✓"}</b></div>
        ))}
      </Hl>
    </Frame>
  ),
  indicator: () => (
    <Frame title="Indicadores">
      <div className="flex gap-1"><Chip on>Economia</Chip><Chip>Dívida</Chip><Chip>Segurança</Chip><Chip>Pobreza</Chip></div>
      <div className="rounded-lg border border-line bg-surface p-1.5">
        <p className="text-[9.5px] font-semibold">Desemprego <span className="font-normal text-muted">· meta 5%</span></p>
        <Hl className="mt-0.5"><Line pts={[7, 8.5, 9.8, 9, 8.2, 7.4, 6.8, 6.1, 5.8]} band={[0, 5]} h={50} /></Hl>
      </div>
    </Frame>
  ),
  score: () => (
    <Frame title="Score dos governos">
      <Hl className="flex h-[78px] items-end gap-1 rounded-lg border border-line bg-surface p-1.5">
        {[48, 52, 41, 58, 61, 55, 64, 66].map((v, i) => <span key={i} className="flex flex-1 flex-col items-center gap-0.5"><span className="text-[7px] font-semibold">{v}</span><span className="w-full rounded-t-[3px] bg-brand" style={{ height: `${v * 0.8}px` }} /></span>)}
      </Hl>
      <p className="text-[8.5px] text-muted">2019 → 2026 · <b className="text-ink">50% economia</b> + <b className="text-ink">50% social</b></p>
    </Frame>
  ),
  "score-editor": () => (
    <Frame title="Score · sua régua">
      <Hl className="space-y-1 p-0.5">
        {[["Inflação (IPCA)", true], ["Desemprego", true], ["Dívida pública", false], ["Homicídios", true]].map(([n, on]) => (
          <div key={String(n)} className="flex items-center justify-between rounded-md border border-line bg-surface px-1.5 py-1 text-[9px]"><span>{n}</span><span className={`h-3 w-5 rounded-full ${on ? "bg-brand" : "bg-line-strong"}`} /></div>
        ))}
      </Hl>
      <p className="text-[8.5px] font-semibold text-brand">⇩ Baixar CSV com as fontes</p>
    </Frame>
  ),
  roi: () => (
    <Frame title="ROI do orçamento">
      <div className="flex gap-1"><Chip on>Saúde</Chip><Chip>Educação</Chip><Chip>Segurança</Chip></div>
      <Hl className="rounded-lg border border-line bg-surface p-1">
        <svg viewBox="0 0 260 64" className="w-full" aria-hidden>
          {[0.33, 0.66].map((t) => <line key={t} x1="0" x2="260" y1={64 * t} y2={64 * t} stroke="var(--line)" strokeDasharray="2 3" />)}
          <polyline points="6,52 40,48 74,44 108,40 142,34 176,30 210,24 254,18" fill="none" stroke="var(--estadual)" strokeWidth="2" />
          <polyline points="6,14 40,18 74,22 108,30 142,34 176,40 210,44 254,48" fill="none" stroke="var(--brand)" strokeWidth="2" strokeDasharray="4 3" />
        </svg>
      </Hl>
      <p className="text-[8.5px] text-muted"><span className="text-estadual">━</span> gasto com saúde · <span className="text-brand">┅</span> mortalidade infantil</p>
    </Frame>
  ),
  chat: () => (
    <Frame title="Pergunte">
      <Bubble me>A prefeitura está gastando o que prometeu em saúde?</Bubble>
      <Bubble>Até outubro, empenhou <b className="text-ink">74%</b> do previsto. Pelo ritmo dos anos anteriores, deve fechar perto da LOA.</Bubble>
      <Hl className="flex gap-1 p-0.5"><Chip>E a educação?</Chip><Chip>O que é empenho?</Chip></Hl>
    </Frame>
  ),
};
