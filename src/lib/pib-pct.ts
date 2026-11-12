/**
 * Padrão dos percentuais do PIB do resultado primário (cartão e gráfico usam os mesmos nomes e as mesmas janelas):
 * - "no ano":     resultado de janeiro até o mês ÷ PIB dos mesmos meses (soma do PIB mensal, Banco Central SGS 4380);
 * - "12 meses":   resultado dos últimos 12 meses ÷ PIB de 12 meses (série oficial do Banco Central).
 * O mês vem sempre no nome, para ninguém comparar janelas diferentes sem querer.
 */
const MES3 = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const pibYtdLabel = (month: number) => `% PIB no ano · jan–${MES3[month]}`;
export const pib12Label = (month: number) => `% PIB 12 meses · ${MES3[month]}`;

export const PIB_RULES = {
  ytd: "No ano: resultado de janeiro até o mês dividido pelo PIB dos mesmos meses (soma do PIB mensal, Banco Central, SGS 4380).",
  m12: "12 meses: resultado dos últimos 12 meses dividido pelo PIB de 12 meses (série oficial do Banco Central).",
} as const;
