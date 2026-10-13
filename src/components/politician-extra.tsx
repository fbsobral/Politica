import { Suspense } from "react";
import type { Politician } from "@prisma/client";
import { camaraBills, camaraSpending, senadoBills, type Bill } from "@/lib/open-data";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Skeleton() {
  return <div className="space-y-2.5">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16" />)}</div>;
}

function Unavailable({ what }: { what: string }) {
  return <p className="card-flat p-4 text-sm text-muted">{what} indisponíveis no momento (a fonte oficial não respondeu). Tente novamente mais tarde.</p>;
}

async function Bills({ p }: { p: Politician }) {
  let bills: Bill[] = [];
  try {
    if (p.role === "DEPUTADO_FEDERAL" && p.externalKey.startsWith("camara:")) bills = await camaraBills(p.externalKey.slice(7));
    else if (p.role === "SENADOR" && p.externalKey.startsWith("senado:")) bills = await senadoBills(p.externalKey.slice(7));
  } catch {
    return <Unavailable what="Projetos" />;
  }
  if (!bills.length) return <p className="card-flat p-4 text-sm text-muted">Nenhum projeto de lei recente de autoria encontrado.</p>;
  return (
    <ul className="space-y-2.5">
      {bills.map((b) => (
        <li key={b.id}>
          <a href={b.url} target="_blank" rel="noopener noreferrer" className="card-flat block p-4 transition-shadow hover:shadow-card">
            <div className="mb-1 flex items-center gap-2"><span className="chip !bg-brand-soft !text-brand">{b.title}</span></div>
            <p className="line-clamp-3 text-sm leading-relaxed text-muted">{b.ementa}</p>
          </a>
        </li>
      ))}
    </ul>
  );
}

async function Spending({ p }: { p: Politician }) {
  let s;
  try {
    s = await camaraSpending(p.externalKey.slice(7));
  } catch {
    return <Unavailable what="Gastos" />;
  }
  if (!s) return <p className="card-flat p-4 text-sm text-muted">A Câmara não retornou despesas da cota parlamentar para este mandato.</p>;
  const max = s.byType[0]?.total || 1;
  return (
    <div className="card p-5">
      <p className="eyebrow">Cota parlamentar · {s.year}</p>
      <p className="display mt-1 text-3xl font-semibold">{brl(s.total)}</p>
      <p className="text-xs text-faint">{s.count} notas fiscais declaradas</p>
      <ul className="mt-4 space-y-3">
        {s.byType.map((t) => (
          <li key={t.type}>
            <div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate text-muted">{t.type.toLowerCase()}</span><b className="flex-none">{brl(t.total)}</b></div>
            <div className="h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(3, (t.total / max) * 100)}%` }} /></div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-faint">Fonte: Câmara dos Deputados (dados abertos).</p>
    </div>
  );
}

/** Projetos de autoria e gastos — carregados da fonte oficial, sem travar o resto da página. */
export function PoliticianExtra({ p }: { p: Politician }) {
  const isDep = p.role === "DEPUTADO_FEDERAL";
  const isSen = p.role === "SENADOR";
  if (!isDep && !isSen) return null;
  return (
    <div className={`grid grid-cols-1 gap-8 ${isDep ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
      <section className="space-y-3">
        <h2 className="display text-2xl font-semibold">Projetos de autoria</h2>
        <Suspense fallback={<Skeleton />}><Bills p={p} /></Suspense>
      </section>
      {isDep && (
        <section className="space-y-3">
          <h2 className="display text-2xl font-semibold">Gastos</h2>
          <Suspense fallback={<div className="skeleton h-64" />}><Spending p={p} /></Suspense>
        </section>
      )}
    </div>
  );
}
