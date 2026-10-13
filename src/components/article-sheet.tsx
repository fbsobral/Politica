"use client";

import { useEffect, useRef, useState } from "react";

export type SheetData = {
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  publishedAt: string;
  sourceName: string;
  sourceType: string;
  tier: number | null;
  categoryLabel: string;
  branchLabel: string | null;
  related: { source: string; url: string; title: string }[];
};

const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

/** Título clicável que abre a matéria numa "folha" dentro do app (sem abrir nova aba). */
export function ArticleSheet({ data, className, children }: { data: SheetData; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function openOriginal() {
    // celular: mesma aba (o botão voltar do navegador devolve ao feed); desktop: nova aba
    if (window.matchMedia("(max-width: 767px)").matches) window.location.href = data.url;
    else window.open(data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          ref.current?.showModal();
          setOpen(true);
        }}
        className={className}
      >
        {children}
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close(); // clique no fundo escurecido
        }}
        aria-label={data.title}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border-0 bg-surface p-0 text-ink shadow-pop backdrop:bg-black/55 backdrop:backdrop-blur-sm sm:inset-auto sm:m-auto sm:max-h-[85vh] sm:max-w-xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-3 backdrop-blur">
          <span className="mx-auto h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <span className="hidden text-xs font-semibold text-muted sm:block">{data.sourceName}</span>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar" className="absolute right-3 top-2.5 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink">✕</button>
        </div>

        {data.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.imageUrl} alt="" referrerPolicy="no-referrer" className="aspect-[16/8] w-full bg-line object-cover" />
        )}

        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <b className="text-ink">{data.sourceName}</b>
            <span>· {data.sourceType}</span>
            {data.tier && <span className="rounded bg-ink/8 px-1.5 py-px text-[10px] font-bold">T{data.tier}</span>}
            <span>· {when(data.publishedAt)}</span>
          </div>
          <h2 className="display text-2xl font-semibold leading-tight">{data.title}</h2>
          {data.description && <p className="text-[0.95rem] leading-relaxed text-muted">{data.description}</p>}
          <div className="flex flex-wrap gap-2">
            <span className="chip !bg-brand-soft !text-brand">{data.categoryLabel}</span>
            {data.branchLabel && <span className="chip">{data.branchLabel}</span>}
          </div>

          {data.related.length > 0 && (
            <div className="rounded-2xl border border-line p-4">
              <p className="eyebrow mb-2">Mesmo assunto em outros veículos</p>
              <ul className="space-y-2">
                {data.related.map((r) => (
                  <li key={r.url} className="text-sm">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{r.title}</a>
                    <span className="text-faint"> — {r.source}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button type="button" onClick={openOriginal} className="btn btn-primary flex-1">Ler a matéria completa →</button>
            <button type="button" onClick={() => ref.current?.close()} className="btn btn-secondary sm:w-32">Fechar</button>
          </div>
          <p className="text-[11px] leading-relaxed text-faint">A matéria completa abre no site do veículo ({data.sourceName}). Muitos sites não permitem ser exibidos dentro de outros apps, por isso mostramos o resumo aqui.</p>
        </div>
      </dialog>
    </>
  );
}
