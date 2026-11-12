/** Explicações prontas (sem IA) dos itens do orçamento: funções, tipos de gasto e origens de receita. */
type Rule = [RegExp, string, string?];
export type Glossary = { what: string; includes?: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// [padrão do nome, o que é, "inclui" (exemplos; subfunções oficiais do orçamento)]
const EXPENSE_FUNCTIONS: Rule[] = [
  [/^legislativa/, "Dinheiro gasto com o Poder Legislativo, que faz as leis e fiscaliza o governo: Câmara, Senado, assembleias, câmaras de vereadores e tribunais de contas.", "ação legislativa (salários, gabinetes, sessões) e controle externo (tribunais de contas)."],
  [/^judiciaria/, "Dinheiro gasto com a Justiça: o funcionamento dos tribunais e dos juízes que julgam os processos.", "ação judiciária (tribunais, fóruns, varas) e defesa do interesse público nos processos."],
  [/^essencial a justica/, "Dinheiro gasto com os órgãos que defendem a lei e as pessoas na Justiça, mas não julgam.", "Ministério Público, Defensoria Pública (advogado gratuito) e Advocacia Pública (que defende o governo)."],
  [/^administracao/, "Custo de manter a máquina pública funcionando, aquilo que não é uma área-fim como saúde ou educação.", "planejamento e orçamento, finanças, controle interno, tecnologia da informação, arrecadação de impostos, comunicação social e treinamento de servidores."],
  [/^defesa nacional/, "Dinheiro gasto com a proteção do território e da soberania do país.", "Exército (defesa terrestre), Marinha (defesa naval) e Aeronáutica (defesa aérea)."],
  [/^seguranca publica/, "Dinheiro gasto para proteger a população contra crimes e emergências.", "policiamento (polícias civil, militar e federal), defesa civil (enchentes, deslizamentos) e informação e inteligência."],
  [/^relacoes exteriores/, "Dinheiro gasto com a representação do país no exterior.", "embaixadas e consulados (relações diplomáticas) e cooperação internacional."],
  [/^assistencia social/, "Dinheiro gasto com a proteção de quem está em situação de vulnerabilidade, sem exigir contribuição prévia.", "assistência a idosos, pessoas com deficiência, crianças e adolescentes, e assistência comunitária (como o atendimento nos CRAS)."],
  [/^previdencia social/, "Dinheiro usado para pagar aposentadorias e pensões.", "previdência básica (INSS), regime próprio dos servidores públicos, previdência complementar e especial."],
  [/^saude/, "Dinheiro gasto com o atendimento e a prevenção de doenças, principalmente no SUS.", "atenção básica (postos de saúde), hospitais e ambulatórios, medicamentos, vigilância sanitária e epidemiológica (vacinação, controle de surtos) e alimentação e nutrição."],
  [/^trabalho/, "Dinheiro gasto com políticas de emprego e proteção a quem trabalha.", "proteção e benefícios ao trabalhador (seguro-desemprego, abono salarial), relações de trabalho (fiscalização), empregabilidade (qualificação, agências de emprego) e fomento ao trabalho."],
  [/^educacao/, "Dinheiro gasto com o ensino e a estrutura das escolas e universidades.", "educação infantil (creches), ensino fundamental e médio, ensino superior, ensino profissional, educação de jovens e adultos e educação especial; inclui salários de professores, merenda e transporte escolar."],
  [/^cultura/, "Dinheiro gasto para preservar e difundir a cultura.", "patrimônio histórico, artístico e arqueológico (museus, prédios tombados) e difusão cultural (teatros, bibliotecas, festivais)."],
  [/^direitos da cidadania/, "Dinheiro gasto com a defesa de direitos e com o sistema que cuida de pessoas presas.", "custódia e reintegração social (sistema prisional), direitos individuais, coletivos e difusos e assistência aos povos indígenas."],
  [/^urbanismo/, "Dinheiro gasto com a estrutura e os serviços das cidades.", "infraestrutura urbana (ruas, calçadas, drenagem), serviços urbanos (limpeza, iluminação pública, praças) e transporte coletivo urbano."],
  [/^habitacao/, "Dinheiro gasto para que as famílias tenham moradia.", "habitação urbana e rural (programas de casa própria, melhorias de moradias, regularização)."],
  [/^saneamento/, "Dinheiro gasto com o abastecimento de água e o tratamento de esgoto e lixo.", "saneamento básico urbano e rural (redes de água e esgoto)."],
  [/^gestao ambiental/, "Dinheiro gasto com a proteção do meio ambiente e dos recursos naturais.", "preservação e conservação ambiental, controle ambiental (fiscalização), recuperação de áreas degradadas, recursos hídricos e meteorologia."],
  [/^ciencia e tecnologia/, "Dinheiro gasto com pesquisa científica e inovação.", "desenvolvimento científico e tecnológico (bolsas, laboratórios, institutos de pesquisa) e difusão do conhecimento."],
  [/^agricultura/, "Dinheiro gasto com a produção de alimentos e o apoio ao produtor rural.", "defesa agropecuária (controle de pragas e doenças), extensão rural (assistência técnica), irrigação, abastecimento e promoção da produção vegetal e animal."],
  [/^organizacao agraria/, "Dinheiro gasto com a distribuição e a regularização de terras.", "reforma agrária e colonização (assentamentos)."],
  [/^industria/, "Dinheiro gasto para estimular a atividade industrial.", "promoção industrial, mineração, propriedade industrial (patentes e marcas) e normalização e qualidade de produtos."],
  [/^comercio e servicos/, "Dinheiro gasto para estimular o comércio, os serviços e o turismo.", "promoção comercial (feiras, missões), comércio exterior (apoio a exportações), serviços financeiros e turismo (promoção e estrutura turística)."],
  [/^comunicacoes/, "Dinheiro gasto com a infraestrutura de comunicação do país.", "serviços postais (Correios) e telecomunicações."],
  [/^energia/, "Dinheiro gasto com a produção e o abastecimento de energia.", "energia elétrica (geração e distribuição), petróleo, álcool e conservação de energia."],
  [/^transporte/, "Dinheiro gasto com a infraestrutura para circular pessoas e cargas.", "transporte rodoviário (estradas, pontes), ferroviário, aéreo (aeroportos) e hidroviário (portos e hidrovias)."],
  [/^desporto e lazer/, "Dinheiro gasto com o esporte e o lazer da população.", "desporto de rendimento (atletas), desporto comunitário (quadras, programas nos bairros) e lazer (parques e praças)."],
  [/^encargos especiais/, "Gastos que não pertencem a uma área específica, em geral ligados à dívida e a repasses entre governos.", "pagamento da dívida (principal e juros), refinanciamento da dívida, transferências a outros governos e encargos previdenciários."],
  [/^reserva de contingencia/, "Parte do orçamento reservada para imprevistos e riscos fiscais. Não é um gasto em si.", "só vira despesa de uma área se for remanejada para ela durante o ano."],
  // subfunções mais comuns
  [/^atencao basica/, "Atendimento de saúde do dia a dia, perto de onde as pessoas moram.", "postos e unidades de saúde, equipes de saúde da família, agentes comunitários e consultas de rotina."],
  [/^assistencia hospitalar/, "Atendimento de saúde de maior complexidade.", "hospitais, prontos-socorros, consultas com especialistas, exames e cirurgias."],
  [/^vigilancia/, "Prevenção e controle de doenças e de riscos à saúde da população.", "vacinação, controle de epidemias, fiscalização de alimentos e de estabelecimentos."],
  [/^suporte profilatico/, "Compra e distribuição de remédios e insumos de saúde.", "medicamentos, vacinas e materiais para tratamentos."],
  [/^educacao infantil/, "Educação das crianças pequenas.", "creches (até 3 anos) e pré-escolas (4 e 5 anos)."],
  [/^ensino fundamental/, "Escolas de 1º ao 9º ano.", "salários de professores, manutenção das escolas, merenda e transporte escolar."],
  [/^ensino medio/, "Escolas de ensino médio.", "salários de professores e manutenção das escolas."],
  [/^ensino superior/, "Universidades e institutos federais ou estaduais.", "salários de professores, pesquisa e manutenção dos campi."],
  [/^ensino profissional/, "Cursos técnicos e de qualificação para o trabalho.", "escolas técnicas e cursos profissionalizantes."],
  [/^previdencia do regime estatutario/, "Aposentadorias e pensões dos servidores públicos.", "pagamento de aposentados e pensionistas do próprio governo."],
  [/^previdencia do regime geral|^previdencia basica/, "Aposentadorias e pensões do INSS (regime geral).", "benefícios dos trabalhadores do setor privado."],
  [/^policiamento/, "Presença da polícia nas ruas e no atendimento ao cidadão.", "polícias militar, civil e federal, viaturas e equipamentos."],
  [/^defesa civil/, "Prevenção e resposta a desastres naturais e emergências.", "ajuda a atingidos por enchentes e deslizamentos, monitoramento de riscos."],
  [/^transporte rodoviario/, "Estradas e vias que ligam cidades e regiões.", "construção, pavimentação e manutenção de rodovias e pontes."],
  [/^transportes? coletivos/, "Transporte público de passageiros.", "ônibus, metrô, trens urbanos e terminais."],
  [/^servicos urbanos/, "Serviços que mantêm a cidade limpa e iluminada.", "coleta de lixo, limpeza de ruas, iluminação pública e conservação de praças."],
  [/^infra-?estrutura urbana/, "Obras que estruturam a cidade.", "pavimentação, drenagem, calçadas e obras de mobilidade."],
  [/^refinanciamento da divida/, "Troca de dívidas antigas por novas. Não é um gasto novo, e sim dívida rolada.", "novos empréstimos usados para pagar os antigos."],
  [/^servico da divida/, "Pagamento de juros e do valor principal da dívida pública.", "juros, amortizações e encargos de empréstimos e títulos."],
  [/^outros encargos especiais/, "Transferências e encargos que não cabem em outra categoria.", "repasses obrigatórios, indenizações e sentenças judiciais."],
];

const EXPENSE_NATURE: Rule[] = [
  [/^pessoal e encargos/, "Quanto o governo gasta com as pessoas que trabalham para ele.", "salários, aposentadorias e pensões, adicionais e encargos como INSS e FGTS."],
  [/^juros e encargos/, "Custo de ter dívida: o que se paga a mais, além do valor emprestado.", "juros de empréstimos e de títulos públicos e comissões financeiras."],
  [/^outras despesas correntes/, "O custeio do dia a dia, que mantém os serviços funcionando.", "contratos, material de consumo, água e luz, serviços de terceiros, benefícios sociais e repasses a entidades."],
  [/^investimentos/, "Gastos que deixam algo duradouro para o patrimônio público.", "obras (escolas, hospitais, estradas), equipamentos, veículos e compra de terrenos."],
  [/^inversoes financeiras/, "Gastos que trocam dinheiro por um ativo financeiro ou imóvel.", "compra de ações de empresas, de imóveis já construídos e concessão de empréstimos."],
  [/^amortizacao da divida/, "Pagamento do valor principal da dívida, sem os juros.", "devolução do dinheiro emprestado ao governo."],
  [/^reserva de contingencia/, "Parte do orçamento reservada para imprevistos.", "só vira gasto se for remanejada."],
];

const REVENUE: Rule[] = [
  [/^impostos|^receita tributaria|^tributos/, "Dinheiro que o próprio governo arrecada dos contribuintes.", "impostos (IPTU, ISS, ICMS, IPVA, Imposto de Renda), taxas e contribuições de melhoria."],
  [/^contribuicoes/, "Contribuições cobradas para financiar uma finalidade específica.", "contribuições sociais (como as que financiam a Previdência) e econômicas."],
  [/^receita patrimonial/, "Dinheiro que vem do patrimônio do governo.", "aluguéis, dividendos de empresas e rendimentos de aplicações financeiras."],
  [/^receita agropecuaria/, "Dinheiro de atividades agropecuárias do próprio governo.", "venda de produtos agrícolas e animais de fazendas e institutos públicos."],
  [/^receita industrial/, "Dinheiro de atividades industriais do próprio governo.", "venda de produtos de indústrias públicas."],
  [/^receita de servicos/, "Dinheiro cobrado por serviços que o governo presta.", "tarifas e preços de serviços (como hospitais universitários, portos e aeroportos)."],
  [/^transferencias de capital/, "Dinheiro enviado por outro governo ou instituição para obras e investimentos.", "convênios e repasses para construir ou equipar."],
  [/^transferencias correntes/, "Dinheiro enviado por outro governo para o custeio do dia a dia.", "FPM e FPE (fundos de participação), repasses do SUS e do Fundeb, parte do ICMS e do IPVA."],
  [/^transferencias/, "Dinheiro repassado por outro nível de governo ou instituição.", "repasses obrigatórios e voluntários."],
  [/^outras receitas correntes/, "Receitas do dia a dia que não se encaixam nas outras.", "multas, juros de mora, indenizações e restituições."],
  [/^operacoes de credito/, "Dinheiro entra no caixa, mas é emprestado e precisa ser devolvido com juros.", "empréstimos e financiamentos de bancos e emissão de títulos."],
  [/^alienacao de bens/, "Dinheiro da venda de bens do governo.", "venda de imóveis, veículos e outros bens."],
  [/^amortizacao de emprestimos/, "Dinheiro que volta de empréstimos que o governo havia concedido.", "devolução de financiamentos concedidos antes."],
  [/^outras receitas de capital/, "Receitas de capital que não cabem nas outras categorias.", "recursos eventuais ligados ao patrimônio."],
  [/^receitas? de capital/, "Receitas que alteram o patrimônio do governo, e não o custeio do dia a dia.", "empréstimos, venda de bens e transferências para investimento."],
  [/^receitas? correntes/, "Receitas do dia a dia, que ajudam a pagar os serviços.", "impostos, contribuições, serviços e transferências de outros governos."],
  [/^receitas? intraorcamentarias/, "Repasses entre órgãos do mesmo governo. Aparecem como receita e como despesa e se anulam.", "contribuições de um órgão do governo para outro, como a patronal à previdência dos servidores."],
  [/^deducoes/, "Valores retirados da receita bruta, que o governo arrecadou mas não fica com ele.", "repasses obrigatórios a outros entes (como o Fundeb) e restituições de tributos."],
];

export type GlossaryView = "expense" | "revenue" | "nature";

/** Explicação pronta de um item; usa o texto da função-mãe quando for uma subcategoria sem texto próprio. */
export function explainItem(name: string, view: GlossaryView, scope: string, parentName?: string | null): Glossary {
  const rules = view === "revenue" ? REVENUE : view === "nature" ? EXPENSE_NATURE : EXPENSE_FUNCTIONS;
  const hit = rules.find(([re]) => re.test(norm(name)));
  if (hit) return { what: hit[1], includes: hit[2] };
  if (parentName) {
    const p = rules.find(([re]) => re.test(norm(parentName)));
    return p
      ? { what: `Subdivisão de "${parentName}". ${p[1]}`, includes: p[2] }
      : { what: `Subdivisão de "${parentName}": detalha um tipo específico de ${view === "revenue" ? "receita" : "gasto"} dessa área.` };
  }
  const kind = view === "revenue" ? "Origem de receita" : view === "nature" ? "Tipo de gasto" : "Área do orçamento";
  return { what: `${kind} "${name}" no orçamento do ${scope}, como o ente a declarou ao Tesouro Nacional (RREO).` };
}
