"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { markTourSeen } from "@/app/actions";
import { IconBell, IconCalendar, IconChart, IconCoins, IconCompass, IconFeed, IconFilter, IconFlag, IconLogo, IconPeople, IconShield, IconStar, IconVote } from "@/components/icons";
import { findModuleTour, generalTour, type Tour } from "@/lib/tours";

export const TOUR_EVENT = "tour:open";

/** Abre o tour da tela atual (ou o geral, com detail "geral"). */
export function openTour(which?: "geral") {
  window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: which }));
}

const IconAsk = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.2M12 16.5h.01" /></svg>
);
const IconTarget = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
);
const IconList = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M4 6h10M4 12h16M4 18h7" /></svg>
);
const IconDoc = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
);

const ART: Record<string, React.ReactNode> = {
  logo: <IconLogo />, feed: <IconFeed />, people: <IconPeople />, calendar: <IconCalendar />, chart: <IconChart />, ask: <IconAsk />, bell: <IconBell />,
  filter: <IconFilter />, star: <IconStar />, flag: <IconFlag />, compass: <IconCompass />, vote: <IconVote />, shield: <IconShield />, coins: <IconCoins />,
  target: <IconTarget />, list: <IconList />, doc: <IconDoc />,
};

/** Rotas onde nenhum tour abre sozinho. */
const QUIET = ["/admin", "/configuracoes", "/mais"];

/**
 * Tours de boas-vindas: o geral abre no primeiro acesso; depois, o de cada módulo abre na primeira visita à tela.
 * No celular é uma folha que sobe de baixo (arraste para o lado para avançar); no computador, uma janela central.
 */
export function Onboarding({ seen: initialSeen, city }: { seen: string[]; city: string }) {
  const path = usePathname();
  const [seen, setSeen] = useState(() => new Set(initialSeen));
  const [tour, setTour] = useState<Tour | null>(null);
  const [step, setStep] = useState(0);
  const [, start] = useTransition();
  const ref = useRef<HTMLDialogElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  // depois do tour geral, não empilha o tour da tela atual
  const skipAutoFor = useRef<string | null>(null);
  const general = useMemo(() => generalTour(city), [city]);

  const show = useCallback((t: Tour) => {
    setTour(t);
    setStep(0);
  }, []);

  useEffect(() => {
    if (tour) {
      if (!ref.current?.open) ref.current?.showModal();
      // o showModal foca o primeiro botão (Pular); o foco certo é o botão principal
      ref.current?.querySelector<HTMLButtonElement>("[data-primary]")?.focus();
    } else if (ref.current?.open) ref.current.close();
  }, [tour]);

  // abertura automática
  useEffect(() => {
    if (tour || QUIET.some((q) => path.startsWith(q))) return;
    if (!seen.has("geral")) {
      const id = setTimeout(() => show(general), 400);
      return () => clearTimeout(id);
    }
    if (skipAutoFor.current === path) return;
    const mod = findModuleTour(path);
    if (mod && !seen.has(mod.id)) {
      const id = setTimeout(() => show(mod), 700);
      return () => clearTimeout(id);
    }
  }, [path, seen, tour, general, show]);

  // botão "?" do topo
  useEffect(() => {
    const onOpen = (e: Event) => {
      const which = (e as CustomEvent<string | undefined>).detail;
      show(which === "geral" ? general : findModuleTour(path) ?? general);
    };
    window.addEventListener(TOUR_EVENT, onOpen);
    return () => window.removeEventListener(TOUR_EVENT, onOpen);
  }, [path, general, show]);

  const finish = useCallback(() => {
    const t = tour;
    if (!t) return;
    setTour(null);
    if (t.id === "geral") skipAutoFor.current = path;
    if (!seen.has(t.id)) {
      setSeen((s) => new Set(s).add(t.id));
      start(() => void markTourSeen(t.id).catch(() => undefined));
    }
  }, [tour, path, seen]);

  if (!tour) return <dialog ref={ref} className="hidden" aria-hidden />;

  const s = tour.steps[step];
  const last = step === tour.steps.length - 1;
  const next = () => (last ? finish() : setStep(step + 1));
  const prev = () => setStep(Math.max(0, step - 1));

  return (
    <dialog
      ref={ref}
      aria-labelledby="tour-title"
      onCancel={(e) => {
        e.preventDefault();
        finish();
      }}
      onClick={(e) => {
        if (e.target === ref.current) finish();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") prev();
      }}
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const t0 = touch.current;
        touch.current = null;
        if (!t0) return;
        const dx = e.changedTouches[0].clientX - t0.x;
        const dy = e.changedTouches[0].clientY - t0.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-hidden rounded-t-3xl border-0 bg-surface p-0 font-sans text-ink shadow-pop backdrop:bg-black/55 backdrop:backdrop-blur-sm sm:inset-0 sm:m-auto sm:h-fit sm:max-w-lg sm:rounded-3xl"
    >
      <div className="flex max-h-[90dvh] flex-col">
        {/* topo: alça (celular), progresso e pular */}
        <div className="flex items-center gap-3 px-5 pb-2 pt-3 sm:pt-5">
          <span className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">{tour.id === "geral" ? "Boas-vindas" : `Como funciona · ${tour.name}`}</span>
          <button type="button" onClick={finish} className="ml-auto rounded-full px-2.5 py-1 text-sm font-medium text-muted hover:bg-ink/5 hover:text-ink">{last ? "Fechar" : "Pular"}</button>
        </div>

        <div className="overflow-y-auto px-5 pb-4 sm:px-7" aria-live="polite">
          <div key={`${tour.id}-${step}`} className="tour-step">
            <div className="relative mb-5 mt-1 flex h-28 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft sm:h-32" aria-hidden>
              <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(60% 80% at 20% 0%, color-mix(in srgb, var(--gold) 28%, transparent), transparent 70%), radial-gradient(50% 70% at 90% 100%, color-mix(in srgb, var(--brand) 18%, transparent), transparent 70%)" }} />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-surface text-brand shadow-card [&_svg]:h-8 [&_svg]:w-8">{ART[s.art ?? "logo"] ?? ART.logo}</span>
            </div>
            <h2 id="tour-title" className="display text-2xl font-semibold leading-tight sm:text-[1.7rem]">{s.title}</h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{s.text}</p>
            {s.tips && (
              <ul className="mt-4 space-y-2">
                {s.tips.map((t) => (
                  <li key={t} className="flex gap-2.5 text-sm leading-snug">
                    <span className="mt-[3px] flex h-4 w-4 flex-none items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-brand" aria-hidden>✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            )}
            {s.links && (
              <div className="mt-4 flex flex-wrap gap-2">
                {s.links.map((l) => (
                  <Link key={l.href} href={l.href} onClick={finish} className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-semibold text-brand hover:border-brand hover:bg-brand-soft">
                    {l.label} →
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* rodapé fixo: pontos e botões grandes (bom para o polegar) */}
        <div className="flex items-center gap-3 border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-7 sm:pb-5">
          {tour.steps.length > 1 && (
            <div className="flex gap-1.5" role="tablist" aria-label="Passos">
              {tour.steps.map((_, i) => (
                <button key={i} type="button" role="tab" aria-selected={i === step} aria-label={`Passo ${i + 1} de ${tour.steps.length}`} onClick={() => setStep(i)} className="flex h-6 items-center">
                  <span className={`block h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-brand" : "w-1.5 bg-line-strong"}`} />
                </button>
              ))}
            </div>
          )}
          <div className="ml-auto flex gap-2">
            {step > 0 && <button type="button" onClick={prev} className="btn btn-secondary !px-4">Voltar</button>}
            <button type="button" onClick={next} className="btn btn-primary !px-5" data-primary>
              {last ? (tour.id === "geral" ? "Começar" : "Entendi") : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

/** Botão "?" do topo: reabre o tour da tela atual. */
export function TourButton() {
  return (
    <button type="button" onClick={() => openTour()} aria-label="Como funciona esta tela" title="Como funciona esta tela" className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-line bg-surface text-sm font-bold text-muted hover:text-ink">
      ?
    </button>
  );
}

/** Link/botão para rever o tour geral (página Mais). */
export function GeneralTourButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => openTour("geral")} className={className}>
      {children}
    </button>
  );
}
