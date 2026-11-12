/** Explicações prontas (sem IA) dos itens do orçamento: funções, tipos de gasto e origens de receita. */
type Rule = [RegExp, string];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const EXPENSE_FUNCTIONS: Rule[] = [
  [/^legislativa/, "Gastos do Poder Legislativo: câmaras, assembleias, Congresso e tribunais de contas, que fazem as leis e fiscalizam o governo."],
  [/^judiciaria/, "Manutenção da Justiça: tribunais, juízes e servidores que julgam os processos."],
  [/^essencial a justica/, "Órgãos que fazem a Justiça funcionar: Ministério Público, Defensoria Pública e Advocacia Pública."],
  [/^administracao/, "Custo de manter a máquina pública funcionando: planejamento, finanças, controle e apoio administrativo."],
  [/^defesa nacional/, "Forças Armadas e a proteção do território e da soberania do país."],
  [/^seguranca publica/, "Policiamento, bombeiros, investigação e defesa civil."],
  [/^relacoes exteriores/, "Diplomacia, embaixadas e participação do país em organismos internacionais."],
  [/^assistencia social/, "Proteção a quem está em situação de vulnerabilidade: transferência de renda, atendimento a famílias, idosos e pessoas com deficiência."],
  [/^previdencia social/, "Pagamento de aposentadorias e pensões (do regime geral e dos servidores)."],
  [/^saude/, "Hospitais, postos de saúde, vacinação, medicamentos e vigilância sanitária (SUS)."],
  [/^trabalho/, "Políticas de emprego: seguro-desemprego, abono salarial, qualificação e intermediação de mão de obra."],
  [/^educacao/, "Escolas, creches, universidades, merenda, transporte escolar e salários de professores."],
  [/^cultura/, "Museus, patrimônio histórico, bibliotecas e incentivo às artes."],
  [/^direitos da cidadania/, "Defesa de direitos: direitos humanos, igualdade racial, proteção a crianças e a grupos específicos."],
  [/^urbanismo/, "Infraestrutura da cidade: ruas, iluminação, transporte urbano, limpeza e planejamento urbano."],
  [/^habitacao/, "Moradia: programas de casa própria, urbanização de bairros e regularização de imóveis."],
  [/^saneamento/, "Água, esgoto e lixo."],
  [/^gestao ambiental/, "Proteção do meio ambiente: fiscalização, preservação e recursos hídricos."],
  [/^ciencia e tecnologia/, "Pesquisa científica, desenvolvimento tecnológico e inovação."],
  [/^agricultura/, "Apoio ao produtor rural: assistência técnica, defesa agropecuária, crédito e abastecimento."],
  [/^organizacao agraria/, "Reforma agrária e regularização de terras."],
  [/^industria/, "Apoio à indústria e à qualidade e padronização de produtos."],
  [/^comercio e servicos/, "Apoio ao comércio, aos serviços e ao turismo."],
  [/^comunicacoes/, "Correios, telecomunicações e radiodifusão."],
  [/^energia/, "Geração, transmissão e distribuição de energia e combustíveis."],
  [/^transporte/, "Rodovias, ferrovias, portos, aeroportos e transporte público."],
  [/^desporto e lazer/, "Esporte, praças e equipamentos de lazer."],
  [/^encargos especiais/, "Gastos que não são de uma área específica: pagamento da dívida (principal e juros), transferências a outros governos e outros encargos."],
  [/^reserva de contingencia/, "Dinheiro reservado no orçamento para imprevistos; só vira gasto se for remanejado para uma área."],
  // subfunções mais comuns
  [/^atencao basica/, "Postos de saúde, equipes de saúde da família e atendimento do dia a dia."],
  [/^assistencia hospitalar/, "Hospitais, pronto-atendimento, consultas especializadas e exames."],
  [/^vigilancia/, "Prevenção e controle de doenças e de riscos à saúde e ao ambiente."],
  [/^suporte profilatico/, "Medicamentos, vacinas e outros insumos de saúde."],
  [/^educacao infantil/, "Creches e pré-escolas."],
  [/^ensino fundamental/, "Escolas do 1º ao 9º ano."],
  [/^ensino medio/, "Escolas de ensino médio."],
  [/^ensino superior/, "Universidades e institutos de ensino superior."],
  [/^ensino profissional/, "Cursos técnicos e de qualificação profissional."],
  [/^previdencia do regime estatutario/, "Aposentadorias e pensões dos servidores públicos."],
  [/^previdencia do regime geral|^previdencia basica/, "Aposentadorias e pensões do INSS (regime geral)."],
  [/^assistencia ao idoso/, "Atendimento e proteção a pessoas idosas."],
  [/^assistencia a crianca e ao adolescente/, "Atendimento e proteção a crianças e adolescentes."],
  [/^policiamento/, "Polícias militar e civil nas ruas e no atendimento ao cidadão."],
  [/^defesa civil/, "Prevenção e resposta a enchentes, deslizamentos e outras emergências."],
  [/^transporte rodoviario/, "Estradas, pontes e manutenção de rodovias."],
  [/^transportes coletivos/, "Ônibus, metrô, trens e outros transportes de passageiros."],
  [/^servicos urbanos/, "Limpeza urbana, iluminação e conservação de espaços públicos."],
  [/^infra-estrutura urbana|^infraestrutura urbana/, "Pavimentação, drenagem e obras urbanas."],
  [/^refinanciamento da divida/, "Troca de dívidas antigas por novas; não é um gasto novo."],
  [/^servico da divida/, "Pagamento de juros e do valor principal da dívida pública."],
  [/^outros encargos especiais/, "Transferências e encargos que não cabem em outra categoria."],
];

const EXPENSE_NATURE: Rule[] = [
  [/^pessoal e encargos/, "Salários, aposentadorias, pensões e encargos (como INSS e FGTS) pagos aos servidores."],
  [/^juros e encargos/, "Juros e custos de financiamentos e títulos que o governo contratou."],
  [/^outras despesas correntes/, "Custeio do dia a dia: contratos, material, serviços, benefícios e repasses que não são investimento."],
  [/^investimentos/, "Obras, equipamentos e imóveis que ficam como patrimônio público."],
  [/^inversoes financeiras/, "Compra de ações e de imóveis já existentes e concessão de empréstimos."],
  [/^amortizacao da divida/, "Pagamento do valor principal da dívida, sem os juros."],
  [/^reserva de contingencia/, "Dinheiro reservado para imprevistos."],
];

const REVENUE: Rule[] = [
  [/^impostos|^receita tributaria|^tributos/, "Impostos (como IPTU, ISS, ICMS e Imposto de Renda), taxas e contribuições cobrados pelo próprio governo."],
  [/^contribuicoes/, "Contribuições sociais (como as da Previdência) e econômicas."],
  [/^receita patrimonial/, "Aluguéis, dividendos e rendimentos de aplicações financeiras do governo."],
  [/^receita agropecuaria/, "Venda de produtos de atividades agropecuárias do governo."],
  [/^receita industrial/, "Venda de produtos de atividades industriais do governo."],
  [/^receita de servicos/, "Pagamento por serviços prestados pelo governo (tarifas e taxas de serviço)."],
  [/^transferencias de capital/, "Recursos recebidos de outros governos para obras e investimentos."],
  [/^transferencias correntes/, "Recursos recebidos de outros governos para gastos do dia a dia (como FPM, FPE e repasses do SUS)."],
  [/^transferencias/, "Dinheiro repassado por outro nível de governo ou instituição."],
  [/^outras receitas correntes/, "Multas, indenizações e outras receitas do dia a dia."],
  [/^operacoes de credito/, "Empréstimos e financiamentos contratados: entram no caixa, mas viram dívida."],
  [/^alienacao de bens/, "Venda de bens do governo, como imóveis e veículos."],
  [/^amortizacao de emprestimos/, "Devolução de empréstimos que o governo havia concedido."],
  [/^outras receitas de capital/, "Receitas de capital que não cabem nas outras categorias."],
  [/^receitas? de capital/, "Receitas que mudam o patrimônio do governo: empréstimos, venda de bens e transferências para investimento."],
  [/^receitas? correntes/, "Receitas do dia a dia: impostos, contribuições, serviços e transferências."],
  [/^receitas? intraorcamentarias/, "Repasses entre órgãos do mesmo governo; aparecem como receita e como despesa e se anulam."],
  [/^deducoes/, "Valores que saem da receita bruta, como repasses obrigatórios e restituições."],
];

export type GlossaryView = "expense" | "revenue" | "nature";

/** Explicação pronta de um item; usa o nome da função-mãe quando for uma subcategoria sem texto próprio. */
export function explainItem(name: string, view: GlossaryView, scope: string, parentName?: string | null): string {
  const rules = view === "revenue" ? REVENUE : view === "nature" ? EXPENSE_NATURE : EXPENSE_FUNCTIONS;
  const n = norm(name);
  const hit = rules.find(([re]) => re.test(n));
  if (hit) return hit[1];
  if (parentName) {
    const p = rules.find(([re]) => re.test(norm(parentName)));
    return p ? `Subdivisão de "${parentName}". ${p[1]}` : `Subdivisão de "${parentName}": detalha um tipo específico de ${view === "revenue" ? "receita" : "gasto"} dessa área.`;
  }
  const kind = view === "revenue" ? "Origem de receita" : view === "nature" ? "Tipo de gasto" : "Área do orçamento";
  return `${kind} "${name}" no orçamento do ${scope}. Os valores são os declarados ao Tesouro Nacional no relatório bimestral (RREO).`;
}
