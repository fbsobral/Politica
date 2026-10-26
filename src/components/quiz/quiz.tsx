"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { saveMyParty, saveQuiz } from "@/app/actions";
import { AskButton } from "@/components/agent/ask-button";
import { NineBox } from "@/components/quiz/nine-box";
import { Radar } from "@/components/quiz/radar";
import { slugOf } from "@/lib/parties";
import { PARTIES, PILLARS, ROUND_TITLE, SEAL_LABEL, type Pillar } from "@/lib/quiz/data";
import { DEFAULT_WEIGHTS, ECON_LABEL, CUST_LABEL, computeResult, partyPositions, cellKey, questionsOfRound, type Answers, type Scored, type Weights } from "@/lib/quiz/calc";
import { describePillar, fmtPos, radarBand, shortBand } from "@/lib/quiz/describe";

type Step = "intro" | 1 | 2 | 3 | "pesos" | "resultado";
const fmt = (n: number) => n.toFixed(1).replace(".", ",").replace("-", "−");
const PESO_LABEL: Record<number, string> = { 3: "Importa muito", 2: "Normal", 1: "Importa pouco", 0: "Não importa" };

function Progress({ step }: { step: Step }) {
  const order: Step[] = ["intro", 1, 2, 3, "pesos", "resultado"];
  const i = order.indexOf(step);
  return (
    <div className="mb-5" role="progressbar" aria-valuemin={0} aria-valuemax={order.length - 1} aria-valuenow={i} aria-label="Progresso do quiz">
      <div className="flex gap-1.5">{order.slice(1).map((s, k) => <span key={String(s)} className={`h-1.5 flex-1 rounded-full ${k < i ? "bg-brand" : "bg-line"}`} />)}</div>
    </div>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  const grid = useMemo(() => {
    const g: Record<string, ReturnType<typeof partyPositions>> = {};
    for (const p of partyPositions().filter((x) => x.party.box === null)) (g[cellKey(p.eco, p.cus)] ??= []).push(p);
    for (const k of Object.keys(g)) g[k].sort((a, b) => a.party.sigla.localeCompare(b.party.sigla, "pt-BR"));
    return g;
  }, []);
  const mixed = useMemo(() => partyPositions().filter((p) => p.party.box === "mixed").map((p) => p.party.sigla), []);
  const undef = useMemo(() => partyPositions().filter((p) => p.party.box === "undefined").map((p) => p.party.sigla), []);
  return (
    <div className="space-y-8">
      <section className="card p-5 sm:p-8">
        <p className="eyebrow">Você</p>
        <h1 className="display text-3xl font-semibold leading-tight sm:text-4xl">Você ainda não descobriu seu perfil político</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Responda ao quiz e seu perfil fica salvo aqui. Ele mostra o quanto suas ideias estão próximas das de cada partido. <b className="text-ink">Não é recomendação de voto.</b> São 3 rodadas de 4 perguntas e, no final, uma pergunta sobre suas prioridades.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={onStart} className="btn btn-primary">Fazer o quiz agora</button>
        </div>
      </section>

      <section className="card p-5 sm:p-8" aria-label="Como funciona o enquadramento">
        <h2 className="display text-2xl font-semibold">Como seu perfil é enquadrado</h2>
        <p className="mb-5 mt-1 max-w-3xl text-sm text-muted">
          Suas respostas viram duas notas, uma em <b className="text-ink">Economia</b> (de “Mais Estado” a “Mais mercado”) e outra em <b className="text-ink">Costumes</b> (de “Progressista” a “Conservador”). O cruzamento das duas coloca você em uma das 9 caixas abaixo, e os partidos mais próximos de você são os da sua caixa.
        </p>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <NineBox grid={grid} />
          <ul className="space-y-3 text-sm text-muted">
            <li><b className="text-ink">Economia:</b> papel do Estado, impostos, privatização, renda, e também meio ambiente e educação.</li>
            <li><b className="text-ink">Costumes:</b> drogas, aborto, identidade, e também armas, segurança e educação.</li>
            <li><b className="text-ink">Suas prioridades pesam:</b> no final você diz o que importa mais; isso pode mudar a caixa e o ranking.</li>
            <li><b className="text-ink">Perto da borda?</b> Se você estiver perto da divisa de uma caixa, mostramos também os partidos da caixa vizinha.</li>
            <li><b className="text-ink">Estilo</b> (alianças, negociação, coerência) fica de fora do mapa e vira um selo: “Mantém posição”, “Negocia amplo” ou “Renovação”.</li>
            <li>A posição de cada partido é uma estimativa nossa, com programa, estatuto, alianças e votações. Clique na sigla para ver o perfil do partido.</li>
          </ul>
        </div>
        {(mixed.length > 0 || undef.length > 0) && (
          <div className="mt-5 space-y-1 text-sm text-muted">
            {mixed.length > 0 && <p><b className="text-ink">Sem caixa única</b> (posições variadas entre bancadas): {mixed.join(", ")}.</p>}
            {undef.length > 0 && <p><b className="text-ink">Perfil pouco definido</b> (pouca informação): {undef.join(", ")}.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

function Round({ round, answers, setAnswer, onBack, onNext }: { round: 1 | 2 | 3; answers: Answers; setAnswer: (n: number, v: "a" | "b" | "c" | "x") => void; onBack: () => void; onNext: () => void }) {
  const qs = questionsOfRound(round);
  const done = qs.every((q) => answers[q.n]);
  return (
    <div>
      <p className="eyebrow">Rodada {round} de 3</p>
      <h2 className="display mb-5 text-2xl font-semibold sm:text-3xl">{ROUND_TITLE[round]}</h2>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {qs.map((q, idx) => (
          <fieldset key={q.n} className="card p-4 sm:p-5">
            <legend className="sr-only">{q.title}</legend>
            <p className="mb-1 text-xs font-semibold text-faint">Pergunta {q.n} de 12</p>
            <h3 className="text-base font-semibold sm:text-lg">{idx + 1}. {q.title}</h3>
            {q.intro && <p className="mt-1 text-sm text-muted">{q.intro}</p>}
            <div className="mt-3 grid gap-2">
              {q.options.map((o) => {
                const on = answers[q.n] === o.key;
                return (
                  <button key={o.key} type="button" onClick={() => setAnswer(q.n, o.key)} aria-pressed={on} className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors ${on ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-line-strong"}`}>
                    <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border text-[11px] font-bold ${on ? "border-brand bg-brand text-white" : "border-line-strong text-faint"}`}>{on ? "✓" : o.key}</span>
                    <span>{o.text}</span>
                  </button>
                );
              })}
              {q.pillar === "estilo" && (
                <>
                  <button type="button" onClick={() => setAnswer(q.n, "x")} aria-pressed={answers[q.n] === "x"} className={`rounded-xl border px-3.5 py-2.5 text-left text-sm ${answers[q.n] === "x" ? "border-brand bg-brand-soft" : "border-dashed border-line bg-surface text-muted hover:border-line-strong"}`}>Não sei / tanto faz</button>
                  <details className="text-xs text-muted">
                    <summary className="cursor-pointer font-semibold">Em dúvida?</summary>
                    <p className="mt-1">Se o partido puder aprovar metade do que quer com a ajuda de um rival, ou aprovar nada e manter a posição pura, qual você prefere? Metade = capacidade de negociar. Posição pura = coerência.</p>
                  </details>
                </>
              )}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="btn btn-ghost">← Voltar</button>
        <button type="button" disabled={!done} onClick={onNext} className="btn btn-primary">{round === 3 ? "Ir para as prioridades" : "Próxima rodada"} →</button>
      </div>
      {!done && <p className="mt-2 text-right text-xs text-faint">Responda as 4 perguntas para continuar.</p>}
    </div>
  );
}

function Weighing({ weights, setWeights, hasStyle, onBack, onDone }: { weights: Weights; setWeights: (w: Weights) => void; hasStyle: boolean; onBack: () => void; onDone: () => void }) {
  return (
    <div>
      <p className="eyebrow">Última etapa</p>
      <h2 className="display text-2xl font-semibold sm:text-3xl">O que pesa mais para você?</h2>
      <p className="mb-5 mt-2 max-w-2xl text-sm text-muted">Marque quanto cada tema importa. O ideal é 2 de cada lado (muito e pouco), mas pode ser qualquer quantidade. Tudo em “Normal” também vale.</p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {PILLARS.filter((p) => p.id !== "estilo" || hasStyle).map((p) => (
          <div key={p.id} className="card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h3 className="font-semibold">{p.label}</h3>
              <p className="text-xs text-muted">{p.hint}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="group" aria-label={`Peso de ${p.label}`}>
              {[3, 2, 1, 0].map((w) => (
                <button key={w} type="button" onClick={() => setWeights({ ...weights, [p.id]: w })} aria-pressed={weights[p.id] === w} className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${weights[p.id] === w ? "border-ink bg-ink text-paper" : "border-line bg-surface text-muted hover:border-line-strong"}`}>
                  {PESO_LABEL[w]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="btn btn-ghost">← Voltar</button>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setWeights({ ...DEFAULT_WEIGHTS }); onDone(); }} className="btn btn-ghost">Pular</button>
          <button type="button" onClick={onDone} className="btn btn-primary">Ver meu resultado →</button>
        </div>
      </div>
    </div>
  );
}

const PILLAR_SHORT: Record<Pillar, string> = { economia: "Economia", costumes: "Costumes", seguranca: "Segurança", ambiente: "Ambiente", educacao: "Educação", estilo: "Estilo" };
const RADAR_ORDER: Pillar[] = ["economia", "costumes", "seguranca", "ambiente", "educacao"];

const confTone = { alta: "text-ok", média: "text-muted", baixa: "text-faint" } as const;

function PartyCard({ s, rank, mine, pending, choose }: { s: Scored; rank: number; mine: string | null; pending: boolean; choose: (sigla: string) => void }) {
  const p = s.pos.party;
  const gapNote = s.notes.find((n) => n.pillar === s.gap);
  const seal = p.seal ? SEAL_LABEL[p.seal] : null;
  return (
    <article className="card p-4 sm:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="display text-xl font-semibold">
          <span className="mr-2 text-sm font-semibold text-faint">{rank}º</span>
          <Link href={`/partidos/${slugOf(p.sigla)}`} className="hover:underline">{p.sigla}</Link>
          <span className="ml-2 text-base font-semibold text-brand">{fmt(s.total)}</span>
        </h3>
        <p className="text-xs text-muted">{p.federacao ? `Federação ${p.federacao}` : "Sem federação"}{seal ? ` · Estilo: ${seal}` : ""}</p>
      </header>
      <p className="mt-0.5 text-sm text-muted">{p.nome}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {mine === p.sigla ? (
          <span className="btn btn-sm btn-primary pointer-events-none">✓ Seu partido</span>
        ) : (
          <button type="button" disabled={pending} onClick={() => choose(p.sigla)} className="btn btn-sm btn-secondary">
            {mine && mine !== "NONE" ? `Trocar para o ${p.sigla}` : `Escolher o ${p.sigla} como meu partido`}
          </button>
        )}
        <Link href={`/partidos/${slugOf(p.sigla)}`} className="text-sm font-semibold text-brand underline-offset-4 hover:underline">Ver página do partido →</Link>
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {s.notes.map((n) => {
          const pl = PILLARS.find((x) => x.id === n.pillar)!;
          let text: string;
          if (n.pillar === "estilo") {
            text = `Você valoriza “${SEAL_LABEL[n.seal!.user]}”; ${n.seal!.party ? `o partido tem o selo “${SEAL_LABEL[n.seal!.party]}”` : "o partido não tem selo definido"}.`;
          } else {
            const id = n.pillar as Exclude<Pillar, "estilo">;
            text = `Você ficou em “${shortBand(id, n.user!)}”. ${describePillar(id, n.party!)}`;
          }
          return (
            <li key={n.pillar}>
              <b>{pl.label}</b> <span className="text-faint">(peso {n.weight})</span>: <b className="text-brand">{fmt(n.note)}</b>. {text} <span className={`text-xs ${confTone[n.conf]}`}>Confiança: {n.conf}.</span>
            </li>
          );
        })}
      </ul>
      {gapNote && gapNote.note < 10 && (
        <p className="mt-3 rounded-lg bg-ink/5 px-3 py-2 text-xs text-muted">
          <b className="text-ink">Atenção:</b> o maior afastamento está em {PILLARS.find((x) => x.id === gapNote.pillar)!.label.toLowerCase()} (nota {fmt(gapNote.note)}).
          {p.federacao ? ` O ${p.sigla} é federado (${p.federacao}) e atua em bloco com os parceiros por pelo menos quatro anos.` : ""}
        </p>
      )}
    </article>
  );
}

function ChooseParty({ mine, pending, choose, suggested }: { mine: string | null; pending: boolean; choose: (sigla: string) => void; suggested: string[] }) {
  const list = [...PARTIES].sort((a, b) => a.sigla.localeCompare(b.sigla, "pt-BR"));
  const pill = (on: boolean) => `inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold transition-colors disabled:opacity-60 ${on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"}`;
  return (
    <section className="card p-5 sm:p-6" aria-label="Escolher meu partido">
      <p className="eyebrow">Seu partido</p>
      <h2 className="display text-xl font-semibold">Qual é o seu partido?</h2>
      <p className="mb-4 mt-1 max-w-2xl text-sm text-muted">
        O resultado do quiz é só uma referência. Se você tem um partido, escolha aqui: usamos isso para abrir a tela de Partidos com as notícias dele e trazer o resumo dele nos seus e-mails.
      </p>
      <div className="flex flex-wrap gap-2">
        {list.map((p) => (
          <button key={p.sigla} type="button" disabled={pending} onClick={() => choose(p.sigla)} aria-pressed={mine === p.sigla} title={p.nome} className={pill(mine === p.sigla)}>
            {p.sigla}{suggested.includes(p.sigla) && mine !== p.sigla ? <span className="ml-1 text-[10px] font-normal opacity-60">· sua caixa</span> : null}
          </button>
        ))}
        <button type="button" disabled={pending} onClick={() => choose("NONE")} aria-pressed={mine === "NONE"} className={pill(mine === "NONE")}>Não tenho partido</button>
      </div>
      {mine && (
        <p className="mt-4 text-sm" role="status">
          {mine === "NONE" ? "Ok, sem partido por enquanto." : <>✓ Seu partido: <b>{mine}</b>. </>}
          <Link href="/partidos" className="font-semibold text-brand underline-offset-4 hover:underline">Ver notícias dos partidos →</Link>
        </p>
      )}
    </section>
  );
}

function Results({ answers, weights, onRedo, onChangeWeights, party }: { answers: Answers; weights: Weights; onRedo: () => void; onChangeWeights: () => void; party: string | null }) {
  const r = useMemo(() => computeResult(answers, weights), [answers, weights]);
  const [mine, setMine] = useState<string | null>(party);
  const [pending, start] = useTransition();
  const choose = (sigla: string) => start(async () => {
    const res = await saveMyParty(sigla);
    if (res.ok) setMine(sigla);
  });
  const pr = r.profile;
  const prio = PILLARS.filter((p) => p.id !== "estilo" || pr.seal).map((p) => `${p.label} ${weights[p.id]}`).join(" · ");
  const near = [
    pr.nearEco !== null ? `Economia (perto de “${ECON_LABEL[pr.nearEco]}”)` : null,
    pr.nearCus !== null ? `Costumes (perto de “${CUST_LABEL[pr.nearCus]}”)` : null,
  ].filter(Boolean);
  // frase de perfil: os dois pilares de maior peso entre os respondidos
  const ranked = (Object.keys(pr.pillars) as Exclude<Pillar, "estilo">[]).filter((p) => weights[p] > 0).sort((a, b) => weights[b] - weights[a] || Math.abs(pr.pillars[b]!) - Math.abs(pr.pillars[a]!)).slice(0, 2);
  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-8">
        <p className="eyebrow">Você</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="display text-3xl font-semibold leading-tight">{pr.boxName}</h2>
          <AskButton focus={{
            title: `Meu perfil político · ${pr.boxName}`,
            text: `Perfil do usuário no quiz: ${pr.boxName}. Economia ${fmtPos(pr.economia)}, costumes ${fmtPos(pr.costumes)} (−10 a +10).${pr.seal ? ` Estilo: ${SEAL_LABEL[pr.seal]}.` : ""} Por tema: ${RADAR_ORDER.map((id) => `${PILLAR_SHORT[id]} ${fmtPos(pr.pillars[id as Exclude<Pillar, "estilo">] ?? 0)}`).join("; ")}. Partidos mais próximos: ${r.ranking.slice(0, 5).map((s) => `${s.pos.party.sigla} ${s.total.toFixed(1)}`).join(", ")}. A nota mede proximidade com as respostas e prioridades, não qualidade do partido.`,
            suggestions: ["Explique meu perfil em poucas palavras", "Por que esses partidos ficaram mais perto?", "Em que meu perfil se afasta do primeiro colocado?", "O que mudaria se eu priorizasse outro tema?"],
          }} />
        </div>
        <p className="mt-1 text-sm text-muted">Economia {fmt(pr.economia)} · Costumes {fmt(pr.costumes)}{pr.seal ? ` · Estilo: ${SEAL_LABEL[pr.seal]}` : ""}</p>
        <p className="mt-3 max-w-2xl">
          Pelas suas respostas, {ranked.map((p) => `em ${PILLARS.find((x) => x.id === p)!.label.toLowerCase()} você ficou em “${shortBand(p, pr.pillars[p]!)}”`).join(" e ")}.
        </p>
        {near.length > 0 && <p className="mt-2 text-sm text-muted">Você está perto da borda em {near.join(" e ")}. Mais abaixo mostramos os partidos da caixa vizinha.</p>}
        <p className="mt-3 text-xs text-muted">Prioridades: {prio}</p>
        <div className="mt-6 grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <NineBox grid={r.grid} you={pr} />
          <div className="mx-auto w-full max-w-[26rem]">
            <p className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-muted">Você em cada tema</p>
            <Radar
              label="Seu perfil em cada tema"
              size={320}
              axes={RADAR_ORDER.flatMap((id) => {
                const v = pr.pillars[id as Exclude<Pillar, "estilo">];
                if (v === undefined || weights[id] === 0) return [];
                return [{ label: PILLAR_SHORT[id], value: (v + 10) / 2, text: `${radarBand(id as Exclude<Pillar, "estilo">, v)} · ${fmtPos(v)}` }];
              })}
            />
            <p className="mt-1 text-center text-[11px] text-faint">Os números vão de −10 a +10. Em cada tema, o ponto fica perto do centro no polo à esquerda (Mais Estado, Progressista, Social, Preservação, Ensino público) e perto da borda no polo oposto.</p>
          </div>
        </div>
        <div className="mt-4 space-y-1 text-xs text-muted">
          <p><b className="text-ink">Sem caixa única:</b> {r.mixed.map((p) => p.sigla).join(", ")}.</p>
          <p><b className="text-ink">Perfil pouco definido:</b> {r.undefinedParties.map((p) => p.sigla).join(", ")}.</p>
        </div>
      </section>

      <section>
        <h2 className="display text-2xl font-semibold">Mais próximos de você</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Só partidos da sua caixa, em ordem de nota (de 0 a 10). A nota mede a proximidade com as suas respostas e prioridades.</p>
        {r.ranking.length ? (
          <div className="space-y-4">{r.ranking.map((s, i) => <PartyCard key={s.pos.party.sigla} s={s} rank={i + 1} mine={mine} pending={pending} choose={choose} />)}</div>
        ) : (
          <p className="card p-5 text-sm text-muted">Nenhum partido da nossa base está na sua caixa ({pr.boxName}). Veja os vizinhos abaixo.</p>
        )}
      </section>

      {r.neighbors.length > 0 && (
        <section className="card p-5">
          <h2 className="display text-xl font-semibold">Vizinhos próximos</h2>
          <p className="mb-3 mt-1 text-sm text-muted">Você está perto da divisa dessas caixas, então estes partidos também podem se aproximar de você. Não entram no ranking nem têm nota.</p>
          <ul className="space-y-2 text-sm">
            {r.neighbors.map((n) => (
              <li key={n.box}>
                <b>{n.box}:</b>{" "}
                {n.parties.map((p, i) => <span key={p.party.sigla}>{i ? ", " : ""}<Link href={`/partidos/${slugOf(p.party.sigla)}`} className="font-semibold text-brand underline-offset-4 hover:underline">{p.party.sigla}</Link></span>)}
                <span className="text-muted"> — seu perfil está puxando para o lado “{n.side}”.</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card-flat p-5 text-sm">
        <p><b>Sem caixa única:</b> {r.mixed.map((p) => p.sigla).join(", ")} costumam ter posições variadas entre bancadas, então não aparecem com nota.</p>
        <p className="mt-3">Clique em qualquer sigla para ver o perfil, as pessoas eleitas e as notícias do partido.</p>
      </section>

      <section className="rounded-2xl bg-ink/5 p-5 text-xs leading-relaxed text-muted">
        <p>
          A nota mede proximidade com as suas respostas e prioridades, e não a qualidade de um partido nem uma recomendação de voto. É uma simplificação: vale ler o programa e o estatuto do partido e conferir como as bancadas votam. Partidos federados atuam em bloco por pelo menos quatro anos. As posições dos partidos são estimativas do app (outubro de 2026).
        </p>
      </section>

      <ChooseParty mine={mine} pending={pending} choose={choose} suggested={r.ranking.map((x) => x.pos.party.sigla)} />

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onChangeWeights} className="btn btn-secondary">Refazer com outros pesos</button>
        <button type="button" onClick={onRedo} className="btn btn-ghost">Refazer o quiz</button>
      </div>
    </div>
  );
}

const toAnswers = (r: Record<string, string>): Answers => Object.fromEntries(Object.entries(r).map(([k, v]) => [Number(k), v])) as Answers;

export function Quiz({ initialParty = null, saved = null }: { initialParty?: string | null; saved?: { answers: Record<string, string>; weights: Record<string, number> } | null }) {
  const [step, setStep] = useState<Step>(saved ? "resultado" : "intro");
  const [answers, setAnswers] = useState<Answers>(saved ? toAnswers(saved.answers) : {});
  const [weights, setWeights] = useState<Weights>(saved ? ({ ...DEFAULT_WEIGHTS, ...saved.weights } as Weights) : { ...DEFAULT_WEIGHTS });
  const [, startSave] = useTransition();

  const go = (s: Step) => {
    setStep(s);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const setAnswer = (n: number, v: "a" | "b" | "c" | "x") => setAnswers((a) => ({ ...a, [n]: v }));
  const finish = () => {
    startSave(async () => {
      await saveQuiz(Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, String(v)])), weights);
    });
    go("resultado");
  };

  return (
    <div className="w-full">
      {step !== "intro" && step !== "resultado" && <Progress step={step} />}
      {step === "intro" && <Intro onStart={() => { setAnswers({}); setWeights({ ...DEFAULT_WEIGHTS }); go(1); }} />}
      {(step === 1 || step === 2 || step === 3) && (
        <Round round={step} answers={answers} setAnswer={setAnswer} onBack={() => go(step === 1 ? "intro" : ((step - 1) as 1 | 2))} onNext={() => go(step === 3 ? "pesos" : ((step + 1) as 2 | 3))} />
      )}
      {step === "pesos" && <Weighing weights={weights} setWeights={setWeights} hasStyle={answers[12] !== "x"} onBack={() => go(3)} onDone={finish} />}
      {step === "resultado" && <Results party={initialParty} answers={answers} weights={weights} onRedo={() => { setAnswers({}); setWeights({ ...DEFAULT_WEIGHTS }); go(1); }} onChangeWeights={() => go("pesos")} />}
    </div>
  );
}
