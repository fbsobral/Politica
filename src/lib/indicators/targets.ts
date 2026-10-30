/** Metas de referência (globais, quando existem) usadas no score. Valores na mesma unidade da série do indicador. */
export type Target = { value: number; ref: string; url?: string };

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
};
