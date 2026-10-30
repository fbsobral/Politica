/** Indicadores que costumam refletir o resultado de cada gasto do orçamento (sugestão automática do ROI). */
type Rule = { match: RegExp; inds: string[]; why: string };

const RULES: Rule[] = [
  { match: /^sa[uú]de/i, inds: ["mortalidade-infantil", "mortalidade-5", "mortalidade-neonatal", "mortalidade-materna", "suicidio"], why: "Saúde se mede por mortes evitáveis: de bebês, crianças, mães e por suicídio." },
  { match: /^educa[cç][aã]o/i, inds: ["analfabetismo", "nem-nem"], why: "Educação se reflete em alfabetização e em jovens que estudam ou trabalham." },
  { match: /^seguran[cç]a/i, inds: ["homicidios"], why: "Segurança pública se mede por mortes violentas." },
  { match: /^assist[eê]ncia/i, inds: ["pobreza", "pobreza-int", "pobreza-ocupados", "gini"], why: "Assistência social busca reduzir a pobreza e a desigualdade." },
  { match: /^trabalho/i, inds: ["desemprego", "subutilizacao", "desalento", "informalidade"], why: "Políticas de trabalho miram emprego, subutilização e formalização." },
  { match: /^previd[eê]ncia/i, inds: ["previdencia", "pobreza"], why: "Previdência se reflete na proteção de quem trabalha e na pobreza." },
  { match: /^(transporte|urbanismo)/i, inds: ["transito", "pib-cresc"], why: "Transporte e urbanismo afetam mortes no trânsito e a atividade econômica." },
  { match: /^(saneamento|habita[cç][aã]o)/i, inds: ["mortalidade-infantil", "mortalidade-5"], why: "Saneamento e moradia reduzem doenças e mortes de crianças." },
  { match: /^(agricultura|organiza[cç][aã]o agr[aá]ria|energia)/i, inds: ["ipca", "pib-cresc"], why: "Produção agrícola e energia pesam nos preços e no crescimento." },
  { match: /^(ind[uú]stria|com[eé]rcio|comunica|ci[eê]ncia|turismo|desporto)/i, inds: ["pib-cresc", "desemprego", "renda-trabalho"], why: "Estes setores buscam crescimento, emprego e renda." },
  { match: /^(encargos|juros|amortiza|d[ií]vida)/i, inds: ["divida-bruta", "deficit-primario"], why: "Juros e dívida se refletem no tamanho da dívida e no resultado das contas." },
  { match: /^investimentos?/i, inds: ["pib-cresc", "desemprego"], why: "Investimentos públicos buscam crescimento e emprego." },
  { match: /^despesa total/i, inds: ["pib-cresc", "divida-bruta", "desemprego"], why: "O gasto total se relaciona com o crescimento, a dívida e o emprego." },
];

/** Sugestões para um gasto (função, subfunção ou tipo de gasto). Subfunções herdam as da função-mãe. Vazio = sem indicador alinhado nos dados atuais. */
export function suggestIndicators(name: string, parentName?: string | null): { ids: string[]; why: string } {
  const rule = RULES.find((r) => r.match.test(name)) ?? (parentName ? RULES.find((r) => r.match.test(parentName)) : undefined);
  return rule ? { ids: rule.inds, why: rule.why } : { ids: [], why: "" };
}
