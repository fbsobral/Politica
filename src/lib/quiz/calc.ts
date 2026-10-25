import { PARTIES, PILLARS, QUESTIONS, SEAL_BY_OPTION, type Axis, type Conf, type Party, type Pillar, type Question, type Seal } from "./data";

/** "x" = não sei / tanto faz (só na pergunta de Estilo) */
export type Answers = Partial<Record<number, "a" | "b" | "c" | "x">>;
/** peso 0 (não importa), 1, 2 ou 3 */
export type Weights = Record<Pillar, number>;

export const DEFAULT_WEIGHTS: Weights = { economia: 2, costumes: 2, seguranca: 2, ambiente: 2, educacao: 2, estilo: 2 };

export type Band = -1 | 0 | 1;
export const ECON_LABEL: Record<Band, string> = { [-1]: "Mais Estado", 0: "Equilibrada", 1: "Mais mercado" };
export const CUST_LABEL: Record<Band, string> = { [-1]: "Progressista", 0: "Moderado", 1: "Conservador" };

export const band = (x: number): Band => (x <= -3.4 ? -1 : x >= 3.4 ? 1 : 0);
const BORDER = 3.35;
const NEAR = 1.5;

/** lado em que a posição está a até 1,5 ponto de uma divisa de faixa (−1, +1) ou null */
export function nearSide(x: number): Band | null {
  const b = band(x);
  if (b === 0) return x >= BORDER - NEAR ? 1 : x <= -(BORDER - NEAR) ? -1 : null;
  // dentro de um polo: perto da divisa com o meio
  if (Math.abs(x) - BORDER <= NEAR) return 0;
  return null;
}

const mapValue = (v: number, m: "id" | "neg" | "pos") => (m === "id" ? v : m === "neg" ? Math.min(v, 0) : Math.max(v, 0));

/** valores (−1…+1) por pergunta 1–11 a partir das respostas do usuário */
export function userValues(answers: Answers): Record<number, number> {
  const out: Record<number, number> = {};
  for (const q of QUESTIONS) {
    const a = answers[q.n];
    if (!a || a === "x" || q.pillar === "estilo") continue;
    out[q.n] = q.values[a === "a" ? 0 : a === "b" ? 1 : 2];
  }
  return out;
}

export const partyValues = (p: Party): Record<number, number> => Object.fromEntries(p.v.map((v, i) => [i + 1, v]));

export function pillarPosition(vals: Record<number, number>, pillar: Pillar): number | null {
  const xs = QUESTIONS.filter((q) => q.pillar === pillar && vals[q.n] !== undefined).map((q) => vals[q.n]);
  return xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length) * 10 : null;
}

export function axisPosition(vals: Record<number, number>, axis: Axis, weights: Weights): number | null {
  let num = 0;
  let den = 0;
  for (const q of QUESTIONS) {
    const v = vals[q.n];
    const wp = weights[q.pillar];
    if (v === undefined || !wp) continue;
    for (const r of q.axes) {
      if (r.axis !== axis) continue;
      num += mapValue(v, r.map) * r.weight * wp;
      den += r.weight * wp;
    }
  }
  return den ? (num / den) * 10 : null;
}

export type Profile = {
  economia: number;
  costumes: number;
  eco: Band;
  cus: Band;
  boxName: string;
  seal: Seal | null;
  pillars: Partial<Record<Pillar, number>>;
  nearEco: Band | null;
  nearCus: Band | null;
};

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
export const boxName = (eco: Band, cus: Band) => `Economia ${eco === 0 ? lowerFirst(ECON_LABEL[eco]) : ECON_LABEL[eco].replace("Mais ", "mais ")} × ${CUST_LABEL[cus]}`;

export function computeProfile(answers: Answers, weights: Weights): Profile {
  const vals = userValues(answers);
  const economia = axisPosition(vals, "economia", weights) ?? 0;
  const costumes = axisPosition(vals, "costumes", weights) ?? 0;
  const pillars: Partial<Record<Pillar, number>> = {};
  for (const p of PILLARS) {
    if (p.id === "estilo") continue;
    const pos = pillarPosition(vals, p.id);
    if (pos !== null) pillars[p.id] = pos;
  }
  const st = answers[12] === "x" ? undefined : answers[12];
  const eco = band(economia);
  const cus = band(costumes);
  return { economia, costumes, eco, cus, boxName: boxName(eco, cus), seal: st ? SEAL_BY_OPTION[st] : null, pillars, nearEco: nearSide(economia), nearCus: nearSide(costumes) };
}

export type PartyPos = { party: Party; economia: number; costumes: number; eco: Band; cus: Band; pillars: Partial<Record<Pillar, number>> };

const EQUAL: Weights = { economia: 2, costumes: 2, seguranca: 2, ambiente: 2, educacao: 2, estilo: 2 };

export function partyPositions(): PartyPos[] {
  return PARTIES.map((party) => {
    const vals = partyValues(party);
    const economia = axisPosition(vals, "economia", EQUAL) ?? 0;
    const costumes = axisPosition(vals, "costumes", EQUAL) ?? 0;
    const pillars: Partial<Record<Pillar, number>> = {};
    for (const p of PILLARS) if (p.id !== "estilo") pillars[p.id] = pillarPosition(vals, p.id) ?? 0;
    return { party, economia, costumes, eco: band(economia), cus: band(costumes), pillars };
  });
}

export type Scored = {
  pos: PartyPos;
  total: number;
  notes: { pillar: Pillar; weight: number; note: number; conf: Conf; user: number | null; party: number | null; seal?: { user: Seal; party: Seal | null } }[];
  /** pilar com maior perda ponderada */
  gap: Pillar | null;
};

const noteOf = (u: number, p: number) => 10 * (1 - Math.abs(u - p) / 20);
const r1 = (x: number) => Math.round(x * 10) / 10;

export function score(pos: PartyPos, profile: Profile, weights: Weights): Scored {
  const notes: Scored["notes"] = [];
  const order = [...PILLARS].sort((a, b) => weights[b.id] - weights[a.id]);
  for (const pl of order) {
    const w = weights[pl.id];
    if (!w) continue;
    if (pl.id === "estilo") {
      if (!profile.seal) continue;
      const ps = pos.party.seal;
      notes.push({ pillar: "estilo", weight: w, note: ps && ps === profile.seal ? 10 : 3, conf: "baixa", user: null, party: null, seal: { user: profile.seal, party: ps } });
      continue;
    }
    const u = profile.pillars[pl.id];
    const p = pos.pillars[pl.id];
    if (u === undefined || p === undefined) continue;
    notes.push({ pillar: pl.id, weight: w, note: r1(noteOf(u, p)), conf: pos.party.conf, user: u, party: p });
  }
  const den = notes.reduce((a, n) => a + n.weight, 0);
  const total = den ? r1(notes.reduce((a, n) => a + n.note * n.weight, 0) / den) : 0;
  const gap = notes.length ? notes.reduce((best, n) => ((10 - n.note) * n.weight > (10 - best.note) * best.weight ? n : best)).pillar : null;
  return { pos, total, notes, gap };
}

export type Result = {
  profile: Profile;
  weights: Weights;
  /** partidos da caixa do usuário, do mais próximo ao menos */
  ranking: Scored[];
  /** caixas vizinhas por proximidade de borda (sem posição no ranking) */
  neighbors: { box: string; side: string; parties: PartyPos[] }[];
  mixed: Party[];
  undefinedParties: Party[];
  /** partidos por caixa [eco][cus] para desenhar o 9box */
  grid: Record<string, PartyPos[]>;
};

export const cellKey = (eco: Band, cus: Band) => `${eco}:${cus}`;

export function computeResult(answers: Answers, weights: Weights): Result {
  const profile = computeProfile(answers, weights);
  const all = partyPositions();
  const placed = all.filter((p) => p.party.box === null);
  const grid: Result["grid"] = {};
  for (const p of placed) (grid[cellKey(p.eco, p.cus)] ??= []).push(p);
  for (const k of Object.keys(grid)) grid[k].sort((a, b) => a.party.sigla.localeCompare(b.party.sigla, "pt-BR"));

  const mine = grid[cellKey(profile.eco, profile.cus)] ?? [];
  const heaviest = [...PILLARS].sort((a, b) => weights[b.id] - weights[a.id]).map((p) => p.id);
  const ranking = mine
    .map((p) => score(p, profile, weights))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      for (const pl of heaviest) {
        const na = a.notes.find((n) => n.pillar === pl)?.note;
        const nb = b.notes.find((n) => n.pillar === pl)?.note;
        if (na !== undefined && nb !== undefined && na !== nb) return nb - na;
      }
      return a.pos.party.sigla.localeCompare(b.pos.party.sigla, "pt-BR");
    })
    .slice(0, 5);

  const neighbors: Result["neighbors"] = [];
  const addNeighbor = (eco: Band, cus: Band, side: string) => {
    const list = grid[cellKey(eco, cus)] ?? [];
    if (list.length && !neighbors.some((n) => n.box === boxName(eco, cus))) neighbors.push({ box: boxName(eco, cus), side, parties: list });
  };
  const ne = profile.nearEco === null ? null : ((profile.nearEco as Band) );
  const nc = profile.nearCus === null ? null : ((profile.nearCus as Band) );
  if (ne !== null) addNeighbor(ne, profile.cus, ECON_LABEL[ne]);
  if (nc !== null) addNeighbor(profile.eco, nc, CUST_LABEL[nc]);
  if (ne !== null && nc !== null) addNeighbor(ne, nc, `${ECON_LABEL[ne]} e ${CUST_LABEL[nc]}`);

  return {
    profile,
    weights,
    ranking,
    neighbors,
    mixed: PARTIES.filter((p) => p.box === "mixed"),
    undefinedParties: PARTIES.filter((p) => p.box === "undefined"),
    grid,
  };
}

export const questionsOfRound = (r: 1 | 2 | 3): Question[] => QUESTIONS.filter((q) => q.round === r);
