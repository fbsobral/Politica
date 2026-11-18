import { db } from "@/lib/db";
import { cached, type Geo, type Scope, type YearSeries } from "./core";
import { bcb, budgetTotal, censo2022, cempre, sidraSum, sectorFor, dclRcl, expenseValue, giniSidra, incomeReal, pessoalRcl, pibPerCapitaOficial, sidraAnnual, revenueValue, sidraPib, sidraPop, stored, unemploymentQ4, type Fetcher } from "./sources";
import type { Unit } from "./format";

export type GroupId = "economia" | "financas" | "familias" | "seguranca" | "social" | "servicos";

export const GROUPS: { id: GroupId; title: string; blurb: string }[] = [
  { id: "economia", title: "Economia", blurb: "Atividade, preços, juros e emprego." },
  { id: "financas", title: "Finanças do governo", blurb: "Dívida pública, resultado das contas e capacidade de gasto." },
  { id: "familias", title: "Famílias, crédito e Pix", blurb: "Endividamento, inadimplência e meios de pagamento." },
  { id: "seguranca", title: "Segurança pública", blurb: "Crimes e violência." },
  { id: "social", title: "Pobreza e renda", blurb: "Quem vive com pouco, desigualdade e rendimento." },
  { id: "servicos", title: "Saúde, educação e saneamento", blurb: "Acesso e resultado dos serviços públicos." },
];

/** Os grupos se organizam em dois blocos: econômicos e sociais. */
export const SIDES: { id: "economico" | "social"; title: string; blurb: string; groups: GroupId[] }[] = [
  { id: "economico", title: "Indicadores econômicos", blurb: "Atividade, preços, contas do governo e finanças das famílias.", groups: ["economia", "financas", "familias"] },
  { id: "social", title: "Indicadores sociais", blurb: "Segurança, pobreza, trabalho, saúde e educação.", groups: ["seguranca", "social", "servicos"] },
];

export type Indicator = {
  id: string;
  group: GroupId;
  name: string;
  /** sub-métrica: aparece dentro do cartão do indicador pai */
  parent?: string;
  unit: Unit;
  decimals?: number;
  desc: string;
  source: string;
  sourceUrl?: string;
  /** "up" = valor maior é melhor; "down" = menor é melhor; ausente = neutro */
  better?: "up" | "down";
  fetch: Partial<Record<Scope, Fetcher>>;
  /** validade do cache (dias) */
  ttlDays?: number;
  /** o dado é gravado por um job (arquivo grande): a visita só lê o banco */
  fed?: boolean;
  /** faz parte de um gráfico com várias linhas (ver BUNDLES); `name` é o rótulo da linha */
  bundle?: string;
  /** valor em R$ que pode ser exibido corrigido pela inflação (IPCA) a pedido do usuário */
  inflation?: boolean;
  /** valor em R$ que a própria fonte já publica a preços constantes (não precisa de correção) */
  real?: boolean;
};

export const INDICATORS: Indicator[] = [
  /* ═════ Economia ═════ */
  { id: "pib", inflation: true, group: "economia", name: "PIB (tudo o que se produz)", unit: "brl", desc: "Valor de tudo o que foi produzido no ano, em reais correntes (sem descontar a inflação). Brasil: Contas Nacionais do IBGE; 2024 e 2025 são os valores já divulgados nas Contas Trimestrais (preliminares, podem ser revisados). Estados e municípios: Contas Regionais, que o IBGE publica com cerca de 2 anos de atraso, por isso o último ano é 2023.", source: "IBGE (Contas Nacionais e Regionais)", sourceUrl: "https://www.ibge.gov.br/explica/pib.php", better: "up", fetch: { FEDERAL: sidraPib("FEDERAL"), ESTADUAL: sidraPib("ESTADUAL"), MUNICIPAL: sidraPib("MUNICIPAL") } },
  { id: "pib-pc", inflation: true, parent: "pib", group: "economia", name: "PIB por habitante", unit: "brl", desc: "PIB por habitante publicado pelo IBGE nas Contas Nacionais. Não existe série oficial pronta para estados e municípios.", source: "IBGE (Contas Nacionais, tabela 6784)", better: "up", fetch: { FEDERAL: pibPerCapitaOficial } },
  { id: "pib-cresc", parent: "pib", group: "economia", name: "Crescimento real do PIB", unit: "pct", decimals: 1, desc: "Variação do PIB em volume (já descontada a inflação).", source: "IBGE via Banco Central (SGS 7326)", better: "up", fetch: { FEDERAL: bcb(7326, "last") } },
  { id: "populacao", group: "economia", name: "População", unit: "count", desc: "População residente: estimativas anuais do IBGE e, em 2022, o número do Censo. Em 2023 o IBGE não publicou estimativa por estado e município, por isso esse ano não aparece.", source: "IBGE (estimativas de população)", fetch: { FEDERAL: sidraPop("FEDERAL"), ESTADUAL: sidraPop("ESTADUAL"), MUNICIPAL: sidraPop("MUNICIPAL") } },
  { id: "desemprego", group: "economia", name: "Desemprego (4º trimestre)", unit: "pct", decimals: 1, desc: "Taxa de desocupação do 4º trimestre de cada ano (PNAD Contínua), como o IBGE publica. Não existe por município.", source: "IBGE (PNAD Contínua, tabela 4099)", sourceUrl: "https://www.ibge.gov.br/explica/desemprego.php", better: "down", fetch: { FEDERAL: unemploymentQ4("FEDERAL"), ESTADUAL: unemploymentQ4("ESTADUAL") } },
  { id: "ipca", group: "economia", name: "Inflação (IPCA em 12 meses, dezembro)", unit: "pct", decimals: 2, desc: "Inflação acumulada em 12 meses até dezembro, como o IBGE divulga.", source: "IBGE via Banco Central (SGS 13522)", sourceUrl: "https://www.ibge.gov.br/explica/inflacao.php", better: "down", fetch: { FEDERAL: bcb(13522, "last") } },
  { id: "selic", group: "economia", name: "Juros básicos (Selic, fim do ano)", unit: "pct", decimals: 2, desc: "Taxa básica de juros definida pelo Banco Central. Influencia financiamentos, o custo da dívida pública e os investimentos.", source: "Banco Central (SGS 432)", sourceUrl: "https://www.bcb.gov.br/controleinflacao/taxaselic", fetch: { FEDERAL: bcb(432, "last") } },
  { id: "dolar", group: "economia", name: "Dólar (cotação no fim do ano)", unit: "brl", decimals: 2, desc: "Cotação de venda do dólar (PTAX) no último dia útil do ano.", source: "Banco Central (SGS 3692)", fetch: { FEDERAL: bcb(3692, "last") } },
  { id: "salario-minimo", inflation: true, group: "economia", name: "Salário mínimo", unit: "brl", decimals: 0, desc: "Valor do salário mínimo nacional no fim do ano (sem correção pela inflação).", source: "Banco Central (SGS 1619)", better: "up", fetch: { FEDERAL: bcb(1619, "last") } },
  { id: "salario-medio", inflation: true, group: "economia", name: "Salário médio mensal nas empresas", unit: "brl", decimals: 0, desc: "Salário médio mensal do pessoal ocupado em empresas e outras organizações (Cadastro Central de Empresas). Dado até 2021 no IBGE.", source: "IBGE (CEMPRE, tabela 1685)", better: "up", fetch: { MUNICIPAL: cempre(10143) } },
  { id: "pessoal-ocupado", parent: "salario-medio", group: "economia", name: "Pessoal ocupado nas empresas", unit: "count", desc: "Quantidade de pessoas ocupadas em empresas e outras organizações do município.", source: "IBGE (CEMPRE, tabela 1685)", better: "up", fetch: { MUNICIPAL: cempre(707) } },
  { id: "importacoes", group: "economia", name: "Importações de bens (acumulado no ano)", unit: "usd", desc: "Valor das importações brasileiras de bens (balanço de pagamentos), somado no ano. Serve de base para a meta das reservas: cobrir 3 meses de importações.", source: "Banco Central (SGS 22709)", fetch: { FEDERAL: bcb(22709, "sum", 1e6) } },
  { id: "reservas", group: "economia", name: "Reservas internacionais (fim do ano)", unit: "usd", desc: "Dólares e outros ativos que o país guarda no exterior (conceito liquidez), no fim do ano.", source: "Banco Central (SGS 3546)", better: "up", fetch: { FEDERAL: bcb(3546, "last", 1e6) } },

  /* ═════ Finanças do governo ═════ */
  { id: "divida-liquida", group: "financas", name: "Dívida pública (setor público, líquida)", unit: "pct", decimals: 1, desc: "Dívida líquida de todo o setor público (governo federal, estados, municípios e estatais), em % do PIB, no fim do ano. 'Líquida' desconta os ativos do governo.", source: "Banco Central (SGS 4513)", better: "down", fetch: { FEDERAL: bcb(4513, "last") } },
  { id: "divida-bruta", parent: "divida-liquida", group: "financas", name: "Dívida bruta do governo geral", unit: "pct", decimals: 1, desc: "Tudo o que o governo geral (União, estados e municípios) deve, sem descontar ativos, em % do PIB.", source: "Banco Central (SGS 13762)", better: "down", fetch: { FEDERAL: bcb(13762, "last") } },
  { id: "divida-liquida-gg", parent: "divida-liquida", group: "financas", name: "Dívida líquida do governo geral", unit: "pct", decimals: 1, desc: "Dívida do governo geral já descontados os ativos, em % do PIB.", source: "Banco Central (SGS 4536)", better: "down", fetch: { FEDERAL: bcb(4536, "last") } },
  { id: "deficit-primario", group: "financas", name: "Déficit primário (+) ou superávit (−)", unit: "pct", decimals: 2, desc: "Resultado das contas do setor público sem contar juros, em % do PIB, acumulado em 12 meses. Positivo = déficit (gastou mais do que arrecadou); negativo = superávit.", source: "Banco Central (SGS 5793, NFSP)", better: "down", fetch: { FEDERAL: bcb(5793, "last") } },
  { id: "deficit-nominal", parent: "deficit-primario", group: "financas", name: "Déficit nominal (com juros)", unit: "pct", decimals: 2, desc: "Resultado das contas incluindo os juros pagos, em % do PIB (12 meses). Positivo = déficit.", source: "Banco Central (SGS 5727)", better: "down", fetch: { FEDERAL: bcb(5727, "last") } },
  { id: "dcl-rcl", group: "financas", name: "Dívida do estado/município vs. receita", unit: "pct", decimals: 1, desc: "Dívida consolidada líquida em % da receita corrente líquida (fim do ano). O limite legal é de 200% para estados e 120% para municípios.", source: "Tesouro Nacional (Siconfi, RGF Anexo 2)", sourceUrl: "https://siconfi.tesouro.gov.br", better: "down", fetch: { ESTADUAL: dclRcl("ESTADUAL"), MUNICIPAL: dclRcl("MUNICIPAL") } },
  { id: "pessoal-rcl", group: "financas", name: "Gasto com pessoal vs. receita", unit: "pct", decimals: 1, desc: "Despesa total com pessoal (Poder Executivo) em % da receita corrente líquida ajustada, como consta no Relatório de Gestão Fiscal. A Lei de Responsabilidade Fiscal limita a 54% nos municípios e 49% nos estados.", source: "Tesouro Nacional (Siconfi, RGF Anexo 1)", sourceUrl: "https://siconfi.tesouro.gov.br", fetch: { ESTADUAL: pessoalRcl("ESTADUAL"), MUNICIPAL: pessoalRcl("MUNICIPAL") } },
  { id: "despesa-total", inflation: true, group: "financas", name: "Despesa total", unit: "brl", desc: "Despesa total empenhada no ano, como o governo declarou ao Tesouro (valores do ano, sem correção pela inflação).", source: "Tesouro Nacional (Siconfi, DCA)", sourceUrl: "https://siconfi.tesouro.gov.br", fetch: { FEDERAL: budgetTotal("FEDERAL", "expense"), ESTADUAL: budgetTotal("ESTADUAL", "expense"), MUNICIPAL: budgetTotal("MUNICIPAL", "expense") } },
  { id: "gasto-pessoal", inflation: true, parent: "despesa-total", group: "financas", name: "Pessoal e encargos sociais", unit: "brl", desc: "Valor gasto com salários, encargos e aposentadorias, como declarado no DCA.", source: "Tesouro Nacional (Siconfi, DCA)", fetch: { FEDERAL: expenseValue("FEDERAL", "nat:3.1"), ESTADUAL: expenseValue("ESTADUAL", "nat:3.1"), MUNICIPAL: expenseValue("MUNICIPAL", "nat:3.1") } },
  { id: "gasto-juros", inflation: true, parent: "despesa-total", group: "financas", name: "Juros e encargos da dívida", unit: "brl", desc: "Valor pago em juros e encargos da dívida, como declarado no DCA.", source: "Tesouro Nacional (Siconfi, DCA)", better: "down", fetch: { FEDERAL: expenseValue("FEDERAL", "nat:3.2"), ESTADUAL: expenseValue("ESTADUAL", "nat:3.2"), MUNICIPAL: expenseValue("MUNICIPAL", "nat:3.2") } },
  { id: "gasto-investimento", inflation: true, parent: "despesa-total", group: "financas", name: "Investimentos", unit: "brl", desc: "Valor investido em obras, equipamentos e outros investimentos, como declarado no DCA.", source: "Tesouro Nacional (Siconfi, DCA)", better: "up", fetch: { FEDERAL: expenseValue("FEDERAL", "nat:4.4"), ESTADUAL: expenseValue("ESTADUAL", "nat:4.4"), MUNICIPAL: expenseValue("MUNICIPAL", "nat:4.4") } },
  { id: "gasto-amortizacao", inflation: true, parent: "despesa-total", group: "financas", name: "Amortização da dívida", unit: "brl", desc: "Valor pago do principal da dívida, como declarado no DCA. Na União inclui a rolagem da dívida.", source: "Tesouro Nacional (Siconfi, DCA)", fetch: { FEDERAL: expenseValue("FEDERAL", "nat:4.6"), ESTADUAL: expenseValue("ESTADUAL", "nat:4.6"), MUNICIPAL: expenseValue("MUNICIPAL", "nat:4.6") } },
  { id: "transferencias", inflation: true, group: "financas", name: "Receita de transferências de outros governos", unit: "brl", desc: "Valor recebido em transferências correntes (ex.: FPM, ICMS repassado, SUS, Fundeb), como declarado no DCA. Não se aplica à União.", source: "Tesouro Nacional (Siconfi, DCA)", fetch: { ESTADUAL: revenueValue("ESTADUAL", /transfer.ncias correntes/i), MUNICIPAL: revenueValue("MUNICIPAL", /transfer.ncias correntes/i) } },
  { id: "tributos-proprios", inflation: true, parent: "transferencias", group: "financas", name: "Receita de impostos, taxas e contribuições", unit: "brl", desc: "Valor arrecadado pelo próprio governo em impostos, taxas e contribuições de melhoria, como declarado no DCA.", source: "Tesouro Nacional (Siconfi, DCA)", fetch: { FEDERAL: revenueValue("FEDERAL", /impostos, taxas/i), ESTADUAL: revenueValue("ESTADUAL", /impostos, taxas/i), MUNICIPAL: revenueValue("MUNICIPAL", /impostos, taxas/i) } },

  /* ═════ Famílias e crédito ═════ */
  { id: "endividamento", group: "familias", name: "Endividamento das famílias", unit: "pct", decimals: 1, desc: "Dívidas das famílias com o sistema financeiro como % da renda dos últimos 12 meses (fim do ano).", source: "Banco Central (SGS 29037)", better: "down", fetch: { FEDERAL: bcb(29037, "last") } },
  { id: "endividamento-sem-habitacao", parent: "endividamento", group: "familias", name: "Endividamento sem financiamento da casa", unit: "pct", decimals: 1, desc: "Igual ao anterior, sem o crédito habitacional.", source: "Banco Central (SGS 29038)", better: "down", fetch: { FEDERAL: bcb(29038, "last") } },
  { id: "comprometimento", parent: "endividamento", group: "familias", name: "Renda comprometida com dívidas", unit: "pct", decimals: 1, desc: "Parte da renda mensal das famílias usada para pagar juros e prestações (com ajuste sazonal).", source: "Banco Central (SGS 29034)", better: "down", fetch: { FEDERAL: bcb(29034, "last") } },
  { id: "inadimplencia", group: "familias", name: "Inadimplência de pessoas físicas", unit: "pct", decimals: 2, desc: "Parcela do crédito livre das pessoas físicas com atraso de mais de 90 dias (fim do ano).", source: "Banco Central (SGS 21112)", better: "down", fetch: { FEDERAL: bcb(21112, "last") } },
  { id: "inadimplencia-total", parent: "inadimplencia", group: "familias", name: "Inadimplência total do crédito", unit: "pct", decimals: 2, desc: "Parcela de todo o crédito do sistema financeiro com atraso de mais de 90 dias.", source: "Banco Central (SGS 21082)", better: "down", fetch: { FEDERAL: bcb(21082, "last") } },
  { id: "credito-pib", group: "familias", name: "Crédito em relação ao PIB", unit: "pct", decimals: 1, desc: "Saldo total das operações de crédito do sistema financeiro em % do PIB.", source: "Banco Central (SGS 20622)", fetch: { FEDERAL: bcb(20622, "last") } },

  /* ═════ Segurança ═════ */
  { id: "homicidios", group: "seguranca", name: "Homicídios por 100 mil habitantes", unit: "rate", decimals: 1, desc: "Taxa de mortes por agressão (homicídios, incluindo intervenções policiais). Dado do Sistema de Informações sobre Mortalidade (Ministério da Saúde), tratado pelo Atlas da Violência. Nos municípios há 2 anos de atraso e, em cidades pequenas, a taxa oscila muito de um ano para o outro.", source: "IPEA, Atlas da Violência (SIM/DATASUS)", sourceUrl: "https://www.ipea.gov.br/atlasviolencia/", better: "down", fed: true, fetch: { FEDERAL: stored("homicidios", "FEDERAL"), ESTADUAL: stored("homicidios", "ESTADUAL"), MUNICIPAL: stored("homicidios", "MUNICIPAL") } },
  { id: "homicidios-n", parent: "homicidios", group: "seguranca", name: "Número de homicídios", unit: "count", desc: "Quantidade de mortes por agressão no ano.", source: "IPEA, Atlas da Violência (SIM/DATASUS)", better: "down", fed: true, fetch: { FEDERAL: stored("homicidios-n", "FEDERAL"), ESTADUAL: stored("homicidios-n", "ESTADUAL"), MUNICIPAL: stored("homicidios-n", "MUNICIPAL") } },

  /* ═════ Pobreza e renda ═════ */
  { id: "pobreza", group: "social", name: "Pessoas em situação de pobreza", unit: "pct", decimals: 1, desc: "Percentual da população abaixo da linha de pobreza nacional do IBGE para os ODS (US$ 8,30 por dia, paridade do poder de compra de 2021), na PNAD Contínua. 2025 não aparece: o Ipeadata o marca como estimado. Não existe anualmente por município.", source: "IBGE (SIS) via IPEA (PNADCA_TXPNUF)", sourceUrl: "https://www.ibge.gov.br/estatisticas/sociais/trabalho/", better: "down", fed: true, fetch: { FEDERAL: stored("pobreza", "FEDERAL"), ESTADUAL: stored("pobreza", "ESTADUAL") } },
  { id: "pobreza-int", parent: "pobreza", group: "social", name: "Pobreza pela linha internacional", unit: "pct", decimals: 1, desc: "Percentual da população abaixo da linha internacional de pobreza do Banco Mundial (US$ 3,00 por dia, paridade do poder de compra de 2021). 2025 não aparece: o Ipeadata o marca como estimado.", source: "IBGE (SIS) via IPEA (PNADCA_TXPIUF)", better: "down", fed: true, fetch: { FEDERAL: stored("pobreza-int", "FEDERAL"), ESTADUAL: stored("pobreza-int", "ESTADUAL") } },
  { id: "renda-trabalho", real: true, group: "social", name: "Rendimento médio real do trabalho", unit: "brl", decimals: 0, desc: "Rendimento médio mensal habitual de todos os trabalhos das pessoas ocupadas, já a preços constantes do último ano (valor real publicado pelo IBGE; PNAD Contínua anual).", source: "IBGE (PNAD Contínua anual, tabela 7444)", sourceUrl: "https://www.ibge.gov.br/estatisticas/sociais/trabalho/", better: "up", fetch: { FEDERAL: incomeReal("FEDERAL"), ESTADUAL: incomeReal("ESTADUAL") } },
  { id: "subutilizacao", group: "social", name: "Subutilização da força de trabalho (4º trimestre)", unit: "pct", decimals: 1, desc: "Taxa composta de subutilização: desocupados, quem trabalha menos horas do que gostaria e quem está disponível mas não procurou trabalho, em % da força de trabalho ampliada. Valor do 4º trimestre, como o IBGE publica (PNAD Contínua).", source: "IBGE (PNAD Contínua, tabela 4099)", sourceUrl: "https://www.ibge.gov.br/explica/desemprego.php", better: "down", fetch: { FEDERAL: unemploymentQ4("FEDERAL", 4118), ESTADUAL: unemploymentQ4("ESTADUAL", 4118) } },
  { id: "informalidade", group: "social", name: "Informalidade no trabalho", unit: "pct", decimals: 1, desc: "Percentual dos ocupados em trabalho informal (sem carteira, sem CNPJ etc.), como publicado pelo IBGE na PNAD Contínua anual.", source: "IBGE (PNAD Contínua anual, tabela 4708)", better: "down", fetch: { FEDERAL: sidraAnnual("FEDERAL", 4708, 12466), ESTADUAL: sidraAnnual("ESTADUAL", 4708, 12466) } },
  { id: "desalento", group: "social", name: "Desalentados (desistiram de procurar emprego)", unit: "pct", decimals: 1, desc: "Percentual de pessoas desalentadas (querem trabalhar, mas desistiram de procurar por achar que não vão encontrar) na força de trabalho ampliada. PNAD Contínua anual.", source: "IBGE (PNAD Contínua anual, tabela 4679)", better: "down", fetch: { FEDERAL: sidraAnnual("FEDERAL", 4679, 9869), ESTADUAL: sidraAnnual("ESTADUAL", 4679, 9869) } },
  { id: "nem-nem", group: "social", name: "Jovens de 15 a 24 anos que não estudam nem trabalham", unit: "pct", decimals: 1, desc: "Percentual de jovens de 15 a 24 anos não ocupados, não estudantes e fora de treinamento (indicador 8.6.1 dos Objetivos de Desenvolvimento Sustentável, IBGE).", source: "IBGE (ODS 8.6.1, tabela 9415)", better: "down", fetch: { FEDERAL: sidraAnnual("FEDERAL", 9415, 8840), ESTADUAL: sidraAnnual("ESTADUAL", 9415, 8840) } },
  { id: "previdencia", group: "social", name: "Ocupados que contribuem para a previdência", unit: "pct", decimals: 1, desc: "Percentual de pessoas ocupadas que contribuem para instituto de previdência em qualquer trabalho. PNAD Contínua anual.", source: "IBGE (PNAD Contínua anual, tabela 4358)", better: "up", fetch: { FEDERAL: sidraAnnual("FEDERAL", 4358, 8463), ESTADUAL: sidraAnnual("ESTADUAL", 4358, 8463) } },
  { id: "pobreza-ocupados", group: "social", name: "Ocupados abaixo da linha de pobreza", unit: "pct", decimals: 1, desc: "Proporção da população ocupada de 14 anos ou mais vivendo abaixo da linha de pobreza nacional (ODS 1.2.1, IBGE).", source: "IBGE (ODS 1.2.1, tabela 8686)", better: "down", fetch: { FEDERAL: sidraAnnual("FEDERAL", 8686, 9962), ESTADUAL: sidraAnnual("ESTADUAL", 8686, 9962) } },
  { id: "suicidio", group: "servicos", name: "Mortalidade por suicídio (por 100 mil)", unit: "rate", decimals: 1, desc: "Taxa de mortalidade por suicídio por 100 mil habitantes (ODS 3.4.2, IBGE com dados do Ministério da Saúde).", source: "IBGE (ODS 3.4.2, tabela 8183)", better: "down", fetch: { FEDERAL: sidraAnnual("FEDERAL", 8183, 11704, "/c2/6794/c58/95253"), ESTADUAL: sidraAnnual("ESTADUAL", 8183, 11704, "/c2/6794/c58/95253") } },
  { id: "transito", group: "seguranca", name: "Mortes no trânsito (por 100 mil)", unit: "rate", decimals: 1, desc: "Taxa de mortalidade por lesões de trânsito por 100 mil habitantes (ODS 3.6.1, IBGE com dados do Ministério da Saúde).", source: "IBGE (ODS 3.6.1, tabela 4408)", better: "down", fetch: { FEDERAL: sidraAnnual("FEDERAL", 4408, 9734, "/c2/6794/c58/95253"), ESTADUAL: sidraAnnual("ESTADUAL", 4408, 9734, "/c2/6794/c58/95253") } },
  { id: "mortalidade-5", group: "servicos", name: "Mortalidade de menores de 5 anos (por mil)", unit: "rate", decimals: 1, desc: "Mortes de crianças com menos de 5 anos por mil nascidos vivos (ODS 3.2.1, IBGE).", source: "IBGE (ODS 3.2.1, tabela 6695)", better: "down", fetch: { FEDERAL: sidraAnnual("FEDERAL", 6695, 9731), ESTADUAL: sidraAnnual("ESTADUAL", 6695, 9731) } },
  { id: "mortalidade-neonatal", group: "servicos", name: "Mortalidade neonatal (por mil)", unit: "rate", decimals: 1, desc: "Mortes de bebês nos primeiros 27 dias de vida por mil nascidos vivos (ODS 3.2.2, IBGE).", source: "IBGE (ODS 3.2.2, tabela 6696)", better: "down", fetch: { FEDERAL: sidraAnnual("FEDERAL", 6696, 9732), ESTADUAL: sidraAnnual("ESTADUAL", 6696, 9732) } },
  { id: "mortalidade-materna", group: "servicos", name: "Mortalidade materna (por 100 mil nascidos vivos)", unit: "rate", decimals: 1, desc: "Razão de mortalidade materna: mortes de mulheres por causas ligadas à gravidez, parto e pós-parto por 100 mil nascidos vivos (ODS 3.1.1, IBGE).", source: "IBGE (ODS 3.1.1, tabela 6694)", better: "down", fetch: { FEDERAL: sidraAnnual("FEDERAL", 6694, 9730), ESTADUAL: sidraAnnual("ESTADUAL", 6694, 9730) } },
  { id: "gini", group: "social", name: "Desigualdade de renda (Gini)", unit: "index", decimals: 3, desc: "Índice de Gini do rendimento domiciliar per capita: de 0 (todos ganham igual) a 1 (uma pessoa fica com tudo). Só existe por município nos Censos.", source: "IBGE (PNAD Contínua, tabela 7435)", better: "down", fetch: { FEDERAL: giniSidra("FEDERAL"), ESTADUAL: giniSidra("ESTADUAL") } },

  /* ═════ Saúde, educação e saneamento ═════ */
  { id: "analfabetismo", group: "servicos", name: "Analfabetismo (15 anos ou mais)", unit: "pct", decimals: 1, desc: "Percentual de pessoas de 15 anos ou mais que não sabem ler e escrever um bilhete simples.", source: "IBGE (PNAD Contínua) via IPEA (PNADCA_TXA15MUF)", better: "down", fed: true, fetch: { FEDERAL: stored("analfabetismo", "FEDERAL"), ESTADUAL: stored("analfabetismo", "ESTADUAL") } },
  { id: "analfabetismo-censo", group: "servicos", name: "Analfabetismo (15 anos ou mais, Censo 2022)", unit: "pct", decimals: 1, desc: "Percentual de pessoas de 15 anos ou mais que não sabem ler e escrever, pelo Censo 2022 (o único dado oficial por município; a PNAD não chega às cidades).", source: "IBGE (Censo 2022, tabela 9543)", sourceUrl: "https://sidra.ibge.gov.br/tabela/9543", better: "down", ttlDays: 90, fetch: { MUNICIPAL: censo2022("MUNICIPAL", 9543, 2513, "/c2/6794/c86/95251/c287/100362", true) } },
  { id: "agua-rede", group: "servicos", name: "Domicílios ligados à rede de água", unit: "pct", decimals: 1, desc: "Percentual dos domicílios cuja principal forma de abastecimento é a rede geral de distribuição (Censo 2022). Poço, nascente, carro-pipa e água da chuva ficam de fora.", source: "IBGE (Censo 2022, tabela 6804)", sourceUrl: "https://sidra.ibge.gov.br/tabela/6804", better: "up", ttlDays: 90, fetch: { FEDERAL: censo2022("FEDERAL", 6804, 1000381, "/c301/31471"), ESTADUAL: censo2022("ESTADUAL", 6804, 1000381, "/c301/31471"), MUNICIPAL: censo2022("MUNICIPAL", 6804, 1000381, "/c301/31471") } },
  { id: "esgoto-rede", group: "servicos", name: "Domicílios ligados à rede de esgoto", unit: "pct", decimals: 1, desc: "Percentual dos domicílios com esgoto na rede geral, na rede pluvial ou em fossa ligada à rede (Censo 2022). Não diz se o esgoto é tratado depois de coletado.", source: "IBGE (Censo 2022, tabela 6805)", sourceUrl: "https://sidra.ibge.gov.br/tabela/6805", better: "up", ttlDays: 90, fetch: { FEDERAL: censo2022("FEDERAL", 6805, 1000381, "/c11558/46290"), ESTADUAL: censo2022("ESTADUAL", 6805, 1000381, "/c11558/46290"), MUNICIPAL: censo2022("MUNICIPAL", 6805, 1000381, "/c11558/46290") } },
  { id: "sem-banheiro", parent: "esgoto-rede", group: "servicos", name: "Domicílios sem banheiro nem sanitário", unit: "pct", decimals: 2, desc: "Percentual dos domicílios que não têm banheiro nem sanitário (Censo 2022).", source: "IBGE (Censo 2022, tabela 6805)", sourceUrl: "https://sidra.ibge.gov.br/tabela/6805", better: "down", ttlDays: 90, fetch: { FEDERAL: censo2022("FEDERAL", 6805, 1000381, "/c11558/92861"), ESTADUAL: censo2022("ESTADUAL", 6805, 1000381, "/c11558/92861"), MUNICIPAL: censo2022("MUNICIPAL", 6805, 1000381, "/c11558/92861") } },
  { id: "lixo-coletado", group: "servicos", name: "Domicílios com coleta de lixo", unit: "pct", decimals: 1, desc: "Percentual dos domicílios cujo lixo é coletado pelo serviço de limpeza, na porta ou em caçamba (Censo 2022).", source: "IBGE (Censo 2022, tabela 6892)", sourceUrl: "https://sidra.ibge.gov.br/tabela/6892", better: "up", ttlDays: 90, fetch: { FEDERAL: censo2022("FEDERAL", 6892, 1000381, "/c67/2520"), ESTADUAL: censo2022("ESTADUAL", 6892, 1000381, "/c67/2520"), MUNICIPAL: censo2022("MUNICIPAL", 6892, 1000381, "/c67/2520") } },
  { id: "creche", group: "servicos", name: "Crianças de 0 a 3 anos na creche ou escola", unit: "pct", decimals: 1, desc: "Percentual das crianças de 0 a 3 anos que frequentavam creche ou escola (Censo 2022).", source: "IBGE (Censo 2022, tabela 10057)", sourceUrl: "https://sidra.ibge.gov.br/tabela/10057", better: "up", ttlDays: 90, fetch: { FEDERAL: censo2022("FEDERAL", 10057, 1013282, "/c11798/95300/c58/99749/c2/6794/c86/95251"), ESTADUAL: censo2022("ESTADUAL", 10057, 1013282, "/c11798/95300/c58/99749/c2/6794/c86/95251"), MUNICIPAL: censo2022("MUNICIPAL", 10057, 1013282, "/c11798/95300/c58/99749/c2/6794/c86/95251") } },
  { id: "pre-escola", group: "servicos", name: "Crianças de 5 anos na escola", unit: "pct", decimals: 1, desc: "Percentual das crianças de 5 anos que frequentam a escola (indicador 4.2.2 dos ODS, PNAD Contínua).", source: "IBGE (Indicadores dos ODS, tabela 4734)", sourceUrl: "https://sidra.ibge.gov.br/tabela/4734", better: "up", ttlDays: 30, fetch: { FEDERAL: sidraAnnual("FEDERAL", 4734, 4796, "/c2/6794"), ESTADUAL: sidraAnnual("ESTADUAL", 4734, 4796, "/c2/6794") } },
  { id: "escola-15-17", group: "servicos", name: "Jovens de 15 a 17 anos na escola", unit: "pct", decimals: 1, desc: "Taxa de escolarização dos jovens de 15 a 17 anos, a idade do ensino médio (Censo 2022).", source: "IBGE (Censo 2022, tabela 10139)", sourceUrl: "https://sidra.ibge.gov.br/tabela/10139", better: "up", ttlDays: 90, fetch: { FEDERAL: censo2022("FEDERAL", 10139, 12805, "/c2/6794/c58/2792/c839/46583"), ESTADUAL: censo2022("ESTADUAL", 10139, 12805, "/c2/6794/c58/2792/c839/46583"), MUNICIPAL: censo2022("MUNICIPAL", 10139, 12805, "/c2/6794/c58/2792/c839/46583") } },
  { id: "conclusao-medio", group: "servicos", name: "Jovens de 20 a 22 anos com ensino médio completo", unit: "pct", decimals: 1, desc: "Taxa de conclusão do ensino médio entre os jovens de 20 a 22 anos (indicador 4.1.2 dos ODS, PNAD Contínua).", source: "IBGE (Indicadores dos ODS, tabela 4731)", sourceUrl: "https://sidra.ibge.gov.br/tabela/4731", better: "up", ttlDays: 30, fetch: { FEDERAL: sidraAnnual("FEDERAL", 4731, 4721, "/c582/59997"), ESTADUAL: sidraAnnual("ESTADUAL", 4731, 4721, "/c582/59997") } },
  { id: "conclusao-fund", parent: "conclusao-medio", group: "servicos", name: "Jovens de 17 a 19 anos com ensino fundamental completo", unit: "pct", decimals: 1, desc: "Taxa de conclusão do ensino fundamental entre os jovens de 17 a 19 anos (indicador 4.1.2 dos ODS).", source: "IBGE (Indicadores dos ODS, tabela 4731)", sourceUrl: "https://sidra.ibge.gov.br/tabela/4731", better: "up", ttlDays: 30, fetch: { FEDERAL: sidraAnnual("FEDERAL", 4731, 4721, "/c582/59996"), ESTADUAL: sidraAnnual("ESTADUAL", 4731, 4721, "/c582/59996") } },
  { id: "gravidez-adolescente", group: "servicos", name: "Gravidez na adolescência (por mil meninas de 15 a 19 anos)", unit: "rate", decimals: 1, desc: "Nascidos vivos de mães de 15 a 19 anos por mil mulheres dessa idade (indicador 3.7.2 dos ODS). Gravidez precoce interrompe estudos e se concentra nas famílias pobres.", source: "IBGE (Indicadores dos ODS, tabela 8174)", sourceUrl: "https://sidra.ibge.gov.br/tabela/8174", better: "down", ttlDays: 30, fetch: { FEDERAL: sidraAnnual("FEDERAL", 8174, 11687, "/c58/1143"), ESTADUAL: sidraAnnual("ESTADUAL", 8174, 11687, "/c58/1143") } },
  { id: "mortalidade-cronicas", group: "servicos", name: "Morte prematura por doenças crônicas (30 a 69 anos)", unit: "pct", decimals: 1, desc: "Probabilidade de morrer entre 30 e 69 anos por doença do coração, câncer, diabetes ou doença respiratória crônica (indicador 3.4.1 dos ODS). Mede prevenção e acesso a tratamento.", source: "IBGE (Indicadores dos ODS, tabela 4277)", sourceUrl: "https://sidra.ibge.gov.br/tabela/4277", better: "down", ttlDays: 30, fetch: { FEDERAL: sidraAnnual("FEDERAL", 4277, 11754, "/c2/6794/c58/56742"), ESTADUAL: sidraAnnual("ESTADUAL", 4277, 11754, "/c2/6794/c58/56742") } },
  { id: "mortes-saneamento", group: "servicos", name: "Mortes por água e saneamento inseguros (por 100 mil)", unit: "rate", decimals: 2, desc: "Mortes atribuídas a água imprópria, saneamento inadequado e falta de higiene, por 100 mil habitantes (indicador 3.9.2 dos ODS).", source: "IBGE (Indicadores dos ODS, tabela 8191)", sourceUrl: "https://sidra.ibge.gov.br/tabela/8191", better: "down", ttlDays: 30, fetch: { FEDERAL: sidraAnnual("FEDERAL", 8191, 9737, "/c2/6794/c58/95253"), ESTADUAL: sidraAnnual("ESTADUAL", 8191, 9737, "/c2/6794/c58/95253") } },
  { id: "agua-segura", group: "servicos", name: "População com água potável segura", unit: "pct", decimals: 1, desc: "Percentual da população com água potável gerenciada de forma segura (indicador 6.1.1 dos ODS, PNAD Contínua): série anual, ao contrário do Censo.", source: "IBGE (Indicadores dos ODS, tabela 9787)", sourceUrl: "https://sidra.ibge.gov.br/tabela/9787", better: "up", ttlDays: 30, fetch: { FEDERAL: sidraAnnual("FEDERAL", 9787, 9484, ""), ESTADUAL: sidraAnnual("ESTADUAL", 9787, 9484, "") } },
  { id: "energia", group: "servicos", name: "Moradores com energia elétrica", unit: "pct", decimals: 1, desc: "Percentual de moradores em domicílios com energia elétrica (indicador 7.1.1 dos ODS).", source: "IBGE (Indicadores dos ODS, tabela 9740)", sourceUrl: "https://sidra.ibge.gov.br/tabela/9740", better: "up", ttlDays: 30, fetch: { FEDERAL: sidraAnnual("FEDERAL", 9740, 10137, ""), ESTADUAL: sidraAnnual("ESTADUAL", 9740, 10137, "") } },
  { id: "moradia-precaria", group: "social", name: "População urbana em moradia precária", unit: "pct", decimals: 1, desc: "Percentual da população urbana em favelas, assentamentos informais ou domicílios inadequados (indicador 11.1.1 dos ODS; dados dos Censos 2010 e 2022).", source: "IBGE (Indicadores dos ODS, tabela 6585)", sourceUrl: "https://sidra.ibge.gov.br/tabela/6585", better: "down", ttlDays: 90, fetch: { FEDERAL: sidraAnnual("FEDERAL", 6585, 9326, ""), ESTADUAL: sidraAnnual("ESTADUAL", 6585, 9326, "") } },
  { id: "inseguranca-grave", group: "social", name: "Moradores com insegurança alimentar grave (fome)", unit: "pct", decimals: 1, desc: "Percentual de moradores em domicílios com insegurança alimentar grave, a situação de fome (Escala Brasileira de Insegurança Alimentar, PNAD; indicador 2.1.2 dos ODS).", source: "IBGE (Indicadores dos ODS, tabela 6665)", sourceUrl: "https://sidra.ibge.gov.br/tabela/6665", better: "down", ttlDays: 30, fetch: { FEDERAL: sidraAnnual("FEDERAL", 6665, 2133, "/c12404/109102") } },
  { id: "inseguranca-alimentar", parent: "inseguranca-grave", group: "social", name: "Moradores com algum grau de insegurança alimentar", unit: "pct", decimals: 1, desc: "Percentual de moradores em domicílios com insegurança alimentar leve, moderada ou grave.", source: "IBGE (Indicadores dos ODS, tabela 6665)", sourceUrl: "https://sidra.ibge.gov.br/tabela/6665", better: "down", ttlDays: 30, fetch: { FEDERAL: sidraAnnual("FEDERAL", 6665, 2133, "/c12404/109099") } },
  { id: "trabalho-infantil", group: "social", name: "Crianças e adolescentes em trabalho infantil", unit: "pct", decimals: 1, desc: "Percentual das pessoas de 5 a 17 anos em situação de trabalho infantil, pela definição conjunta de Unicef e OIT (indicador 8.7.1 dos ODS), que conta só parte das atividades e por isso fica abaixo do número geral de trabalho infantil divulgado pelo IBGE.", source: "IBGE (Indicadores dos ODS, tabela 9785)", sourceUrl: "https://sidra.ibge.gov.br/tabela/9785", better: "down", ttlDays: 30, fetch: { FEDERAL: sidraAnnual("FEDERAL", 9785, 9480, "/c2/6794") } },
  { id: "deslocamento-1h", group: "servicos", name: "Trabalhadores que levam mais de 1 hora até o trabalho", unit: "pct", decimals: 1, desc: "Percentual de quem trabalha fora de casa e leva mais de uma hora no caminho de casa para o trabalho (Censo 2022).", source: "IBGE (Censo 2022, tabela 10331)", sourceUrl: "https://sidra.ibge.gov.br/tabela/10331", better: "down", ttlDays: 90, fetch: { FEDERAL: sidraSum("FEDERAL", 10331, 1013556, "/c537/19432,79191,79192/c2/6794/c86/95251/c386/9680"), ESTADUAL: sidraSum("ESTADUAL", 10331, 1013556, "/c537/19432,79191,79192/c2/6794/c86/95251/c386/9680"), MUNICIPAL: sidraSum("MUNICIPAL", 10331, 1013556, "/c537/19432,79191,79192/c2/6794/c86/95251/c386/9680") } },
  { id: "mortalidade-infantil", group: "servicos", name: "Mortalidade infantil (por mil nascidos vivos)", unit: "rate", decimals: 1, desc: "Crianças que morrem antes de completar 1 ano, por mil nascidos vivos. Só há série nacional.", source: "IBGE via IPEA (DEPIS_TMI)", better: "down", fed: true, fetch: { FEDERAL: stored("mortalidade-infantil", "FEDERAL") } },
];

/** Gráficos com várias linhas (uma por componente publicado). */
export const BUNDLES: { id: string; group: GroupId; title: string; desc: string; source: string; sourceUrl?: string; unit: Unit; decimals?: number; inflation?: boolean }[] = [
  {
    id: "pib-setores-valor",
    group: "economia",
    title: "PIB por setor da economia (R$)",
    unit: "brl",
    inflation: true,
    desc: "Valor adicionado bruto de cada setor, em reais correntes, como publicado nas Contas Regionais do IBGE: Agropecuária; Indústria; Serviços, que o IBGE publica em duas partes (serviços privados e administração pública); e os impostos sobre produtos, que somados ao valor adicionado formam o PIB. O IBGE ainda não publicou a divisão por setor de 2022 e 2023, por isso a série termina em 2021.",
    source: "IBGE (Contas Regionais, tabela 5938)",
    sourceUrl: "https://www.ibge.gov.br/estatisticas/economicas/contas-nacionais/9054-contas-regionais-do-brasil.html",
  },
  {
    id: "pib-setores-share",
    group: "economia",
    title: "Peso de cada setor no valor adicionado (%)",
    unit: "pct",
    decimals: 1,
    desc: "Participação de cada setor no valor adicionado bruto total do local, como publicada pelo IBGE (não é calculada aqui). Mostra de onde vem a riqueza produzida: roça, fábricas, serviços ou governo.",
    source: "IBGE (Contas Regionais, tabela 5938)",
    sourceUrl: "https://www.ibge.gov.br/estatisticas/economicas/contas-nacionais/9054-contas-regionais-do-brasil.html",
  },
];

const ALL3 = (v: number, scale = 1) => ({ FEDERAL: sectorFor("FEDERAL", v, scale), ESTADUAL: sectorFor("ESTADUAL", v, scale), MUNICIPAL: sectorFor("MUNICIPAL", v, scale) });

export const SECTOR_INDICATORS: Indicator[] = [
  { id: "setor-agro", bundle: "pib-setores-valor", inflation: true, group: "economia", name: "Agropecuária", unit: "brl", desc: "Valor adicionado bruto da agropecuária.", source: "IBGE (Contas Regionais, tabela 5938)", fetch: ALL3(513, 1000) },
  { id: "setor-industria", bundle: "pib-setores-valor", inflation: true, group: "economia", name: "Indústria", unit: "brl", desc: "Valor adicionado bruto da indústria (extrativa, transformação, eletricidade, água e construção).", source: "IBGE (Contas Regionais, tabela 5938)", fetch: ALL3(517, 1000) },
  { id: "setor-servicos", bundle: "pib-setores-valor", inflation: true, group: "economia", name: "Serviços privados (exceto administração pública)", unit: "brl", desc: "Valor adicionado bruto dos serviços, exclusive administração, defesa, educação e saúde públicas e seguridade social.", source: "IBGE (Contas Regionais, tabela 5938)", fetch: ALL3(6575, 1000) },
  { id: "setor-adm", bundle: "pib-setores-valor", inflation: true, group: "economia", name: "Administração, defesa, educação e saúde públicas", unit: "brl", desc: "Valor adicionado bruto da administração, defesa, educação e saúde públicas e seguridade social.", source: "IBGE (Contas Regionais, tabela 5938)", fetch: ALL3(525, 1000) },
  { id: "setor-impostos", bundle: "pib-setores-valor", inflation: true, group: "economia", name: "Impostos sobre produtos (líquidos de subsídios)", unit: "brl", desc: "Impostos sobre produtos, líquidos de subsídios, que somados ao valor adicionado bruto formam o PIB.", source: "IBGE (Contas Regionais, tabela 5938)", fetch: ALL3(543, 1000) },
  { id: "share-agro", bundle: "pib-setores-share", group: "economia", name: "Agropecuária", unit: "pct", decimals: 1, desc: "Participação da agropecuária no valor adicionado total.", source: "IBGE (Contas Regionais, tabela 5938)", fetch: ALL3(516) },
  { id: "share-industria", bundle: "pib-setores-share", group: "economia", name: "Indústria", unit: "pct", decimals: 1, desc: "Participação da indústria no valor adicionado total.", source: "IBGE (Contas Regionais, tabela 5938)", fetch: ALL3(520) },
  { id: "share-servicos", bundle: "pib-setores-share", group: "economia", name: "Serviços privados (exceto administração pública)", unit: "pct", decimals: 1, desc: "Participação dos serviços, exclusive administração pública, no valor adicionado total.", source: "IBGE (Contas Regionais, tabela 5938)", fetch: ALL3(6574) },
  { id: "share-adm", bundle: "pib-setores-share", group: "economia", name: "Administração, defesa, educação e saúde públicas", unit: "pct", decimals: 1, desc: "Participação da administração, defesa, educação e saúde públicas no valor adicionado total.", source: "IBGE (Contas Regionais, tabela 5938)", fetch: ALL3(528) },
];

export const indicatorsFor = (scope: Scope) => INDICATORS.filter((i) => i.fetch[scope]);

const inflight = new Map<string, Promise<unknown>>();
let running = 0;
const waiting: (() => void)[] = [];

/** Atualiza uma série em segundo plano (no máximo 3 por vez e sem repetir a mesma), sem fazer ninguém esperar. */
function refreshInBackground(key: string, ttlDays: number, fn: () => Promise<YearSeries>) {
  if (inflight.has(key)) return;
  const run = async () => {
    running++;
    try { await cached<YearSeries>(key, ttlDays, fn, true); } catch { /* tenta na próxima visita */ } finally {
      running--;
      inflight.delete(key);
      waiting.shift()?.();
    }
  };
  inflight.set(key, new Promise<void>((resolve) => {
    const go = () => { run().then(resolve); };
    if (running < 3) go(); else waiting.push(go);
  }));
}

/**
 * Série (já com cache no banco) de um indicador em uma esfera para o local do usuário.
 * `lazy`: nunca espera uma busca ao vivo — devolve o que já está guardado (mesmo velho, ou da versão anterior do cache) e atualiza em segundo plano;
 * se não houver nada guardado ainda, devolve null e a série aparece na próxima visita.
 */
export async function getSeries(ind: Indicator, scope: Scope, geo: Geo, opts: { force?: boolean; lazy?: boolean } = {}): Promise<YearSeries | null> {
  const f = ind.fetch[scope];
  if (!f) return null;
  if (ind.fed) {
    const v = await f(geo);
    return Object.keys(v).length ? v : null;
  }
  const place = scope === "FEDERAL" ? "br" : scope === "ESTADUAL" ? geo.uf : geo.ibge;
  const key = `ind:v7:${ind.id}:${scope}:${place}`;
  const ttl = ind.ttlDays ?? 7;
  const nonEmpty = (v: YearSeries | null | undefined) => (v && Object.keys(v).length ? v : null);
  if (opts.lazy && !opts.force) {
    const hit = await db.budgetCache.findUnique({ where: { key } });
    if (hit) {
      if (Date.now() - hit.fetchedAt.getTime() > ttl * 24 * 3600 * 1000) refreshInBackground(key, ttl, () => f(geo));
      return nonEmpty(hit.data as unknown as YearSeries);
    }
    // ainda não há a versão nova: usa a anterior enquanto a nova é preparada
    const old = await db.budgetCache.findUnique({ where: { key: `ind:v6:${ind.id}:${scope}:${place}` } });
    refreshInBackground(key, ttl, () => f(geo));
    return nonEmpty(old?.data as unknown as YearSeries | undefined);
  }
  if (!opts.force && !(await db.budgetCache.findUnique({ where: { key }, select: { key: true } }))) {
    // versão nova do cache ainda vazia: mostra a anterior na hora e prepara a nova em segundo plano
    const old = await db.budgetCache.findUnique({ where: { key: `ind:v6:${ind.id}:${scope}:${place}` } });
    if (old && nonEmpty(old.data as unknown as YearSeries)) {
      refreshInBackground(key, ttl, () => f(geo));
      return nonEmpty(old.data as unknown as YearSeries);
    }
  }
  const out = await cached<YearSeries>(key, ttl, () => f(geo), opts.force);
  return nonEmpty(out);
}
