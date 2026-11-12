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


// ───── subitens (subfunções, espécies de receita): texto próprio para cada um, com "$" para não capturar nomes parecidos ─────
const EXPENSE_SPECIFIC: Rule[] = [
  [/^acao legislativa$/, "Funcionamento do Poder Legislativo.", "salários de parlamentares e servidores, gabinetes, sessões e comissões."],
  [/^controle externo$/, "Fiscalização das contas do governo feita por órgãos independentes.", "tribunais de contas, auditorias e análise de contas públicas."],
  [/^acao judiciaria$/, "Funcionamento dos tribunais e varas que julgam os processos.", "salários de juízes e servidores, fóruns e sistemas judiciais."],
  [/^representacao judicial e extrajudicial$/, "Advocacia pública: defende o governo em processos e orienta juridicamente a administração.", "procuradorias e consultorias jurídicas do governo."],
  [/^defesa da ordem juridica$/, "Órgãos que defendem a lei e as pessoas que não podem pagar um advogado.", "Ministério Público e Defensoria Pública."],
  [/^planejamento e orcamento$/, "Elaboração e acompanhamento do orçamento e dos planos do governo.", "planos plurianuais, leis orçamentárias e estatísticas."],
  [/^administracao financeira$/, "Gestão do caixa, dos pagamentos, da contabilidade e da dívida.", "tesouraria, contabilidade e controle financeiro."],
  [/^controle interno$/, "Auditoria e fiscalização dentro do próprio governo.", "controladorias e corregedorias."],
  [/^normatizacao e fiscalizacao$/, "Regras e fiscalização de atividades da administração.", "fiscalização de posturas, obras e licenças."],
  [/^tecnologia da informacao$/, "Sistemas, computadores e redes do governo.", "equipamentos, softwares, contratos de TI e segurança de dados."],
  [/^ordenamento territorial$/, "Organização do uso do solo e dos mapas do território.", "cadastro de imóveis, mapeamento e planejamento territorial."],
  [/^formacao de recursos humanos$/, "Treinamento e capacitação de servidores.", "escolas de governo, cursos e bolsas para servidores."],
  [/^administracao de receitas$/, "Lançamento e cobrança de impostos e taxas.", "secretarias de fazenda, fiscalização tributária e dívida ativa."],
  [/^administracao de concessoes$/, "Acompanhamento de concessões e contratos de serviços públicos.", "agências e equipes que fiscalizam concessionárias."],
  [/^comunicacao social$/, "Divulgação oficial de informações do governo.", "publicidade institucional, imprensa oficial e portais."],
  [/^defesa aerea$/, "Aeronáutica: proteção do espaço aéreo.", "aviões de caça e transporte, radares, bases aéreas e controle do tráfego aéreo militar."],
  [/^defesa naval$/, "Marinha: proteção das águas e da costa.", "navios, submarinos, bases navais e patrulha."],
  [/^defesa terrestre$/, "Exército: proteção do território.", "tropas, quartéis, blindados, treinamento e fronteiras."],
  [/^informacao e inteligencia$/, "Coleta e análise de informações para prevenir crimes e ameaças.", "serviços de inteligência policial e de Estado."],
  [/^relacoes diplomaticas$/, "Representação do país junto a outros países.", "embaixadas, consulados e missões diplomáticas."],
  [/^cooperacao internacional$/, "Projetos e contribuições com outros países e organismos internacionais.", "contribuições à ONU e a outros organismos, acordos de cooperação."],
  [/^assistencia ao idoso$/, "Proteção e atendimento a pessoas idosas.", "centros de convivência, abrigos e benefícios."],
  [/^assistencia a pessoa com deficiencia$|^assistencia a pessoa portadora de deficiencia$/, "Proteção e apoio a pessoas com deficiência.", "benefícios, centros de atendimento e programas de inclusão."],
  [/^assistencia a crianca e ao adolescente$/, "Proteção e atendimento a crianças e adolescentes.", "abrigos, conselhos tutelares e programas contra o trabalho infantil."],
  [/^assistencia comunitaria$/, "Apoio a famílias e comunidades em situação de risco.", "centros de referência (CRAS e CREAS) e ações nos bairros."],
  [/^servicos socioassistenciais$/, "Atendimento continuado a famílias e pessoas em vulnerabilidade.", "acolhimento, acompanhamento familiar e serviços de convivência."],
  [/^seguranca e renda$/, "Garantia de renda mínima a quem precisa.", "transferência de renda, como o Bolsa Família, e benefícios assistenciais."],
  [/^previdencia complementar$/, "Fundos que pagam aposentadoria além do teto do INSS.", "contribuições do governo a fundos de previdência dos servidores."],
  [/^previdencia especial$/, "Regimes de aposentadoria específicos, fora do regime geral e do dos servidores civis.", "regimes especiais, como o dos militares."],
  [/^alimentacao e nutricao$/, "Combate à desnutrição e incentivo à alimentação saudável.", "programas de nutrição, suplementação e segurança alimentar."],
  [/^vigilancia epidemiologica$/, "Acompanhamento e controle de doenças na população.", "vacinação, monitoramento de surtos e notificação de doenças."],
  [/^vigilancia sanitaria$/, "Fiscalização de produtos e serviços que afetam a saúde.", "inspeção de alimentos, remédios, hospitais e estabelecimentos."],
  [/^protecao e beneficios ao trabalhador$/, "Benefícios pagos a quem trabalha ou perdeu o emprego.", "seguro-desemprego, abono salarial e benefícios ao trabalhador."],
  [/^fomento ao trabalho$/, "Incentivos para gerar trabalho e renda.", "apoio a pequenos negócios, cooperativas e economia solidária."],
  [/^empregabilidade$/, "Ajuda para encontrar emprego e se qualificar.", "agências de emprego, cursos de qualificação e intermediação de vagas."],
  [/^relacoes de trabalho$/, "Fiscalização e mediação entre trabalhadores e empresas.", "inspeção do trabalho, combate ao trabalho escravo e mediação."],
  [/^educacao infantil$/, "Educação das crianças pequenas.", "creches (até 3 anos) e pré-escolas (4 e 5 anos), com professores, merenda e transporte escolar."],
  [/^educacao basica$/, "Ensino da infância ao ensino médio, somado.", "creches, pré-escolas, ensino fundamental e médio."],
  [/^educacao de jovens e adultos$/, "Ensino para quem não concluiu a escola na idade certa.", "turmas de alfabetização e supletivo."],
  [/^educacao especial$/, "Atendimento educacional a alunos com deficiência.", "salas de recursos, professores de apoio e escolas especiais."],
  [/^patrimonio historico artistico e arqueologico$/, "Preservação da memória e de bens de valor histórico.", "restauração de prédios históricos, museus e sítios arqueológicos."],
  [/^difusao cultural$/, "Acesso da população a atividades culturais.", "teatros, bibliotecas, festivais e apoio a artistas."],
  [/^custodia e reintegracao social$/, "Sistema prisional e programas de ressocialização.", "presídios, agentes penitenciários e trabalho e estudo para presos."],
  [/^direitos individuais coletivos e difusos$/, "Proteção de direitos humanos e de grupos específicos.", "defesa do consumidor, igualdade racial e de gênero, proteção a minorias."],
  [/^assistencia aos povos indigenas$/, "Apoio às comunidades indígenas.", "saúde, proteção de terras e programas nas aldeias."],
  [/^infra-?estrutura urbana$/, "Obras que estruturam a cidade.", "pavimentação, drenagem, calçadas e obras de mobilidade."],
  [/^servicos urbanos$/, "Serviços que mantêm a cidade limpa e iluminada.", "coleta de lixo, limpeza de ruas, iluminação pública e praças."],
  [/^transportes? coletivos urbanos$/, "Transporte público de passageiros nas cidades.", "ônibus, metrô, trens urbanos e terminais."],
  [/^habitacao urbana$/, "Moradia nas cidades.", "casa própria, melhorias de moradias e regularização fundiária urbana."],
  [/^habitacao rural$/, "Moradia no campo.", "construção e reforma de casas rurais."],
  [/^saneamento basico urbano$/, "Água, esgoto e lixo nas cidades.", "redes de água e esgoto e estações de tratamento."],
  [/^saneamento basico rural$/, "Água e esgoto no campo.", "poços, cisternas e pequenas redes no meio rural."],
  [/^preservacao e conservacao ambiental$/, "Proteção da natureza e da biodiversidade.", "parques, reservas e unidades de conservação."],
  [/^controle ambiental$/, "Controle de atividades que podem poluir ou degradar.", "licenciamento, fiscalização e multas ambientais."],
  [/^recuperacao de areas degradadas$/, "Recuperar áreas danificadas.", "reflorestamento e recuperação de solos e rios."],
  [/^recursos hidricos$/, "Gestão do uso da água.", "monitoramento de rios e represas, outorgas e comitês de bacia."],
  [/^meteorologia$/, "Previsão do tempo e do clima.", "estações meteorológicas e alertas."],
  [/^desenvolvimento cientifico$/, "Pesquisa científica de base.", "bolsas de pesquisa, laboratórios e institutos."],
  [/^desenvolvimento tecnologico e engenharia$/, "Pesquisa aplicada e inovação.", "tecnologia para novos produtos, processos e serviços."],
  [/^difusao do conhecimento cientifico e tecnologico$/, "Divulgação da ciência para a população.", "museus de ciência, feiras e divulgação científica."],
  [/^promocao da producao agropecuaria$/, "Apoio à produção de alimentos.", "sementes, insumos, crédito e incentivo à pecuária e à lavoura."],
  [/^abastecimento$/, "Garantir alimentos a preço acessível.", "armazéns, feiras, estoques e programas de compra de alimentos."],
  [/^irrigacao$/, "Levar água para a lavoura.", "açudes, canais e equipamentos de irrigação."],
  [/^defesa agropecuaria$/, "Controle de pragas e doenças de plantas e animais.", "vigilância sanitária animal e vegetal e campanhas de vacinação do gado."],
  [/^extensao rural$/, "Assistência técnica ao produtor rural.", "técnicos que orientam agricultores."],
  [/^reforma agraria$/, "Distribuição e regularização de terras.", "assentamentos, titulação e apoio a assentados."],
  [/^propriedade industrial$/, "Proteção de invenções e marcas.", "registro de patentes e marcas."],
  [/^mineracao$/, "Apoio e fiscalização da atividade mineradora.", "pesquisa geológica e fiscalização de lavras."],
  [/^promocao industrial$/, "Incentivos para a indústria.", "apoio a polos industriais e atração de investimentos."],
  [/^normalizacao e qualidade$/, "Padrões e medidas oficiais de produtos.", "metrologia, certificação e normas técnicas."],
  [/^comercio exterior$/, "Apoio a exportações e importações.", "missões comerciais, promoção de produtos no exterior e facilitação de comércio."],
  [/^turismo$/, "Estímulo à atividade turística.", "promoção de destinos, sinalização turística e estrutura para visitantes."],
  [/^promocao comercial$/, "Estímulo ao comércio local.", "feiras, campanhas e apoio a lojistas."],
  [/^servicos financeiros$/, "Apoio ao sistema financeiro e ao crédito.", "bancos públicos, fundos e supervisão financeira."],
  [/^telecomunicacoes$/, "Redes de telefonia, internet e radiodifusão.", "expansão de internet, fiscalização e inclusão digital."],
  [/^comunicacoes postais$/, "Serviço de correios.", "agências, entregas e logística postal."],
  [/^energia eletrica$/, "Produção e distribuição de eletricidade.", "usinas, linhas de transmissão e redes de distribuição."],
  [/^conservacao de energia$/, "Uso eficiente de energia.", "eficiência energética e programas de economia."],
  [/^combustiveis minerais$/, "Petróleo, gás e carvão.", "pesquisa, produção e fiscalização de combustíveis fósseis."],
  [/^biocombustiveis$/, "Combustíveis de origem vegetal.", "etanol e biodiesel."],
  [/^transporte rodoviario$/, "Estradas e vias que ligam cidades e regiões.", "construção, pavimentação e manutenção de rodovias e pontes."],
  [/^transporte aquaviario$/, "Transporte por água.", "portos, hidrovias e terminais."],
  [/^transporte ferroviario$/, "Trens de carga e de passageiros.", "ferrovias, trens e estações."],
  [/^transporte aereo$/, "Aviação civil.", "aeroportos, pistas e controle de voo."],
  [/^transporte especial$/, "Modos de transporte específicos.", "teleféricos, dutovias e outros."],
  [/^desporto de rendimento$/, "Esporte de alto nível.", "apoio a atletas, equipes e competições."],
  [/^desporto comunitario$/, "Esporte para toda a população.", "quadras, ginásios, escolinhas e eventos esportivos nos bairros."],
  [/^lazer$/, "Espaços e atividades de lazer.", "parques, praças e programas de recreação."],
  [/^servico da divida interna$/, "Juros e principal da dívida com credores no Brasil.", "títulos públicos e empréstimos de bancos brasileiros."],
  [/^servico da divida externa$/, "Juros e principal da dívida com credores no exterior.", "empréstimos de organismos internacionais e títulos em moeda estrangeira."],
  [/^refinanciamento da divida interna$/, "Troca de dívida antiga por nova com credores no Brasil. Não é gasto novo.", "novos títulos ou empréstimos usados para pagar os antigos."],
  [/^refinanciamento da divida externa$/, "Troca de dívida antiga por nova com credores no exterior. Não é gasto novo.", "novos empréstimos em moeda estrangeira usados para pagar os antigos."],
  [/^transferencias$/, "Repasses obrigatórios e legais a outros governos.", "cota-parte de impostos e outras transferências constitucionais."],
  [/^transferencias para a educacao basica$/, "Repasses para financiar a educação básica.", "contribuição ao Fundeb."],
  [/^previdenciarios$|^encargos previdenciarios/, "Encargos com a Previdência dos servidores.", "contribuições patronais e déficits atuariais."],
];

const REVENUE_SPECIFIC: Rule[] = [
  [/^impostos$/, "Dinheiro cobrado dos contribuintes sem contrapartida direta.", "__IMPOSTOS__"],
  [/^taxas$/, "Cobradas por serviços específicos ou pelo poder de polícia do governo.", "alvarás, coleta de lixo, fiscalização e emissão de documentos."],
  [/^contribuicao de melhoria$/, "Cobrada de quem tem o imóvel valorizado por uma obra pública.", "ex.: pavimentação ou drenagem que valoriza as casas da rua."],
  [/^contribuicoes sociais$/, "Contribuições que financiam a seguridade social.", "contribuições previdenciárias de servidores e do governo como empregador."],
  [/^contribuicao economicas?$/, "Contribuições para intervir em um setor da economia.", "como a Cide sobre combustíveis."],
  [/^contribuicao para o custeio do servico de iluminacao publica$/, "A taxa de iluminação pública (COSIP), cobrada na conta de luz.", "paga a energia e a manutenção dos postes e lâmpadas das ruas."],
  [/^exploracao do patrimonio imobiliario/, "Dinheiro de imóveis públicos.", "aluguéis, arrendamentos e foros."],
  [/^valores mobiliarios$/, "Rendimento do dinheiro aplicado.", "juros de aplicações financeiras e dividendos de ações."],
  [/^exploracao de recursos naturais$/, "Compensações pelo uso de recursos naturais do país.", "royalties de petróleo, gás e minérios e compensação pelo uso da água."],
  [/^cessao de direitos$/, "Pagamento por direitos que o governo cede a terceiros.", "ex.: bancos que pagam para administrar a folha de pagamento."],
  [/^delegacao de servicos publicos/, "Pagamento por concessões e permissões de serviços públicos.", "outorgas de rodovias, aeroportos, energia e saneamento."],
  [/^exploracao do patrimonio intangivel$/, "Direitos de uso de bens não físicos do governo.", "marcas, patentes e softwares."],
  [/^demais receitas patrimoniais$/, "Outras receitas ligadas ao patrimônio.", "valores menores que não cabem nas categorias anteriores."],
  [/^servicos e atividades financeiras$/, "Cobrança por serviços financeiros do governo.", "taxas de administração de fundos e serviços bancários."],
  [/^servicos e atividades referentes a navegacao e ao transporte$/, "Cobrança por serviços de navegação e transporte.", "tarifas portuárias e aeroportuárias e pedágios."],
  [/^servicos administrativos e comerciais gerais$/, "Cobrança por serviços do dia a dia da administração.", "certidões, emissão de documentos e serviços de cartório."],
  [/^servicos e atividades referentes a saude$/, "Cobrança por serviços de saúde.", "atendimentos em hospitais públicos pagos por planos e convênios."],
  [/^outros servicos$/, "Serviços diversos prestados pelo governo.", "taxas e tarifas que não cabem nas categorias anteriores."],
  [/^multas administrativas, contratuais e judiciais$/, "Multas aplicadas pelo governo.", "multas de trânsito, ambientais, contratuais e judiciais."],
  [/^indenizacoes, restituicoes e ressarcimentos$/, "Dinheiro que volta aos cofres por devolução ou indenização.", "restituição de pagamentos indevidos e ressarcimento de danos."],
  [/^bens, direitos e valores incorporados ao patrimonio publico$/, "Bens recebidos pelo governo sem compra.", "doações, bens apreendidos e perdidos para o Estado."],
  [/^multas e juros de mora das receitas de capital$/, "Multas e juros pelo atraso em receitas de capital.", "atraso em pagamentos de empréstimos ou vendas de bens."],
  [/^demais receitas correntes$/, "Outras receitas do dia a dia.", "valores menores que não cabem nas categorias anteriores."],
  [/^demais transferencias correntes$/, "Outros repasses para o custeio do dia a dia.", "repasses diversos de pessoas, empresas e outros governos."],
  [/^demais transferencias de capital$/, "Outros repasses para obras e investimentos.", "repasses diversos de pessoas, empresas e outros governos."],
  [/^transferencias da uniao e de suas entidades$/, "Recursos enviados pelo governo federal.", "FPM e FPE (fundos de participação), repasses do SUS, Fundeb, merenda e convênios."],
  [/^transferencias dos estados e do distrito federal e de suas entidades$/, "Recursos enviados pelos estados.", "parte do ICMS e do IPVA arrecadados e repasses de convênios estaduais."],
  [/^transferencias de instituicoes privadas$/, "Recursos enviados por empresas e entidades privadas.", "doações e convênios com o setor privado."],
  [/^transferencias de outras instituicoes publicas$/, "Recursos enviados por outras instituições públicas.", "repasses de consórcios, fundos e outros órgãos."],
  [/^transferencias de instituicoes multigovernamentais$/, "Recursos de fundos mantidos por vários governos.", "como a complementação do Fundeb."],
  [/^transferencias de pessoas$/, "Doações de pessoas físicas.", "contribuições e doações voluntárias."],
  [/^transferencias do exterior$/, "Recursos enviados por governos e organizações de outros países.", "doações e cooperação internacional."],
  [/^operacoes de credito - mercado interno$/, "Empréstimos contratados com credores no Brasil. O dinheiro entra no caixa, mas vira dívida em reais.", "financiamentos de bancos públicos e privados brasileiros e emissão de títulos no mercado nacional."],
  [/^operacoes de credito - mercado externo$/, "Empréstimos contratados com credores no exterior. O dinheiro entra no caixa, mas vira dívida em moeda estrangeira, sujeita à variação do câmbio.", "financiamentos de organismos como BID, Banco Mundial e CAF e emissão de títulos no exterior."],
  [/^alienacao de bens intangiveis$/, "Venda de bens não físicos do governo.", "marcas, patentes, direitos e softwares."],
  [/^alienacao de bens moveis$/, "Venda de bens que podem ser transportados.", "veículos, máquinas e equipamentos."],
  [/^alienacao de bens imoveis$/, "Venda de imóveis do governo.", "terrenos, prédios e áreas."],
  [/^amortizacoes de emprestimos$/, "Devolução de empréstimos que o governo concedeu antes.", "pagamento de financiamentos feitos pelo governo a empresas ou entes."],
  [/^remuneracao das disponibilidades do tesouro$/, "Rendimento do dinheiro que fica no caixa do governo.", "juros das aplicações do caixa único."],
  [/^demais receitas de capital$/, "Outras receitas de capital.", "valores menores que não cabem nas categorias anteriores."],
];

const IMPOSTOS_BY_SCOPE: Record<string, string> = {
  município: "IPTU (imóveis), ISS (serviços), ITBI (compra de imóveis) e Imposto de Renda retido na fonte dos servidores.",
  estado: "ICMS (circulação de mercadorias), IPVA (veículos), ITCMD (heranças e doações) e IR retido dos servidores.",
  "governo federal": "Imposto de Renda, IPI, IOF, imposto de importação e demais impostos federais.",
};

export type GlossaryView = "expense" | "revenue" | "nature";

/** Explicação pronta de um item; usa o texto da função-mãe quando for uma subcategoria sem texto próprio. */
export function explainItem(name: string, view: GlossaryView, scope: string, parentName?: string | null): Glossary {
  const clean = norm(name).replace(/^fu\d+ - /, "");
  const area = parentName ?? "";

  // agrupamentos genéricos criados pelo Tesouro: dependem da área
  if (view !== "revenue" && clean === "administracao geral" && parentName) {
    return { what: `Despesas de apoio administrativo da própria área de ${area}, que não são o serviço-fim.`, includes: "gestão, pessoal de apoio, material de escritório e manutenção dos órgãos da área." };
  }
  if (view !== "revenue" && clean === "demais subfuncoes" && parentName) {
    return { what: `Soma das subdivisões menores de ${area} que não aparecem separadas nesta tabela.` };
  }

  const specific = (view === "revenue" ? REVENUE_SPECIFIC : view === "nature" ? [] : EXPENSE_SPECIFIC).find(([re]) => re.test(clean));
  if (specific) {
    const inc = specific[2] === "__IMPOSTOS__" ? IMPOSTOS_BY_SCOPE[scope] : specific[2];
    return { what: specific[1], includes: inc };
  }

  const rules = view === "revenue" ? REVENUE : view === "nature" ? EXPENSE_NATURE : EXPENSE_FUNCTIONS;
  const hit = rules.find(([re]) => re.test(clean));
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
