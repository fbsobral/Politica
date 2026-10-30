/** Metas de referência (globais, quando existem) usadas no score. Valores na mesma unidade da série do indicador. */
export type Target = {
  /** meta fixa, na unidade da série */
  value?: number;
  /** meta diferente por esfera (ex.: limites legais de estados e municípios) */
  byScope?: Partial<Record<"FEDERAL" | "ESTADUAL" | "MUNICIPAL", number>>;
  /** meta relativa: fração do valor do ano-base (ex.: "reduzir à metade em relação a 2015") */
  base?: { year: number; factor: number };
  /** meta que acompanha outra série ano a ano (ex.: 3 meses de importações = ¼ das importações do ano) */
  ratioOf?: { id: string; factor: number };
  ref: string;
  url?: string;
  /** o número vem de fonte secundária ou de definição próxima, e vale conferir na fonte primária */
  approx?: boolean;
};

/** Meta fixa de um indicador para uma esfera; `values` só é usado nas metas relativas ao ano-base. */
export function fixedTargetFor(id: string, scope: "FEDERAL" | "ESTADUAL" | "MUNICIPAL", values: Record<number, number>): number | null {
  const t = TARGETS[id];
  if (!t) return null;
  if (t.byScope?.[scope] != null) return t.byScope[scope]!;
  if (t.value != null) return t.value;
  if (t.ratioOf) return null; // resolvida ano a ano no cálculo do score
  if (t.base) { const b = values[t.base.year]; return b != null ? b * t.base.factor : null; }
  return null;
}

export const TARGETS: Record<string, Target> = {
  "mortalidade-5": { value: 25, ref: "ODS 3.2.1 (ONU): no máximo 25 mortes por mil nascidos vivos", url: "https://brasil.un.org/pt-br/sdgs/3" },
  "mortalidade-neonatal": { value: 12, ref: "ODS 3.2.2 (ONU): no máximo 12 mortes por mil nascidos vivos", url: "https://brasil.un.org/pt-br/sdgs/3" },
  "mortalidade-materna": { value: 70, ref: "ODS 3.1.1 (ONU): menos de 70 mortes por 100 mil nascidos vivos", url: "https://brasil.un.org/pt-br/sdgs/3" },
  homicidios: { value: 5.8, ref: "Média global de homicídios por 100 mil habitantes (UNODC, 2021)", url: "https://www.unodc.org/unodc/en/data-and-analysis/global-study-on-homicide.html" },
  suicidio: { value: 9, ref: "Média global de suicídios por 100 mil habitantes (OMS, 2019)", url: "https://www.who.int/news-room/fact-sheets/detail/suicide" },
  transito: { value: 15, ref: "Média global de mortes no trânsito por 100 mil habitantes (OMS)", url: "https://www.who.int/publications/i/item/9789240086517" },
  desemprego: { value: 5, ref: "Referência de pleno emprego: média de desemprego da OCDE (~5%)", url: "https://www.oecd.org/en/data/indicators/unemployment-rate.html" },
  ipca: { value: 3, ref: "Meta de inflação do Brasil (Conselho Monetário Nacional): 3% ao ano", url: "https://www.bcb.gov.br/controleinflacao/metainflacao" },
  "divida-bruta": { value: 60, ref: "Referência fiscal: 60% do PIB (critério de Maastricht e referência do FMI)", url: "https://www.imf.org/en/Topics/fiscal-policy" },
  "deficit-primario": { value: 0, ref: "Equilíbrio primário (resultado zero), condição para estabilizar a dívida" },
  "pib-cresc": { value: 3, ref: "Crescimento médio mundial de longo prazo (FMI, ~3% ao ano)", url: "https://www.imf.org/en/Publications/WEO" },
  gini: { value: 0.32, ref: "Média da OCDE de desigualdade de renda (Gini ~0,32)", url: "https://www.oecd.org/en/data/indicators/income-inequality.html" },
  analfabetismo: { value: 2, ref: "ODS 4.6 (alfabetização universal); países de alta alfabetização ficam perto de 2%", url: "https://brasil.un.org/pt-br/sdgs/4" },
  "pobreza-int": { value: 3, ref: "Banco Mundial: reduzir a pobreza extrema a 3% da população até 2030", url: "https://www.worldbank.org/en/topic/poverty" },
  "mortalidade-infantil": { value: 4.2, ref: "Média da OCDE de mortalidade infantil (~4,2 por mil nascidos vivos em 2023, OECD Health Statistics)", url: "https://www.oecd.org/en/topics/sub-issues/health-outcomes.html", approx: true },
  "nem-nem": { value: 9, ref: "Meta da União Europeia para 2030: no máximo 9% de jovens que não estudam nem trabalham (faixa de 15 a 29 anos, mais ampla que a da série)", url: "https://ec.europa.eu/social/main.jsp?catId=1226", approx: true },
  "deficit-nominal": { value: 3, ref: "Critério de Maastricht: déficit público de no máximo 3% do PIB", url: "https://economy-finance.ec.europa.eu/economic-and-fiscal-governance/stability-and-growth-pact_en" },
  "divida-liquida": { value: 40, ref: "Referência do FMI de 40% do PIB para economias emergentes (relatório de 2010); a dívida líquida é menor que a bruta, então a régua de 60% da bruta seria folgada demais", url: "https://www.imf.org/en/Topics/fiscal-policy", approx: true },
  "divida-liquida-gg": { value: 40, ref: "Referência do FMI de 40% do PIB para economias emergentes (relatório de 2010); a dívida líquida é menor que a bruta, então a régua de 60% da bruta seria folgada demais", url: "https://www.imf.org/en/Topics/fiscal-policy", approx: true },
  pobreza: { base: { year: 2015, factor: 0.5 }, ref: "ODS 1.2 (ONU/IPEA): reduzir à metade a proporção de pessoas na pobreza, tomando 2015 como ano-base", url: "https://www.ipea.gov.br/ods/ods1.html" },
  "pobreza-ocupados": { base: { year: 2015, factor: 0.5 }, ref: "ODS 1.2 (ONU/IPEA): reduzir à metade, tomando 2015 como ano-base", url: "https://www.ipea.gov.br/ods/ods1.html" },
  subutilizacao: { value: 11, ref: "Referência da OIT: taxa de subutilização de adultos de ~11% (10,8%) na força de trabalho ampliada", url: "https://ilostat.ilo.org/resources/concepts-and-definitions/description-labour-underutilization/", approx: true },
  informalidade: { value: 13.5, ref: "Informalidade nos países de renda alta (~13,5% do emprego, estimativas da OIT)", url: "https://ilostat.ilo.org/topics/informality/", approx: true },
  inadimplencia: { value: 5.4, ref: "Média mundial de crédito bancário em atraso (~5,4% da carteira, Banco Mundial FB.AST.NPER.ZS)", url: "https://data.worldbank.org/indicator/FB.AST.NPER.ZS", approx: true },
  "inadimplencia-total": { value: 5.4, ref: "Média mundial de crédito bancário em atraso (~5,4% da carteira, Banco Mundial FB.AST.NPER.ZS)", url: "https://data.worldbank.org/indicator/FB.AST.NPER.ZS", approx: true },
  previdencia: { value: 100, ref: "ODS 1.3 (ONU/OIT): cobertura universal de proteção social, ou seja, 100% dos ocupados", url: "https://brasil.un.org/pt-br/sdgs/1" },
  "dcl-rcl": { byScope: { ESTADUAL: 200, MUNICIPAL: 120 }, ref: "Limites legais do Senado (Resolução 40/2001): dívida de até 200% da receita corrente líquida nos estados e 120% nos municípios", url: "https://www12.senado.leg.br/legislacao/" },
  "pessoal-rcl": { byScope: { ESTADUAL: 49, MUNICIPAL: 54 }, ref: "Limites da Lei de Responsabilidade Fiscal (art. 20) para o Poder Executivo: 49% da receita nos estados e 54% nos municípios", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp101.htm" },
  reservas: { ratioOf: { id: "importacoes", factor: 0.25 }, ref: "Regra prática do FMI: reservas que cubram ao menos 3 meses de importações (um quarto das importações do ano)", url: "https://www.imf.org/en/Publications/Policy-Papers/Issues/2016/12/31/Assessing-Reserve-Adequacy-PP4572" },
  comprometimento: { value: 10, ref: "Média de ~10% da renda no serviço da dívida das famílias em 17 países do BIS (Debt Service Ratio)", url: "https://data.bis.org/topics/DSR", approx: true },
  endividamento: { value: 130, ref: "Média da OCDE de dívida das famílias de ~130% da renda anual (base de cálculo mais ampla que a do Banco Central)", url: "https://www.oecd.org/en/data/indicators/household-debt.html", approx: true },
  "endividamento-sem-habitacao": { value: 130, ref: "Mesma referência da OCDE do endividamento total (não há média internacional sem crédito imobiliário)", url: "https://www.oecd.org/en/data/indicators/household-debt.html", approx: true },
  "renda-trabalho": { value: 7107, ref: "Salário mínimo necessário calculado pelo DIEESE (R$ 7.107 em dez/2025, para uma família de 4 pessoas), a preços de 2025", url: "https://www.dieese.org.br/analisecestabasica/salarioMinimo.html", approx: true },
  desalento: { value: 0, ref: "Ideal teórico: nenhum trabalhador desalentado (não achei média internacional comparável)", approx: true },
};
