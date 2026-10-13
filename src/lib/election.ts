import type { ElectionOffice } from "@prisma/client";

export const ELECTION = {
  year: 2026,
  firstRound: "2026-10-04",
  runoff: "2026-10-25",
} as const;

/** Dias até o 2º turno (negativo depois da votação); usa o fuso de Brasília. */
export function daysToRunoff(now = new Date()): number {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(now);
  return Math.round((Date.parse(`${ELECTION.runoff}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

export const OFFICE_LABEL: Record<ElectionOffice, string> = {
  PRESIDENTE: "Presidente",
  GOVERNADOR: "Governador",
  SENADOR: "Senado",
  DEPUTADO: "Deputados",
};
export const OFFICE_VALUES = Object.keys(OFFICE_LABEL) as ElectionOffice[];

export const CALENDAR: { date: string; title: string; note?: string }[] = [
  { date: "2026-10-04", title: "1º turno", note: "Votação das 8h às 17h (horário local)." },
  { date: "2026-10-25", title: "2º turno", note: "Presidente e governadores onde não houve vencedor no 1º turno." },
  { date: "2027-01-01", title: "Posse", note: "Presidente, vice-presidente e governadores." },
  { date: "2027-02-01", title: "Posse no Congresso", note: "Deputados federais e senadores eleitos." },
];

export const VOTING_TIPS = [
  "Leve um documento oficial com foto. O título de eleitor é opcional — dá para usar o e-Título no celular.",
  "A votação vai das 8h às 17h no horário local; quem estiver na fila às 17h ainda vota.",
  "Confira o local de votação no site ou no app do TSE antes de sair de casa.",
];
