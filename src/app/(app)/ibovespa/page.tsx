import { Suspense } from "react";
import { AskButton } from "@/components/agent/ask-button";
import { IbovespaPanel } from "@/components/ibovespa-chart";
import { EmptyState, Notice, PageHeader } from "@/components/ui";
import { getIbovespa, MOVE_MIN, THEMES, type IbovData } from "@/lib/ibovespa";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Ibovespa" };
export const dynamic = "force-dynamic";

const pc = (v: number | null, d = 2) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })}%`);
const tone = (v: number | null) => (v == null ? "" : v >= 0 ? "text-ok" : "text-danger");

/** Variação desde o último pregão anterior a uma data. */
function since(d: IbovData, iso: string): number | null {
  const base = [...d.points].reverse().find((p) => p.d < iso);
  const last = d.points[d.points.length - 1];
  return base ? (last.close / base.close - 1) * 100 : null;
}

function Detail({ d }: { d: IbovData }) {
  const pts = d.points;
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const day = prev ? (last.close / prev.close - 1) * 100 : null;
  const ytd = since(d, `${last.d.slice(0, 4)}-01-01`);
  const y12 = since(d, new Date(Date.parse(last.d) - 365 * 864e5).toISOString().slice(0, 10));
  const themes = Object.fromEntries(THEMES.map((t) => [t.id, t.name]));
  const recent = d.moves.slice(-6).reverse();
  const [yy, mm, dd] = last.d.split("-");
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo">
        {[
          ["Fechamento", `${Math.round(last.close).toLocaleString("pt-BR")}`, `pontos em ${dd}/${mm}/${yy}`, ""],
          ["No dia", pc(day), "último pregão", tone(day)],
          ["No ano", pc(ytd, 1), `desde 1º de janeiro de ${yy}`, tone(ytd)],
          ["Em 12 meses", pc(y12, 1), "últimos 365 dias", tone(y12)],
        ].map(([l, v, h, c]) => (
          <div key={l} className="card-flat p-4">
            <p className="eyebrow">{l}</p>
            <p className={`display mt-1 text-2xl font-semibold leading-tight sm:text-3xl ${c}`}>{v}</p>
            <p className="mt-0.5 text-xs text-faint">{h}</p>
          </div>
        ))}
      </section>
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted">O Ibovespa é o principal índice da bolsa brasileira (B3): reúne as ações mais negociadas, como Petrobras, Vale e os grandes bancos. Os marcadores no gráfico mostram os dias de alta ou queda de {MOVE_MIN.toLocaleString("pt-BR")}% ou mais, ligados às matérias publicadas naquele dia.</p>
        <AskButton focus={{ title: "Ibovespa", text: `Ibovespa: ${Math.round(last.close).toLocaleString("pt-BR")} pontos em ${dd}/${mm}/${yy}; no dia ${pc(day)}, no ano ${pc(ytd, 1)}, em 12 meses ${pc(y12, 1)}. Dias fortes recentes:\n${recent.map((m) => `- ${m.d}: ${pc(m.ret)}; temas: ${m.themes.slice(0, 3).map((t) => themes[t.id]).join(", ") || "sem notícias"}; manchetes: ${m.articles.slice(0, 3).map((a) => a.title).join(" | ")}`).join("\n")}`, suggestions: ["Por que a bolsa caiu nos últimos dias?", "O que os juros têm a ver com a bolsa?", "A política está mexendo com o mercado?"] }} />
      </div>
      <IbovespaPanel data={d} themes={themes} />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-24" />)}</div>
      <div className="skeleton h-[22rem]" />
      <div className="skeleton h-64" />
    </div>
  );
}

async function Content() {
  const d = await getIbovespa();
  return (
    <>
      {d && d.points.length > 2 ? <Detail d={d} /> : <EmptyState title="Dados indisponíveis">Não consegui buscar a cotação do Ibovespa agora. Tente novamente em alguns minutos.</EmptyState>}
      <div className="mt-8 max-w-3xl">
        <Notice kind="info">
          Fontes: cotação de fechamento do Ibovespa ({d?.source ?? "B3"}), dólar PTAX e meta da Selic (Banco Central) e as matérias coletadas pelo app. O motivo de cada dia é uma inferência a partir das notícias e não uma recomendação de investimento.
          {d && <> Dados consultados em {new Date(d.fetchedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}.</>}
        </Notice>
      </div>
    </>
  );
}

export default async function IbovespaPage() {
  await requireUser();
  return (
    <div>
      <PageHeader eyebrow="Números · bolsa de valores · até 5 anos" title="Ibovespa" />
      <Suspense fallback={<Skeleton />}>
        <Content />
      </Suspense>
    </div>
  );
}
