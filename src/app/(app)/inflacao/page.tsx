import { Suspense } from "react";
import { AskButton } from "@/components/agent/ask-button";
import { InflationPillars, InflationTrend, StatusChip } from "@/components/inflation-charts";
import { MiniCard } from "@/components/mini-card";
import { EmptyState, NationalOnly, Notice, PageHeader } from "@/components/ui";
import { brDateTime } from "@/lib/stamp";
import { requireUser } from "@/lib/user";
import { cmnMeta, getInflation, META_FROM, INTL, statusOf, type Band, type InflationData, type Pillar } from "@/lib/inflation";

export const metadata = { title: "Inflação e juros" };
export const dynamic = "force-dynamic";

const MES = ["", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const p2 = (v: number | null | undefined, d = 2) => (v == null ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`);

function pillarText(list: Pillar[], band: Band) {
  return list.map((p) => `- ${p.name}: ${p2(p.y12)} em 12 meses${p.weight != null ? `, peso ${p2(p.weight, 1)}` : ""} (${p.y12 != null ? statusOf(p.y12, band) : "?"} de ${band.label})`).join("\n");
}

function Detail({ d }: { d: InflationData }) {
  const ref = d.ref;
  const year = ref?.year ?? new Date().getFullYear();
  const meta = cmnMeta(year);
  const h = d.headline;
  const f0 = d.focus.ipca.find((f) => f.year === year);
  const f1 = d.focus.ipca.find((f) => f.year === year + 1);
  const s0 = d.focus.selic?.find((f) => f.year === year);
  const s1 = d.focus.selic?.find((f) => f.year === year + 1);
  const bands: Record<number, Band> = {};
  // só há meta no nosso cadastro a partir de 2004; antes disso o gráfico não desenha faixa (não vale inventar uma)
  for (let y = Math.max(META_FROM, year - 31); y <= year + 3; y++) bands[y] = cmnMeta(y);
  // meta contínua (desde 2025): descumprimento = 6 meses seguidos fora do intervalo
  const sr = h.series;
  let outside = 0;
  for (let i = sr.length - 1; i >= 0 && statusOf(sr[i].v, cmnMeta(sr[i].year)) !== "dentro"; i--) outside++;
  const st = h.y12 != null ? statusOf(h.y12, meta) : null;

  // Selic: valor vigente (último mês até agora), há 12 meses e última mudança
  const now = new Date();
  const nowYM = now.getFullYear() * 12 + now.getMonth() + 1;
  const ym = (x: { year: number; month: number }) => x.year * 12 + x.month;
  const selic = (d.selic ?? []).filter((x) => ym(x) <= nowYM);
  const sNow = selic[selic.length - 1];
  const sAgo = sNow ? selic.find((x) => ym(x) === ym(sNow) - 12) : undefined;
  let sChange: { year: number; month: number; from: number } | null = null;
  for (let i = selic.length - 1; i > 0; i--) if (selic[i].v !== selic[i - 1].v) { sChange = { year: selic[i].year, month: selic[i].month, from: selic[i - 1].v }; break; }
  const fisher = (s: number, i: number) => ((1 + s / 100) / (1 + i / 100) - 1) * 100;
  const ipcaAt = (x: { year: number; month: number }) => sr.find((p) => p.year === x.year && p.month === x.month)?.v;
  const realNow = sNow && h.y12 != null ? fisher(sNow.v, h.y12) : null;
  const realAgo = sAgo && ipcaAt(sAgo) !== undefined ? fisher(sAgo.v, ipcaAt(sAgo)!) : null;
  const real10 = (() => {
    const xs = selic.filter((x) => ym(x) > nowYM - 120).map((x) => (ipcaAt(x) === undefined ? null : fisher(x.v, ipcaAt(x)!))).filter((v): v is number => v !== null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  })();
  const sDiff = sNow && sAgo ? sNow.v - sAgo.v : null;
  const pts = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`);
  const statusTxt = st === "dentro" ? "✓ dentro da meta" : st === "acima" ? "▲ acima da meta" : st === "abaixo" ? "▼ abaixo da meta" : "—";
  const statusCls = st === "dentro" ? "text-ok" : st ? "text-danger" : "";
  const bandBar = (v: number, b: Band) => ({ kind: "band" as const, value: v, lo: b.center - b.tol, hi: b.center + b.tol, max: Math.max(v, b.center + b.tol) * 1.25, color: statusOf(v, b) === "dentro" ? "var(--ok)" : "var(--danger)", label: `Valor ${p2(v)}; meta de ${p2(b.center - b.tol, 1)} a ${p2(b.center + b.tol, 1)}` });

  return (
    <div className="space-y-8">
      <p className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm" role="status">
        <b>Último dado:</b> IPCA de {ref ? `${MES[ref.month]} de ${ref.year}` : "—"}{sNow ? <>; Selic (meta) de {MES[sNow.month]} de {sNow.year}</> : ""}{d.focus.date ? <>; Focus de {new Date(`${d.focus.date}T12:00:00`).toLocaleDateString("pt-BR")}</> : ""}.{" "}
        <span className="text-muted">Dados coletados do IBGE e do Banco Central em <b className="text-ink">{brDateTime(d.fetchedAt)}</b> e renovados a cada 12 horas.</span>
      </p>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Resumo">
        <MiniCard
          title="IPCA em 12 meses" big={p2(h.y12)} caption={ref ? `até ${MES[ref.month]} de ${ref.year}` : "sem dados"}
          note={`A inflação oficial do país (IBGE). A meta do governo é ${meta.center.toLocaleString("pt-BR")}% com tolerância de ${meta.tol.toLocaleString("pt-BR")} p.p. para mais ou menos (Conselho Monetário Nacional).${st && st !== "dentro" ? ` Está ${st} do intervalo ${outside > 1 ? `há ${outside} meses seguidos` : "neste mês"}.${year >= 2025 && outside >= 6 ? " Pela regra da meta contínua, 6 meses seguidos fora do intervalo caracterizam descumprimento." : ""}` : ""}`}
          ask={{ title: "IPCA em 12 meses", text: `IPCA em 12 meses: ${p2(h.y12)}${ref ? ` (até ${MES[ref.month]}/${ref.year})` : ""}. Meta: ${meta.label}. ${st ? `Situação: ${st} do intervalo${outside > 1 ? `, há ${outside} meses seguidos` : ""}.` : ""} No mês: ${p2(h.m)}; no ano: ${p2(h.ytd)}.`, suggestions: ["O que significa estar acima da meta?", "Por que a inflação está nesse nível?", "O que acontece quando a meta é descumprida?"] }}
          bar={h.y12 != null ? bandBar(h.y12, meta) : undefined}
          rows={[["Meta", `${meta.center.toLocaleString("pt-BR")}% ± ${meta.tol.toLocaleString("pt-BR")} p.p.`], ["Situação", statusTxt, statusCls], ["No mês", p2(h.m)], ["No ano", p2(h.ytd)]]}
        />
        <MiniCard
          title="Selic (meta)" big={sNow ? `${sNow.v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "—"} caption={sNow ? `ao ano, definida pelo Copom · vigente em ${MES[sNow.month]} de ${sNow.year}` : "sem dados"}
          note="A taxa básica de juros da economia, definida pelo Comitê de Política Monetária (Copom) do Banco Central. Juros mais altos encarecem o crédito e esfriam a demanda, o que ajuda a segurar a inflação; juros mais baixos fazem o contrário."
          ask={{ title: "Selic (meta)", text: `Meta da Selic: ${sNow ? p2(sNow.v) : "?"} ao ano (${sNow ? `${MES[sNow.month]}/${sNow.year}` : "?"}). Há 12 meses: ${sAgo ? p2(sAgo.v) : "?"}. ${sChange ? `Última mudança em ${MES[sChange.month]}/${sChange.year}, de ${p2(sChange.from)}.` : ""} Focus (mediana) para o fim de ${year}: ${s0 ? p2(s0.median) : "?"}.`, suggestions: ["Por que o Banco Central muda a Selic?", "O que a Selic alta faz com a inflação?", "O mercado espera queda dos juros?"] }}
          rows={[["Há 12 meses", sAgo ? p2(sAgo.v) : "—"], ["Mudança em 12 meses", pts(sDiff), sDiff == null ? "" : sDiff > 0 ? "text-danger" : sDiff < 0 ? "text-ok" : ""], ["Última mudança", sChange ? `${MES[sChange.month].slice(0, 3)}/${sChange.year} (de ${p2(sChange.from)})` : "—"], [`Focus fim de ${year}`, s0 ? p2(s0.median) : "—"]]}
        />
        <MiniCard
          title="Juro real" big={p2(realNow)} caption="Selic descontada a inflação em 12 meses (cálculo do Política)"
          note="Quanto o juro rende acima da inflação: (1 + Selic) ÷ (1 + IPCA em 12 meses) − 1, olhando para trás. É um cálculo do Política com dados oficiais, não um número publicado pelo Banco Central. Juro real alto indica política monetária mais apertada."
          ask={{ title: "Juro real", text: `Juro real (ex-post): ${p2(realNow)} = Selic ${sNow ? p2(sNow.v) : "?"} descontado o IPCA em 12 meses ${p2(h.y12)}. Há 12 meses: ${p2(realAgo)}. Média dos últimos 10 anos: ${p2(real10)}. É um cálculo do Política: (1+Selic)/(1+IPCA 12m)−1.`, suggestions: ["O que é juro real?", "Juro real alto é bom ou ruim?", "Como o juro real afeta a economia?"] }}
          rows={[["Selic", sNow ? p2(sNow.v) : "—"], ["IPCA 12 meses", p2(h.y12)], ["Há 12 meses", p2(realAgo)], ["Média 10 anos", p2(real10)]]}
        />
        <MiniCard
          title={`Expectativa ${year}`} big={p2(f0?.median)} caption={f0 ? `mediana do Focus para o IPCA de ${year}${f0.median4w != null ? ` · há 4 semanas: ${p2(f0.median4w)}` : ""}` : "Focus indisponível"}
          note="O que os analistas de mercado esperam, segundo o boletim Focus do Banco Central (mediana das projeções). Mostra o IPCA esperado para o fim do ano e a Selic esperada, em comparação com a meta."
          ask={{ title: "Expectativas do mercado", text: `Focus (mediana): IPCA ${year}: ${p2(f0?.median)}; IPCA ${year + 1}: ${p2(f1?.median)}; próximos 12 meses: ${p2(d.focus.next12)}. Selic no fim de ${year}: ${p2(s0?.median)}; fim de ${year + 1}: ${p2(s1?.median)}. Meta: ${meta.label}.`, suggestions: ["O mercado espera inflação dentro da meta?", "O que é o boletim Focus?", "O que as expectativas indicam para a Selic?"] }}
          bar={f0 ? bandBar(f0.median, meta) : undefined}
          rows={[[`IPCA ${year + 1}`, p2(f1?.median)], ["IPCA 12 meses à frente", p2(d.focus.next12)], [`Selic fim de ${year}`, p2(s0?.median)], [`Selic fim de ${year + 1}`, p2(s1?.median)]]}
        />
      </section>

      <section aria-label="Evolução e expectativas" className="card p-4 sm:p-5">
        <p className="eyebrow">Inflação e juros</p>
        <div className="flex items-start justify-between gap-3">
          <h2 className="display text-2xl font-semibold">IPCA, Selic e juro real</h2>
        </div>
        <p className="mb-4 mt-1 max-w-3xl text-sm text-muted">As mesmas medidas dos cartões de cima ao longo do tempo. Escolha o período e ligue ou desligue cada linha. A faixa verde é o intervalo de tolerância da meta de inflação de cada ano; à direita, o que o mercado espera para o fim de cada ano.</p>
        <InflationTrend series={h.series} bands={bands} focus={d.focus.ipca} selic={d.selic ?? []} />
      </section>

      {d.focus.ipca.length > 0 && (
        <section aria-label="Expectativas do Focus">
          <p className="eyebrow">Mercado</p>
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="display text-2xl font-semibold">O que o mercado espera</h2>
            <AskButton focus={{ title: "Expectativas do Focus", text: `Focus (mediana) por ano: ${d.focus.ipca.map((f) => `IPCA ${f.year}: ${p2(f.median)} (intervalo ${f.min != null && f.max != null ? `${p2(f.min)} a ${p2(f.max)}` : "?"})`).join("; ")}. Selic: ${(d.focus.selic ?? []).map((f) => `${f.year}: ${p2(f.median)}`).join("; ")}. Meta: ${meta.label}.`, suggestions: ["Como ler esta tabela?", "A expectativa está acima da meta?", "O que a Selic esperada indica?"] }} />
          </div>
          <FocusTable ipca={d.focus.ipca} selic={d.focus.selic ?? []} />
        </section>
      )}

      {(d.groups.length > 0 || d.bc.length > 0 || d.cores.length > 0) && (
        <section aria-label="Pilares da inflação">
          <p className="eyebrow">Pilares</p>
          <div className="flex items-start justify-between gap-3">
            <h2 className="display text-2xl font-semibold">O que puxa a inflação</h2>
            <AskButton focus={{ title: "Pilares da inflação", text: `Inflação em 12 meses por grupo do IPCA:\n${pillarText(d.groups, INTL)}\nPor tipo de preço:\n${pillarText(d.bc, INTL)}\nNúcleos:\n${pillarText(d.cores, INTL)}`, suggestions: ["O que mais está pressionando a inflação?", "O que são núcleos da inflação?", "Quais grupos estão acima da meta?"] }} />
          </div>
          <p className="mb-3 mt-1 text-sm text-muted">O IPCA mede a variação de preços de uma cesta com centenas de itens. Aqui ele aparece dividido em pilares, comparado com a meta ou com o padrão internacional. Toque num cabeçalho para ordenar e em ▸ para abrir os itens.</p>
          <InflationPillars groups={d.groups} bc={d.bc} cores={d.cores} intl={INTL} br={meta} headline={h.y12} />
        </section>
      )}

      {d.errors.length > 0 && <Notice kind="info">Algumas fontes não responderam agora ({d.errors.join(", ")}); parte do painel pode estar incompleta.</Notice>}
    </div>
  );
}

/** Tabela das expectativas do Focus por ano: IPCA (com a meta) e Selic. */
function FocusTable({ ipca, selic }: { ipca: InflationData["focus"]["ipca"]; selic: NonNullable<InflationData["focus"]["selic"]> }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[640px] border-collapse whitespace-nowrap text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="px-3 py-2 text-left font-medium">Ano</th>
            <th className="px-3 py-2 text-right font-medium">IPCA (mediana)</th>
            <th className="px-3 py-2 text-right font-medium">Há 4 semanas</th>
            <th className="px-3 py-2 text-right font-medium">Mín – máx</th>
            <th className="px-3 py-2 text-right font-medium">Meta</th>
            <th className="px-3 py-2 text-right font-medium">Situação</th>
            <th className="px-3 py-2 text-right font-medium">Selic (mediana)</th>
          </tr>
        </thead>
        <tbody>
          {ipca.map((f) => (
            <tr key={f.year} className="border-t border-line">
              <td className="px-3 py-2 font-semibold">{f.year}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{p2(f.median)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{p2(f.median4w)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{f.min != null && f.max != null ? `${p2(f.min)} – ${p2(f.max)}` : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{cmnMeta(f.year).center.toLocaleString("pt-BR")}%</td>
              <td className="px-3 py-2 text-right"><StatusChip v={f.median} band={cmnMeta(f.year)} /></td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{p2(selic.find((s) => s.year === f.year)?.median)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28" />)}</div>
      <div className="skeleton h-[22rem]" />
      <div className="skeleton h-[28rem]" />
    </div>
  );
}

async function Content() {
  const d = await getInflation();
  return (
    <>
      {d ? <Detail d={d} /> : <EmptyState title="Dados indisponíveis">Não consegui buscar o IPCA no IBGE e no Banco Central agora. Tente novamente em alguns minutos.</EmptyState>}
      <div className="mt-8 max-w-3xl">
        <Notice kind="info">
          Fontes: IBGE (IPCA, tabela 7060 do SIDRA), Banco Central (classificações e núcleos do IPCA, no SGS; expectativas do boletim Focus) e Conselho Monetário Nacional (meta). O IPCA é a inflação oficial do país, medida nas principais regiões metropolitanas.
          {d && <> Dados consultados em {new Date(d.fetchedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</>}
        </Notice>
      </div>
    </>
  );
}

export default async function InflacaoPage() {
  await requireUser();
  return (
    <div>
      <PageHeader eyebrow="Números · Brasil · IBGE e Banco Central" title="Inflação e juros" />
      <NationalOnly>Dado nacional: o IPCA é medido nas principais regiões metropolitanas e vale para todo o país.</NationalOnly>
      <Suspense fallback={<Skeleton />}>
        <Content />
      </Suspense>
    </div>
  );
}
