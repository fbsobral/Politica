import { brlShort, getBudgetHistory, UF_CODE, type BudgetHistory, type BudgetScope, type Series } from "@/lib/budget";
import { getFiscal, type FiscalData, type PlanItem } from "@/lib/fiscal";
import { ibgeIdFor } from "@/lib/ibge";
import { getSeries, INDICATORS } from "@/lib/indicators/catalog";
import { formatValue } from "@/lib/indicators/format";
import { suggestIndicators } from "@/lib/indicators/roi-suggest";
import { fixedTargetFor } from "@/lib/indicators/targets";
import { getTaxes } from "@/lib/taxes";

/*
 * Diagnóstico: cruza orçamento, execução, indicadores e impostos para apontar lacunas e gargalos.
 * Os números vêm das fontes oficiais; a ORDEM e os "caminhos possíveis" seguem uma lente explícita —
 * "foco na base da pirâmide": prioridade a quem depende mais dos serviços públicos e a uma tributação progressiva.
 */

export type FindingType = "execucao" | "sem-orcamento" | "prioridades" | "quem-paga" | "rigidez";
export const TYPE_LABEL: Record<FindingType, string> = {
  execucao: "Dinheiro aprovado que não chega",
  "sem-orcamento": "Problema sem orçamento",
  prioridades: "Prioridades do gasto",
  "quem-paga": "Quem paga a conta",
  rigidez: "Gargalos e rigidez",
};

export type Finding = {
  id: string;
  type: FindingType;
  /** 1 = atenção, 2 = importante, 3 = grave */
  severity: 1 | 2 | 3;
  /** peso na lente (impacto em quem tem menos) */
  weight: number;
  title: string;
  summary: string;
  evidence: { label: string; value: string }[];
  /** por que importa para quem está na base da pirâmide */
  impact: string;
  /** caminhos possíveis (opções, não receitas prontas) */
  options: string[];
  caveat?: string;
  link: { href: string; label: string };
  source: string;
};

type Area = { key: string; name: string; weight: number; why: string };

/** Áreas do orçamento e o peso de cada uma para quem tem menos renda (critério da lente). */
const AREAS: Area[] = [
  { key: "assistencia social", name: "Assistência social", weight: 3, why: "Chega direto a quem tem menos: CRAS, acolhimento, cadastro e apoio a famílias em situação de pobreza." },
  { key: "saude", name: "Saúde", weight: 3, why: "O SUS é o único acesso à saúde para cerca de 7 em cada 10 brasileiros, principalmente os de menor renda." },
  { key: "educacao", name: "Educação", weight: 3, why: "A escola pública atende cerca de 8 em cada 10 alunos; creche e ensino básico pesam mais para as famílias pobres." },
  { key: "saneamento", name: "Saneamento", weight: 3, why: "A falta de água tratada e esgoto se concentra nos bairros pobres e causa doenças e mortes de crianças." },
  { key: "habitacao", name: "Habitação", weight: 3, why: "Moradia precária e o peso do aluguel atingem sobretudo as famílias de baixa renda." },
  { key: "trabalho", name: "Trabalho", weight: 2, why: "Qualificação e intermediação de emprego ajudam quem está fora do mercado formal." },
  { key: "direitos da cidadania", name: "Direitos da cidadania", weight: 2, why: "Proteção de crianças, mulheres, idosos e pessoas com deficiência em situação de vulnerabilidade." },
  { key: "transporte", name: "Transporte", weight: 2, why: "O transporte público é o meio de deslocamento de quem tem menos renda e mora mais longe." },
  { key: "seguranca publica", name: "Segurança pública", weight: 2, why: "A violência letal atinge mais os bairros periféricos e os jovens negros." },
  { key: "urbanismo", name: "Urbanismo", weight: 1, why: "Iluminação, pavimentação e espaços públicos nos bairros com menos infraestrutura." },
  { key: "cultura", name: "Cultura", weight: 1, why: "Acesso a cultura e lazer onde há menos oferta privada." },
  { key: "desporto e lazer", name: "Esporte e lazer", weight: 1, why: "Espaços e programas públicos de esporte, mais usados por quem não pode pagar." },
];
const SOCIAL = AREAS.filter((a) => a.weight >= 2);

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const areaOf = (name: string) => AREAS.find((a) => norm(name) === a.key || norm(name).startsWith(a.key));
const pct = (v: number, d = 0) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: d })}%`;
const pp = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`;
const MONTH = ["", "fevereiro", "abril", "junho", "agosto", "outubro", "dezembro"];

export type MoneyNode = { name: string; value: number };
export type MoneyMap = { year: number; revenue: MoneyNode[]; expense: MoneyNode[]; revenueTotal: number; expenseTotal: number };

export type Diagnosis = {
  scope: BudgetScope;
  entity: string;
  findings: Finding[];
  map: MoneyMap | null;
  closedYear: number | null;
  currentYear: number | null;
  notes: string[];
};

/* ───────── auxiliares de série ───────── */

/** Gasto real (corrigido pelo IPCA) de uma função, ano → R$. */
function realSeries(h: BudgetHistory, s: Series): Record<number, number> {
  return Object.fromEntries(Object.entries(s.values).map(([y, v]) => [Number(y), v * (h.deflator[Number(y)] ?? 1)]));
}
const fnSeries = (h: BudgetHistory, area: Area) => h.expense.find((s) => !s.parent && areaOf(s.name)?.key === area.key);
const shareOf = (h: BudgetHistory, s: Series | undefined, y: number) => (s && h.totals.expense[y] ? (s.values[y] ?? 0) / h.totals.expense[y] : 0);

/* ───────── 1. Dinheiro aprovado que não chega (execução do ano) ───────── */

function execution(f: FiscalData): Finding[] {
  if (f.period >= 6) return [];
  const out: Finding[] = [];
  const total = f.totals.expense.initial || 1;
  for (const it of f.plan.expense) {
    const area = areaOf(it.name);
    if (!area || area.weight < 2 || it.initial < total * 0.003) continue;
    const proj = f.projection[`expense:${it.code}`]?.value;
    if (proj == null) continue;
    const gap = proj / it.initial - 1;
    const cut = it.updated / it.initial - 1;
    if (gap > -0.1 && cut > -0.1) continue;
    const severity: 1 | 2 | 3 = gap < -0.3 || cut < -0.25 ? 3 : gap < -0.18 ? 2 : 1;
    out.push({
      id: `exec-${it.code}`,
      type: "execucao",
      severity,
      weight: area.weight,
      title: `${area.name}: ${pct(-Math.min(gap, cut))} do previsto na LOA de ${f.year} não deve ser gasto`,
      summary: `Pelo ritmo até ${MONTH[f.period]}, ${area.name.toLowerCase()} deve fechar o ano com ${brlShort(proj)}, abaixo dos ${brlShort(it.initial)} aprovados${cut < -0.05 ? `; a própria dotação já foi reduzida em ${pct(-cut)} ao longo do ano` : ""}.`,
      evidence: [
        { label: "Previsto na LOA", value: brlShort(it.initial) },
        { label: "Dotação atualizada", value: `${brlShort(it.updated)}${Math.abs(cut) > 0.01 ? ` (${cut >= 0 ? "+" : "−"}${pct(Math.abs(cut))})` : ""}` },
        { label: `Empenhado até ${MONTH[f.period]}`, value: `${brlShort(it.done)} (${pct(it.done / it.initial)})` },
        { label: "Projeção do fechamento", value: `${brlShort(proj)} · faltam ${brlShort(Math.max(0, it.initial - proj))}` },
      ],
      impact: area.why,
      options: [
        "Cobrar da prefeitura, do governo ou do ministério o cronograma de execução da área (pedido pela Lei de Acesso à Informação ou na Câmara/Assembleia).",
        cut < -0.05 ? "Verificar para onde foi o dinheiro retirado da área (decretos de remanejamento e créditos adicionais no Diário Oficial)." : "Verificar se há obras, contratos ou programas parados por licitação, falta de projeto ou de pessoal.",
        "Acompanhar se o valor não gasto volta como 'sobra' no fim do ano ou é contingenciado para cumprir meta fiscal.",
      ],
      caveat: "Parte dos gastos se concentra no fim do ano (13º, obras); a projeção usa o ritmo do mesmo período do ano anterior.",
      link: { href: `/expectativa-fiscal?esfera=${f.scope.toLowerCase()}`, label: "Ver na Expectativa fiscal" },
      source: "Relatório bimestral (RREO), Tesouro Nacional",
    });
  }
  return out;
}

/* ───────── 2. Problema sem orçamento (indicador ruim × gasto que cai ou nem existe) ───────── */

type Geo = { uf: string; ufCode: number; ibge: string; municipalityKey: string };

async function unbudgeted(h: BudgetHistory, scope: BudgetScope, geo: Geo): Promise<Finding[]> {
  const out: Finding[] = [];
  const last = h.years[h.years.length - 1];
  const base = h.years.find((y) => y >= last - 5) ?? h.years[0];
  for (const area of SOCIAL) {
    const s = fnSeries(h, area);
    const share = shareOf(h, s, last), shareBase = shareOf(h, s, base);
    const real = s ? realSeries(h, s) : {};
    const realChange = s && real[base] ? (real[last] ?? 0) / real[base] - 1 : null;

    // indicador da área (do mesmo nível ou, para cidades, do estado)
    let indLine: { name: string; text: string; worse: boolean; worsening: boolean; fromState: boolean } | null = null;
    for (const id of suggestIndicators(area.name).ids) {
      const ind = INDICATORS.find((i) => i.id === id);
      if (!ind?.better) continue;
      let lvl: BudgetScope = scope;
      if (!ind.fetch[lvl] && lvl === "MUNICIPAL" && ind.fetch.ESTADUAL) lvl = "ESTADUAL";
      if (!ind.fetch[lvl]) continue;
      const ser = await getSeries(ind, lvl, geo, { lazy: true }).catch(() => null);
      if (!ser) continue;
      const ys = Object.keys(ser).map(Number).sort((a, b) => a - b);
      if (ys.length < 2) continue;
      const y1 = ys[ys.length - 1], v1 = ser[y1];
      const y0 = ys.find((y) => y >= y1 - 5) ?? ys[0], v0 = ser[y0];
      const target = fixedTargetFor(ind.id, lvl, ser);
      const worse = target != null && (ind.better === "down" ? v1 > target : v1 < target);
      const worsening = ind.better === "down" ? v1 > v0 * 1.02 : v1 < v0 * 0.98;
      if (!worse && !worsening) continue;
      indLine = {
        name: ind.name,
        fromState: lvl !== scope,
        worse,
        worsening,
        text: `${formatValue(v1, ind.unit, ind.decimals)} em ${y1}${worsening ? ` (era ${formatValue(v0, ind.unit, ind.decimals)} em ${y0})` : ""}${worse && target != null ? ` · meta de referência: ${formatValue(target, ind.unit, ind.decimals)}` : ""}`,
      };
      break;
    }

    const tiny = area.weight >= 3 && share < 0.01; // área prioritária quase sem orçamento
    const falling = (realChange !== null && realChange < -0.05) || share < shareBase - 0.01;
    if (!(indLine && (falling || tiny)) && !(tiny && area.weight >= 3 && last)) continue;
    const severity: 1 | 2 | 3 = indLine && falling && indLine.worse ? 3 : indLine && (falling || tiny) ? 2 : 1;
    out.push({
      id: `gap-${area.key}`,
      type: "sem-orcamento",
      severity,
      weight: area.weight,
      title: indLine
        ? `${area.name}: o problema ${indLine.worsening ? "piorou" : "segue acima da meta"} e o gasto ${falling ? "caiu" : "é muito pequeno"}`
        : `${area.name}: quase sem orçamento (${pct(share, 1)} da despesa)`,
      summary: indLine
        ? `${indLine.name}${indLine.fromState ? " (no estado)" : ""}: ${indLine.text}. No mesmo período, ${area.name.toLowerCase()} ${realChange !== null ? `teve ${realChange >= 0 ? "aumento" : "queda"} real de ${pct(Math.abs(realChange))} no gasto` : "teve pouco gasto"} e passou de ${pct(shareBase, 1)} para ${pct(share, 1)} da despesa.`
        : `Em ${last}, ${area.name.toLowerCase()} recebeu ${s ? brlShort(s.values[last] ?? 0) : "R$ 0"}, ${pct(share, 1)} de toda a despesa. Problemas que não entram no orçamento não aparecem no previsto × realizado.`,
      evidence: [
        ...(indLine ? [{ label: indLine.name + (indLine.fromState ? " (estado)" : ""), value: indLine.text }] : []),
        { label: `Gasto em ${last}`, value: s ? `${brlShort(s.values[last] ?? 0)} (${pct(share, 1)} da despesa)` : "sem gasto declarado" },
        ...(realChange !== null ? [{ label: `Variação real ${base}–${last}`, value: `${realChange >= 0 ? "+" : "−"}${pct(Math.abs(realChange))} (corrigido pelo IPCA)` }] : []),
        { label: "Fatia da despesa", value: `${pct(shareBase, 1)} → ${pct(share, 1)} (${pp(share - shareBase)})` },
      ],
      impact: area.why,
      options: [
        `Incluir metas e recursos para ${area.name.toLowerCase()} no próximo Plano Plurianual e na LDO, com indicadores de resultado.`,
        "Comparar com cidades ou estados parecidos que gastam mais e têm indicadores melhores.",
        "Buscar recursos federais e estaduais para a área (programas e transferências específicas) e acompanhar se foram pedidos.",
      ],
      caveat: area.key === "saneamento" || area.key === "habitacao" ? "Parte do serviço pode ser prestada por empresa estadual, concessionária ou outro nível de governo e não aparecer neste orçamento." : indLine?.fromState ? "O indicador é do estado inteiro: a cidade não tem esse dado publicado." : "Indicadores mudam por muitos motivos além do gasto; a relação é um ponto de partida, não uma prova.",
      link: { href: `/roi?esfera=${scope.toLowerCase()}`, label: "Ver gasto × resultado no ROI" },
      source: "Tesouro Nacional (Siconfi/DCA) e indicadores oficiais",
    });
  }
  return out;
}

/* ───────── 3. Prioridades (dívida e máquina × áreas sociais) ───────── */

function priorities(h: BudgetHistory, scope: BudgetScope): Finding[] {
  const out: Finding[] = [];
  const last = h.years[h.years.length - 1];
  const base = h.years.find((y) => y >= last - 5) ?? h.years[0];
  const total = h.totals.expense[last] || 1;
  const nat = (code: string, y: number) => h.nature.find((s) => s.code === code)?.values[y] ?? 0;
  const debt = nat("nat:3.2", last) + nat("nat:4.6", last);
  const socialSum = (y: number) => SOCIAL.reduce((a, ar) => a + (fnSeries(h, ar)?.values[y] ?? 0), 0);
  const social = socialSum(last), socialShare = social / total;
  const socialShareBase = h.totals.expense[base] ? socialSum(base) / h.totals.expense[base] : socialShare;
  const assist = fnSeries(h, AREAS[0])?.values[last] ?? 0;

  if (debt > 0 && (debt / total > 0.08 || (assist > 0 && debt > assist * 2))) {
    out.push({
      id: "prio-divida",
      type: "prioridades",
      severity: debt / total > 0.2 ? 3 : debt / total > 0.1 ? 2 : 1,
      weight: 2,
      title: `Juros e dívida levam ${pct(debt / total)} da despesa${assist > 0 ? ` — ${(debt / assist).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} vezes o gasto com assistência social` : ""}`,
      summary: `Em ${last}, ${brlShort(debt)} foram para juros e amortização da dívida, contra ${brlShort(assist)} para assistência social e ${brlShort(social)} para todas as áreas sociais somadas.`,
      evidence: [
        { label: "Juros e encargos da dívida", value: brlShort(nat("nat:3.2", last)) },
        { label: "Amortização da dívida", value: brlShort(nat("nat:4.6", last)) },
        { label: "Assistência social", value: brlShort(assist) },
        { label: "Todas as áreas sociais", value: `${brlShort(social)} (${pct(socialShare)} da despesa)` },
      ],
      impact: "Cada real pago em juros vai para quem tem títulos e aplicações — em geral, as famílias de maior renda e os bancos — e deixa de financiar serviços usados por quem tem menos.",
      options: [
        "Renegociar dívidas caras e trocar por crédito mais barato (bancos públicos, organismos multilaterais).",
        scope === "FEDERAL" ? "Debater o nível dos juros básicos e a composição da dívida, que definem quanto do orçamento vai para juros." : "Evitar novas dívidas para custeio e priorizar crédito para investimento com retorno social.",
        "Proteger o piso das áreas sociais nas regras de ajuste fiscal, para que o corte não recaia sobre elas.",
      ],
      caveat: "Amortização é devolução do principal e costuma ser refinanciada; o peso dos juros é o mais relevante.",
      link: { href: `/orcamento?esfera=${scope.toLowerCase()}`, label: "Ver no Orçamento" },
      source: "Tesouro Nacional (Siconfi/DCA, despesa por natureza)",
    });
  }
  if (socialShare < socialShareBase - 0.02) {
    out.push({
      id: "prio-social",
      type: "prioridades",
      severity: socialShare < socialShareBase - 0.05 ? 3 : 2,
      weight: 3,
      title: `As áreas sociais perderam espaço: de ${pct(socialShareBase)} para ${pct(socialShare)} da despesa`,
      summary: `Entre ${base} e ${last}, saúde, educação, assistência, saneamento, habitação, trabalho, direitos, transporte e segurança somados passaram a ter uma fatia menor do orçamento.`,
      evidence: [
        { label: `Fatia social em ${base}`, value: pct(socialShareBase, 1) },
        { label: `Fatia social em ${last}`, value: pct(socialShare, 1) },
        { label: "Diferença", value: `${pp(socialShare - socialShareBase)} · cerca de ${brlShort((socialShareBase - socialShare) * total)} por ano a menos` },
      ],
      impact: "Quando a fatia social encolhe, quem depende só do serviço público sente primeiro: filas, falta de vagas e de atendimento.",
      options: ["Identificar quais áreas cresceram no lugar (dívida, administração, outras) no Orçamento.", "Propor pisos de gasto social na LDO e no Plano Plurianual."],
      link: { href: `/orcamento?esfera=${scope.toLowerCase()}`, label: "Ver no Orçamento" },
      source: "Tesouro Nacional (Siconfi/DCA)",
    });
  }
  // custo da máquina (administração + legislativo)
  const adm = h.expense.filter((s) => !s.parent && /^(administracao|legislativa)/.test(norm(s.name))).reduce((a, s) => a + (s.values[last] ?? 0), 0);
  if (scope !== "FEDERAL" && adm / total > 0.15) {
    out.push({
      id: "prio-maquina",
      type: "prioridades",
      severity: adm / total > 0.22 ? 2 : 1,
      weight: 1,
      title: `Administração e Legislativo consomem ${pct(adm / total)} da despesa`,
      summary: `Em ${last}, ${brlShort(adm)} foram para a máquina administrativa e a câmara/assembleia, mais do que ${social > 0 ? `${pct(adm / social)} do gasto social somado` : "o gasto social"}.`,
      evidence: [
        { label: "Administração + Legislativo", value: `${brlShort(adm)} (${pct(adm / total, 1)})` },
        { label: "Áreas sociais somadas", value: `${brlShort(social)} (${pct(socialShare, 1)})` },
      ],
      impact: "O custo da máquina não é ruim por si, mas cada ponto acima do necessário sai de serviços que chegam à população.",
      options: ["Comparar com cidades ou estados de tamanho parecido.", "Revisar cargos comissionados, contratos de custeio e gastos da câmara/assembleia."],
      caveat: "Algumas cidades lançam em Administração despesas de várias áreas (por exemplo, folha centralizada).",
      link: { href: `/orcamento?esfera=${scope.toLowerCase()}`, label: "Ver no Orçamento" },
      source: "Tesouro Nacional (Siconfi/DCA)",
    });
  }
  return out;
}

/* ───────── 4. Quem paga a conta ───────── */

async function whoPays(h: BudgetHistory, scope: BudgetScope): Promise<Finding[]> {
  const out: Finding[] = [];
  if (scope === "FEDERAL") {
    const t = await getTaxes().catch(() => null);
    if (!t) return out;
    const i = t.years.length - 1, y = t.years[i];
    const s = (c: string) => t.series.find((x) => x.code === c)!;
    const cons = s("T_5000"), pf = s("T_1100"), inh = s("T_4300"), tot = s("_T");
    const consShare = (cons.brazil.pct[i] ?? 0) / (tot.brazil.pct[i] || 1), consDev = (cons.developed[i].pct ?? 0) / (tot.developed[i].pct || 1);
    out.push({
      id: "pay-consumo",
      type: "quem-paga",
      severity: consShare > consDev + 0.08 ? 3 : 2,
      weight: 3,
      title: `${pct(consShare)} dos impostos vêm do consumo, contra ${pct(consDev)} nos países desenvolvidos`,
      summary: `Impostos embutidos nos preços pesam proporcionalmente mais para quem ganha menos, porque os pobres gastam quase toda a renda em consumo. Já o imposto de renda das pessoas físicas é ${(pf.brazil.pct[i] ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do PIB no Brasil, contra ${(pf.developed[i].pct ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% nos desenvolvidos.`,
      evidence: [
        { label: `Consumo (${y})`, value: `${(cons.brazil.pct[i] ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do PIB · desenvolvidos ${(cons.developed[i].pct ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` },
        { label: "Renda das pessoas físicas", value: `${(pf.brazil.pct[i] ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do PIB · desenvolvidos ${(pf.developed[i].pct ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` },
        { label: "Heranças e doações", value: `${(inh.brazil.pct[i] ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% do PIB · desenvolvidos ${(inh.developed[i].pct ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%` },
      ],
      impact: "Com mais peso no consumo, uma família pobre entrega ao fisco uma fatia maior da renda do que uma família rica.",
      options: [
        "Aumentar a progressividade do imposto de renda (faixas mais altas, tributação de lucros e dividendos) com isenção para a base.",
        "Tributar heranças e grandes patrimônios com alíquotas progressivas.",
        "Na transição da reforma tributária, garantir o cashback de impostos para famílias de baixa renda.",
      ],
      link: { href: "/impostos", label: "Ver em Impostos" },
      source: "OCDE (Global Revenue Statistics) e Banco Mundial",
    });
    return out;
  }
  const last = h.years[h.years.length - 1];
  const rev = (code: string) => h.revenue.find((s) => s.code === code)?.values[last] ?? 0;
  const total = h.totals.revenue[last] || 1;
  const own = rev("RO1.1"), transf = rev("RO1.7") + rev("RO2.4");
  const pop = h.population[last] || null;
  if (scope === "MUNICIPAL") {
    const iptu = rev("tax:iptu"), iss = rev("tax:iss"), itbi = rev("tax:itbi");
    const iptuPc = pop ? iptu / pop : null;
    if (iptu > 0 && (iss > iptu * 1.5 || (iptuPc !== null && iptuPc < 150))) {
      out.push({
        id: "pay-iptu",
        type: "quem-paga",
        severity: iss > iptu * 3 ? 2 : 1,
        weight: 2,
        title: `O IPTU, imposto sobre patrimônio, rende ${iptuPc !== null ? `R$ ${Math.round(iptuPc).toLocaleString("pt-BR")} por morador` : brlShort(iptu)}${iss > iptu ? ` — ${(iss / iptu).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} vezes menos que o ISS` : ""}`,
        summary: `Em ${last}, a cidade arrecadou ${brlShort(iptu)} de IPTU e ${brlShort(iss)} de ISS (imposto sobre serviços, que acaba embutido nos preços). Imposto sobre imóveis é a forma mais progressiva de arrecadação local: quem tem mais patrimônio paga mais.`,
        evidence: [
          { label: "IPTU", value: `${brlShort(iptu)}${iptuPc !== null ? ` · R$ ${Math.round(iptuPc).toLocaleString("pt-BR")} por morador` : ""}` },
          { label: "ISS", value: brlShort(iss) },
          { label: "ITBI (venda de imóveis)", value: brlShort(itbi) },
          { label: "Tributos próprios no total da receita", value: pct(own / total) },
        ],
        impact: "Um IPTU baixo ou desatualizado costuma beneficiar imóveis de alto valor; o que falta é compensado por impostos sobre consumo ou falta de serviços nos bairros pobres.",
        options: [
          "Atualizar a planta genérica de valores, que muitas vezes está décadas defasada nos bairros nobres.",
          "Adotar IPTU progressivo por valor do imóvel (permitido pela Constituição desde 2000), com isenção para imóveis populares.",
          "Aplicar o IPTU progressivo no tempo para terrenos e prédios vazios em áreas com infraestrutura (Estatuto da Cidade).",
        ],
        caveat: "O valor depende também do tamanho da cidade, da renda da população e da cobrança da dívida ativa.",
        link: { href: `/orcamento?esfera=municipal`, label: "Ver receitas no Orçamento" },
        source: "Tesouro Nacional (Siconfi/DCA)",
      });
    }
  }
  if (scope === "ESTADUAL") {
    const icms = rev("tax:icms"), itcmd = rev("tax:itcmd"), ipva = rev("tax:ipva");
    if (icms > 0 && itcmd >= 0) {
      out.push({
        id: "pay-icms",
        type: "quem-paga",
        severity: icms / (own || 1) > 0.8 ? 2 : 1,
        weight: 2,
        title: `ICMS, imposto sobre consumo, é ${pct(icms / (own || 1))} da arrecadação própria; heranças (ITCMD), ${pct(itcmd / (own || 1), 1)}`,
        summary: `Em ${last}, o estado arrecadou ${brlShort(icms)} de ICMS, ${brlShort(ipva)} de IPVA e ${brlShort(itcmd)} de ITCMD. O imposto sobre heranças tem alíquota máxima de 8% no país e, desde a reforma tributária, precisa ser progressivo.`,
        evidence: [
          { label: "ICMS (consumo)", value: brlShort(icms) },
          { label: "IPVA (veículos)", value: brlShort(ipva) },
          { label: "ITCMD (heranças e doações)", value: brlShort(itcmd) },
        ],
        impact: "O ICMS está embutido em alimentos, energia e combustíveis e pesa mais para quem ganha menos; heranças concentram patrimônio nas famílias mais ricas.",
        options: ["Tornar o ITCMD progressivo até a alíquota máxima nas heranças maiores.", "Rever benefícios de ICMS concedidos a setores e empresas e seu retorno social.", "Reduzir o ICMS de itens essenciais (cesta básica, energia de baixa renda)."],
        link: { href: `/orcamento?esfera=estadual`, label: "Ver receitas no Orçamento" },
        source: "Tesouro Nacional (Siconfi/DCA)",
      });
    }
  }
  if (transf / total > 0.7) {
    out.push({
      id: "pay-dependencia",
      type: "quem-paga",
      severity: transf / total > 0.85 ? 2 : 1,
      weight: 1,
      title: `${pct(transf / total)} da receita vem de repasses de outros governos`,
      summary: `Só ${pct(own / total)} vem de tributos próprios. Quanto maior a dependência, menor a margem para planejar serviços e mais o orçamento oscila com a economia do país.`,
      evidence: [
        { label: "Transferências (correntes e de capital)", value: `${brlShort(transf)} (${pct(transf / total)})` },
        { label: "Tributos próprios", value: `${brlShort(own)} (${pct(own / total)})` },
      ],
      impact: "Quando os repasses caem (crises, mudanças de regra), os primeiros cortes costumam atingir custeio e programas sociais.",
      options: ["Fortalecer a arrecadação própria progressiva (patrimônio) e a cobrança da dívida ativa dos grandes devedores.", "Participar de consórcios e programas federais para ganhar escala."],
      link: { href: `/orcamento?esfera=${scope.toLowerCase()}`, label: "Ver receitas no Orçamento" },
      source: "Tesouro Nacional (Siconfi/DCA)",
    });
  }
  return out;
}

/* ───────── 5. Gargalos e rigidez (investimento) ───────── */

function rigidity(h: BudgetHistory, scope: BudgetScope): Finding[] {
  const last = h.years[h.years.length - 1];
  const base = h.years.find((y) => y >= last - 5) ?? h.years[0];
  const inv = (y: number) => h.nature.find((s) => s.code === "nat:4.4")?.values[y] ?? 0;
  const share = inv(last) / (h.totals.expense[last] || 1), shareBase = inv(base) / (h.totals.expense[base] || 1);
  if (!(share < 0.05 || share < shareBase - 0.02)) return [];
  return [
    {
      id: "rig-invest",
      type: "rigidez",
      severity: share < 0.03 ? 2 : 1,
      weight: 2,
      title: `Só ${pct(share, 1)} da despesa vai para investimentos (obras e equipamentos)`,
      summary: `Em ${base} eram ${pct(shareBase, 1)}. Sem investimento, faltam creches, postos de saúde, saneamento e transporte nos lugares onde ainda não existem.`,
      evidence: [
        { label: `Investimentos em ${last}`, value: `${brlShort(inv(last))} (${pct(share, 1)})` },
        { label: `Investimentos em ${base}`, value: `${brlShort(inv(base))} (${pct(shareBase, 1)})` },
      ],
      impact: "Quando o ajuste corta investimento, as periferias e as cidades menores — que mais precisam de infraestrutura — ficam esperando.",
      options: ["Proteger o investimento social nas regras fiscais (separar investimento de custeio nas metas).", "Buscar financiamento para infraestrutura social e acompanhar obras paradas."],
      link: { href: `/orcamento?esfera=${scope.toLowerCase()}`, label: "Ver no Orçamento" },
      source: "Tesouro Nacional (Siconfi/DCA, despesa por natureza)",
    },
  ];
}

/* ───────── mapa do dinheiro ───────── */

function moneyMap(h: BudgetHistory): MoneyMap | null {
  const last = h.years[h.years.length - 1];
  if (!last) return null;
  const top = (list: MoneyNode[], n: number) => {
    const s = list.filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
    const rest = s.slice(n).reduce((a, x) => a + x.value, 0);
    return s.length > n ? [...s.slice(0, n), { name: "Outras", value: rest }] : s;
  };
  const debt = (h.nature.find((s) => s.code === "nat:3.2")?.values[last] ?? 0) + (h.nature.find((s) => s.code === "nat:4.6")?.values[last] ?? 0);
  const revenue = top(h.revenue.filter((s) => !s.parent && !s.code.startsWith("tax:")).map((s) => ({ name: s.name, value: s.values[last] ?? 0 })), 5);
  const expense = top(
    h.expense.filter((s) => !s.parent).map((s) => ({ name: /^encargos/i.test(s.name) && debt ? "Encargos (sem dívida)" : s.name, value: /^encargos/i.test(s.name) ? Math.max(0, (s.values[last] ?? 0) - debt) : s.values[last] ?? 0 })),
    7,
  );
  if (debt > 0) expense.push({ name: "Juros e dívida", value: debt });
  expense.sort((a, b) => (a.name === "Outras" ? 1 : b.name === "Outras" ? -1 : b.value - a.value));
  return { year: last, revenue, expense, revenueTotal: h.totals.revenue[last] ?? revenue.reduce((a, x) => a + x.value, 0), expenseTotal: h.totals.expense[last] ?? expense.reduce((a, x) => a + x.value, 0) };
}

/* ───────── montagem ───────── */

export async function getDiagnosis(scope: BudgetScope, user: { uf: string; municipalityKey: string }): Promise<Diagnosis | null> {
  const ibge = scope === "MUNICIPAL" ? await ibgeIdFor(user.uf, user.municipalityKey) : null;
  const geo: Geo = { uf: user.uf, ufCode: UF_CODE[user.uf] ?? 0, ibge: String(ibge ?? ""), municipalityKey: user.municipalityKey };
  const [h, f] = await Promise.all([getBudgetHistory(scope, user).catch(() => null), getFiscal(scope, user).catch(() => null)]);
  if (!h && !f) return null;
  const findings: Finding[] = [];
  const notes: string[] = [];
  if (f) findings.push(...execution(f));
  else notes.push("Sem o relatório bimestral deste ano: os achados de execução ficaram de fora.");
  if (h && h.years.length >= 2) {
    findings.push(...(await unbudgeted(h, scope, geo)), ...priorities(h, scope), ...(await whoPays(h, scope)), ...rigidity(h, scope));
  } else notes.push("Sem a série histórica do orçamento: os achados de prioridades, impostos e investimento ficaram de fora.");
  // ordem da lente: impacto em quem tem menos (peso da área × gravidade)
  findings.sort((a, b) => b.weight * b.severity - a.weight * a.severity || b.severity - a.severity);
  return {
    scope,
    entity: h?.entity || f?.entity || "",
    findings,
    map: h ? moneyMap(h) : null,
    closedYear: h?.years.at(-1) ?? null,
    currentYear: f?.year ?? null,
    notes,
  };
}

export type { PlanItem };

/** Só para testes: as regras puras, sem acesso a banco ou rede. */
export const __rules = { execution, priorities, rigidity, moneyMap, whoPays };
