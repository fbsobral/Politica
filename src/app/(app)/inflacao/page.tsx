import { Suspense } from "react";
import { AskButton } from "@/components/agent/ask-button";
import { InflationPillars, InflationTrend, StatusChip } from "@/components/inflation-charts";
import { EmptyState, NationalOnly, Notice, PageHeader, StatTile } from "@/components/ui";
import { requireUser } from "@/lib/user";
import { cmnMeta, getInflation, INTL, statusOf, type Band, type InflationData, type Pillar } from "@/lib/inflation";

export const metadata = { title: "Inflação" };
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
  const bands: Record<number, Band> = {};
  for (let y = year - 7; y <= year + 3; y++) bands[y] = cmnMeta(y);
  // meta contínua (desde 2025): descumprimento = 6 meses seguidos fora do intervalo
  const s = h.series;
  let outside = 0;
  for (let i = s.length - 1; i >= 0 && statusOf(s[i].v, cmnMeta(s[i].year)) !== "dentro"; i--) outside++;
  const st = h.y12 != null ? statusOf(h.y12, meta) : null;

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo">
        <StatTile label="IPCA em 12 meses" value={p2(h.y12)} hint={ref ? `até ${MES[ref.month]} de ${ref.year}` : undefined}>
          <p className="mt-1"><StatusChip v={h.y12} band={meta} /></p>
        </StatTile>
        <StatTile label="Meta do governo" value={`${meta.center.toLocaleString("pt-BR")}%`} hint={`intervalo de ${p2(meta.center - meta.tol, 1)} a ${p2(meta.center + meta.tol, 1)} (CMN)`} />
        <StatTile label={`Expectativa ${year}`} value={p2(f0?.median)} hint={f0 ? `mediana do Focus${f0.median4w != null ? ` · há 4 semanas: ${p2(f0.median4w)}` : ""}` : "Focus indisponível"}>
          {f0 && <p className="mt-1"><StatusChip v={f0.median} band={meta} /></p>}
        </StatTile>
        <StatTile label={`Expectativa ${year + 1}`} value={p2(f1?.median)} hint={d.focus.next12 != null ? `próximos 12 meses: ${p2(d.focus.next12)}` : "mediana do Focus"}>
          {f1 && <p className="mt-1"><StatusChip v={f1.median} band={cmnMeta(year + 1)} /></p>}
        </StatTile>
      </section>

      {st && (
        <p className={`max-w-3xl rounded-xl px-4 py-3 text-sm ${st === "dentro" ? "bg-ok/10" : "bg-danger/10"}`}>
          {st === "dentro"
            ? <>A inflação em 12 meses está <b>dentro do intervalo da meta</b>.</>
            : <>A inflação em 12 meses está <b>{st} do intervalo da meta</b> {outside > 1 ? `há ${outside} meses seguidos` : "neste mês"}.{year >= 2025 && outside >= 6 ? " Pela regra da meta contínua, 6 meses seguidos fora do intervalo contam como descumprimento, e o Banco Central precisa explicar o motivo em carta pública." : year >= 2025 ? ` Pela regra da meta contínua, a meta é descumprida se ficar 6 meses seguidos fora do intervalo.` : ""}</>}
          {h.m != null && <> No último mês, os preços variaram {p2(h.m)}{h.ytd != null ? `; no ano, ${p2(h.ytd)}` : ""}.</>}
        </p>
      )}

      <section aria-label="Evolução e expectativas">
        <p className="eyebrow">Inflação geral e expectativa futura</p>
        <div className="flex items-start justify-between gap-3">
          <h2 className="display text-2xl font-semibold">IPCA em 12 meses x meta</h2>
          <AskButton focus={{ title: "Inflação e expectativas", text: `IPCA em 12 meses: ${p2(h.y12)}${ref ? ` (até ${MES[ref.month]}/${ref.year})` : ""}. Meta: ${meta.label}. Expectativas do Focus (mediana): ${d.focus.ipca.map((f) => `${f.year}: ${p2(f.median)}`).join("; ")}.`, suggestions: ["A inflação está sob controle?", "Por que o mercado espera essa inflação?", "O que o Banco Central faz quando a inflação sai da meta?"] }} />
        </div>
        <p className="mb-4 mt-1 max-w-3xl text-sm text-muted">A faixa verde é o intervalo de tolerância da meta de cada ano. À direita, o que o mercado espera para o fim de cada ano, com a faixa entre a menor e a maior projeção.</p>
        <InflationTrend series={h.series} bands={bands} focus={d.focus.ipca} />
        {d.focus.ipca.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-faint">
                <tr><th className="p-3">Ano</th><th className="p-3 text-right">Mediana</th><th className="p-3 text-right">Há 4 semanas</th><th className="p-3 text-right">Mín – máx</th><th className="p-3 text-right">Meta</th><th className="p-3 text-right">Situação</th></tr>
              </thead>
              <tbody>
                {d.focus.ipca.map((f) => (
                  <tr key={f.year} className="border-b border-line last:border-0">
                    <td className="p-3 font-medium">{f.year}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{p2(f.median)}</td>
                    <td className="p-3 text-right tabular-nums">{p2(f.median4w)}</td>
                    <td className="p-3 text-right tabular-nums">{f.min != null && f.max != null ? `${p2(f.min)} – ${p2(f.max)}` : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{cmnMeta(f.year).center.toLocaleString("pt-BR")}%</td>
                    <td className="p-3 text-right"><StatusChip v={f.median} band={cmnMeta(f.year)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(d.groups.length > 0 || d.bc.length > 0 || d.cores.length > 0) && (
        <section aria-label="Pilares da inflação">
          <p className="eyebrow">Pilares</p>
          <div className="flex items-start justify-between gap-3">
            <h2 className="display text-2xl font-semibold">O que puxa a inflação</h2>
            <AskButton focus={{ title: "Pilares da inflação", text: `Inflação em 12 meses por grupo do IPCA:\n${pillarText(d.groups, INTL)}\nPor tipo de preço:\n${pillarText(d.bc, INTL)}\nNúcleos:\n${pillarText(d.cores, INTL)}`, suggestions: ["Qual grupo mais pesa na inflação agora?", "Por que serviços sobem mais que bens?", "O que são preços monitorados?"] }} />
          </div>
          <p className="mb-4 mt-1 max-w-3xl text-sm text-muted">O IPCA mede a variação de preços de uma cesta com centenas de itens. Aqui ele aparece dividido em pilares, cada um com seus indicadores, e comparado com a meta.</p>
          <InflationPillars groups={d.groups} bc={d.bc} cores={d.cores} intl={INTL} br={meta} headline={h.y12} />
        </section>
      )}

      {d.errors.length > 0 && <Notice kind="info">Algumas fontes não responderam agora ({d.errors.join(", ")}); parte do painel pode estar incompleta.</Notice>}
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
      <PageHeader eyebrow="Números · Brasil · IBGE e Banco Central" title="Inflação" />
      <NationalOnly>Dado nacional: o IPCA é medido nas principais regiões metropolitanas e vale para todo o país.</NationalOnly>
      <Suspense fallback={<Skeleton />}>
        <Content />
      </Suspense>
    </div>
  );
}
