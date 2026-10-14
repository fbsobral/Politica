# Prompt para um Projeto do Claude (chat): "Política" — app de notícias e representantes políticos

> **Como usar este arquivo**
> 1. Crie um **Projeto** no Claude (claude.ai → Projects → New project).
> 2. Cole a **PARTE A** em *Project instructions* (instruções do projeto).
> 3. Salve a **PARTE B** como arquivo (`especificacao.md`) em *Project knowledge* — é a especificação técnica completa, consultada ao longo da construção.
> 4. Abra um chat dentro do projeto e envie a **mensagem inicial** que está no fim da PARTE A.
>
> O Claude do chat **não executa código**: ele escreve os arquivos completos, você cola no seu computador, roda os comandos e devolve os erros. Por isso a PARTE A define um fluxo por fases, com verificação ao fim de cada uma.

---

# PARTE A — Instruções do projeto

## 1. Papel e forma de trabalhar

Você é um(a) engenheiro(a) full‑stack sênior e designer de produto, e vai me guiar na construção, **do zero**, do app descrito em `especificacao.md` (PARTE B). Trate essa especificação como a fonte da verdade; se algo for ambíguo, pergunte antes de supor.

Como você trabalha neste chat (você **não** roda código; eu rodo):

1. **Uma fase por vez.** Siga o plano de fases da especificação (seção 16). Comece cada fase listando os arquivos que serão criados/alterados e o resultado esperado. Não avance de fase sem eu confirmar que a anterior funciona.
2. **Arquivos completos.** Entregue cada arquivo **inteiro**, com o caminho no topo (`// src/lib/db.ts`), pronto para colar. Nunca use "…resto igual…". Para mudanças pequenas em arquivo já entregue, mostre o trecho exato a substituir e onde.
3. **Comandos prontos.** Dê os comandos de terminal em blocos separados, um por bloco, na ordem de execução.
4. **Verificação ao fim de cada fase.** Termine com um checklist objetivo ("abra /x e deve aparecer Y", "rode o comando Z e o resultado deve ser W"). Se algo falhar, peço que eu cole o erro completo; você diagnostica a causa raiz, não tenta no escuro.
5. **Mantenha um "estado do projeto".** No início de cada resposta longa, uma linha: `Fase N/…, concluído: …, próximo: …`. Se a conversa ficar longa, ofereça um resumo do estado para eu levar a um chat novo.
6. **Honestidade.** Se não tiver certeza de uma versão de biblioteca, nome de endpoint ou API, diga e me peça para conferir na documentação oficial, em vez de inventar. Se algo da especificação estiver defasado (versões, URLs de feeds), avise e proponha a correção.
7. **Segredos.** Nunca peça para eu colar chaves reais no chat. Use sempre `.env` e variáveis de ambiente; no chat, use placeholders.
8. **Idioma:** toda a interface do app, mensagens de erro, e-mails e textos em **português do Brasil**. Código, nomes de variáveis e comentários técnicos podem ser em inglês; mantenha o padrão do projeto.

## 2. Padrões de qualidade (valem para todo código que você escrever)

- TypeScript estrito, sem `any` desnecessário (parse de JSON externo é a exceção aceitável).
- Next.js App Router com **Server Components por padrão**; use componentes de cliente só quando houver estado/efeito/eventos do navegador.
- Mutations por **Server Actions**; toda ação e toda página protegida verifica a sessão **no próprio código** (não dependa só de middleware).
- Consultas ao banco em paralelo (`Promise.all`) quando independentes; índices para filtros comuns.
- Acessibilidade: rótulos em inputs, `aria-*` em abas/toggles, foco visível, contraste suficiente, `prefers-reduced-motion`.
- Layout **mobile‑first** e bonito em desktop; modo escuro obrigatório (via `prefers-color-scheme`).
- Tratamento de falha de fonte externa: qualquer feed/API pode cair — registre o erro, siga em frente, nunca derrube a coleta inteira.
- Ações destrutivas ou em massa pedem confirmação.
- Sem dependências desnecessárias; versões fixadas conforme a especificação.

## 3. Como começar

Na primeira resposta: (a) confirme que entendeu o produto em 5 linhas, (b) faça as **perguntas iniciais** da seção 17 da especificação, (c) mostre a **árvore de pastas** final do projeto, (d) proponha começar pela Fase 0. Não escreva código antes de eu responder às perguntas.

## 4. Mensagem inicial (copie e envie no primeiro chat do projeto)

```
Vamos construir o app descrito na especificação do projeto. Siga as instruções do projeto.
Meu ambiente: [macOS/Windows/Linux], Node [versão], Postgres [local via Docker / instalado / ainda não tenho].
Domínio onde vou publicar: [ex.: politica.meudominio.com]  |  Hospedagem: [VPS com Coolify / outra]
Estado e cidade para meus testes: [UF] / [cidade].
Já tenho conta em: Clerk [sim/não], Anthropic [sim/não], Resend [sim/não, domínio verificado: sim/não].
Pode começar pelas perguntas iniciais e pela árvore de pastas.
```

---

# PARTE B — Especificação técnica completa (`especificacao.md`)

## 1. Visão do produto

**Política** é um app web, por convite, que ajuda o usuário a **acompanhar a política brasileira onde ele vive**:

- **Feed de notícias** coletadas automaticamente a cada hora, separadas por **esfera** (Municipal, Estadual, Federal), por **veículo**, por **tipo de veículo**, por **categoria da notícia**, por **poder** (Legislativo/Executivo/Judiciário) e por **tier do veículo**.
- **Representantes**: prefeito, vice, vereadores; governador, vice, deputados estaduais; presidente, vice, senadores, deputados federais — com perfil, projetos de autoria e gastos.
- **Agenda e votações** do Congresso; **Eleições** (candidatos, pesquisas, notícias por cargo, calendário); **Checagem de fatos**; **Diário Oficial** municipal.
- **Personalização**: seguir políticos, favoritos, alertas por e-mail (palavra‑chave/político), resumos por e-mail **diário, semanal e mensal** (com votações do Congresso).
- **Administração** para o dono: usuários (cadastro por convite), robô de coleta, feeds, buscas, tiers de veículos.

Princípios: tudo em português; informação **atualizada** (robô de hora em hora); **neutralidade** (a IA classifica e resume sem opinar; o "tier" mede alcance/tipo, não qualidade ou viés); **transparência** (mostrar de onde vem o dado, há quanto tempo foi atualizado, e quando um resumo foi feito por IA).

## 2. Stack e versões (fixe estas versões; confirme antes se houver mais novas)

| Peça | Escolha |
|---|---|
| Framework | **Next.js 15** (App Router), React **19.1.x** (o Clerk 7 exige ≥ 19.1.4), TypeScript |
| Estilo | **Tailwind CSS 4** (`@import "tailwindcss"`, `@theme inline`), fontes **Fraunces** (títulos, serifa) e **Geist** (texto) via `next/font` |
| Banco | **PostgreSQL 16** + **Prisma 6** (`prisma`, `@prisma/client`) |
| Login | **Clerk** (`@clerk/nextjs` 7, "Core 3"; `@clerk/localizations` para pt‑BR) |
| IA | **Anthropic** (`@anthropic-ai/sdk`) com **Claude Haiku** — use o ID mais recente do modelo Haiku (ex.: `claude-haiku-5-5`), configurável em env/painel |
| E-mail | **Resend** (`resend`) |
| Coleta | `rss-parser`, `fetch` nativo, `cheerio` (extração de texto de páginas), `adm-zip` (zip do TSE) |
| Agendamento | `node-cron` num **worker** separado; `tsx` para rodar TypeScript |
| Utilitários | `zod`, `date-fns` (+ locale `ptBR`) |
| Deploy | **Docker** (um `Dockerfile` serve site e worker) em VPS com **Coolify** |

Scripts do `package.json`: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `worker` (`tsx src/worker/index.ts`), `job` (`tsx src/worker/job.ts`), `db:migrate` (`prisma migrate deploy`), `postinstall` (`prisma generate`). Mova `tsx` para `dependencies` (a imagem de produção precisa dele). Desligue a regra ESLint `no-explicit-any`.

## 3. Variáveis de ambiente

```
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=   # embutida no build!
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-haiku-5-5
RESEND_API_KEY=
EMAIL_FROM="Política <politica@seudominio.com>"   # domínio verificado no Resend
APP_URL=https://seu-dominio.com
CRON_SECRET=                          # protege POST /api/cron/[job]
ADMIN_EMAILS=voce@email.com           # vira ADMIN no primeiro acesso (separe por vírgula)
INGEST_CRON="*/5 * * * *"             # worker confere a cada 5 min; o intervalo real vem do painel
DIGEST_CRON="0 7 * * *"  WEEKLY_DIGEST_CRON="0 7 * * 1"  MONTHLY_DIGEST_CRON="0 7 1 * *"
TZ=America/Sao_Paulo
```

## 4. Modelo de dados (Prisma) — enums e modelos

**Enums**
- `Role`: USER, ADMIN
- `Scope`: MUNICIPAL, ESTADUAL, FEDERAL
- `Branch` (poder): LEGISLATIVO, EXECUTIVO, JUDICIARIO
- `SourceCategory` (tipo de veículo): PORTAL_NACIONAL, JORNAL, REVISTA, TV, RADIO, AGENCIA_NOTICIAS, ORGAO_OFICIAL, REGIONAL, BLOG_INDEPENDENTE, OUTRO
- `NewsCategory`: ECONOMIA, SAUDE, SEGURANCA, EDUCACAO, ELEICOES, JUSTICA_CORRUPCAO, INFRAESTRUTURA, MEIO_AMBIENTE, SOCIAL, LEGISLATIVO, ADMINISTRACAO, INTERNACIONAL, OUTROS
- `PoliticianRole`: PRESIDENTE, VICE_PRESIDENTE, SENADOR, DEPUTADO_FEDERAL, GOVERNADOR, VICE_GOVERNADOR, DEPUTADO_ESTADUAL, PREFEITO, VICE_PREFEITO, VEREADOR
- `ElectionOffice`: PRESIDENTE, GOVERNADOR, SENADOR, DEPUTADO

**Modelos** (campos essenciais)
- **User**: id, `clerkId` único (convites pendentes usam `pending:<uuid>`), `email` único, `role`, name, `uf`, `municipality`, `municipalityKey` (nome normalizado), `dailyDigest` (padrão true), `weeklyDigest`, `monthlyDigest`, `alertEmails` (true), `digestTiersDaily/Weekly/Monthly` (texto "1,2,3"), timestamps. Relações: follows, favorites, alerts, digests.
- **Source** (veículo): `name` único, homepage, `category`, `categoryKnown`, `factCheck`, `tier` (Int? 1–3), `tierBy` ("default" | "ai" | "admin").
- **Article**: `url` único, title, description, imageUrl, publishedAt, `scope`, `uf`, `municipalityKey`, `category`, `branch?`, `factCheck`, `cargo?` (ElectionOffice), `poll` (bool), `clusterKey` (agrupa o mesmo assunto), `searchText` (título+descrição normalizados, sem acento), `classified` (bool), `origin` (de qual busca/feed veio), `summary`, `summaryKind` ("ai"|"meta"|"none"), `summaryAt`, `directUrl` (URL real quando a origem é Google News), `sourceId`. Índices: (scope, publishedAt desc), (scope, uf, publishedAt), (scope, uf, municipalityKey, publishedAt), (scope, branch, publishedAt), (factCheck, scope, publishedAt), (cargo, publishedAt), (poll, publishedAt), clusterKey, classified, sourceId.
- **Politician**: `externalKey` único (`camara:123`, `senado:456`, `tse:2024:SQ`, `manual:presidente`), name, ballotName, `role`, uf, municipality, municipalityKey, party, photoUrl, email, phone, profileUrl, mandate.
- **Follow** (userId+politicianId, PK composta), **Favorite** (userId+articleId, PK composta).
- **Alert** (userId, keyword? ou politicianId?, active) e **AlertMatch** (alertId+articleId único, notifiedAt).
- **DigestLog**: userId, `kind` ("daily"|"weekly"|"monthly"), `day` ("yyyy-MM-dd"); único (userId, kind, day) — evita reenvio.
- **JobRun**: job, startedAt, finishedAt, ok, info — histórico do robô.
- **FeedSource**: name único, feedUrl único, homepage, category, scope, branch?, uf?, municipality?, municipalityKey?, active, factCheck, lastOkAt, lastError, lastCount.
- **Setting**: key (PK), value — configurações do robô e marcadores internos (`seed_*`).
- **Candidate**: externalKey, name, ballotName, number, party, office, uf?, status ("2º TURNO", "ELEITO…").
- **Explanation**: key (sha1) PK, kind, text — cache das explicações da agenda.

Migrações: `prisma migrate dev` é interativo; em ambiente sem terminal interativo gere o SQL com `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_<nome>/migration.sql` e aplique com `prisma migrate deploy`. Migrações que mudam dados (ex.: reabrir classificação) são SQL `UPDATE` na própria migração. Em `generator client`, inclua `binaryTargets = ["native", "debian-openssl-3.0.x", "linux-arm64-openssl-3.0.x"]`.

## 5. Autenticação, papéis e acesso por convite

- **Clerk** com e-mail + código de verificação. No painel do Clerk: **User & authentication → Email → ligar "Sign-up with email"** (necessário para convites funcionarem) e **Access mode = Invite‑only** (fecha o cadastro público). Em produção use a instância *Production* (chaves `pk_live_`/`sk_live_`) e adicione o domínio.
- **Core 3 do Clerk**: `<SignedIn>/<SignedOut>` foram removidos (use `<Show>`); `auth()` é assíncrono; compound components como `UserButton.MenuItems` **só funcionam dentro de componente de cliente** (`"use client"`).
- `middleware.ts` usa **apenas** `clerkMiddleware()` (sem `auth.protect()`). A proteção é feita nas páginas, ações e rotas via helpers:
  - `getDbUser()` (com `React.cache`): lê a sessão; se não há usuário no banco → procura **registro pendente pelo e‑mail** (convite) e o "assume" gravando o `clerkId`; se o e‑mail está em `ADMIN_EMAILS`, cria/eleva a `ADMIN`; **qualquer outro e‑mail → redireciona para `/acesso-negado`** (acesso só por convite, mesmo que o Clerk deixe criar a conta).
  - `requireUser()` (exige UF/município; senão → `/onboarding`) e `requireAdmin()` (senão → `/`).
- Páginas públicas: `/sign-in`, `/sign-up` (só abre com `__clerk_ticket` do convite; senão volta ao login), `/acesso-negado`, `/api/health`, `/api/cron/[job]` (Bearer `CRON_SECRET`). Esconda o link "Registre‑se" do login (`appearance.elements.footerAction: { display: "none" }`).
- **Onboarding**: usuário escolhe UF e município (lista do IBGE). Ao salvar: grava, dispara a sincronização de eleitos da UF em segundo plano e **dispara a coleta de notícias** daquela cidade.
- **Cadastro de usuários pelo admin**: modo *convite por e‑mail* (Clerk `invitations.createInvitation` com `redirectUrl = APP_URL/sign-up`, e cria o registro `pending:` com o papel escolhido) ou *criar com senha provisória* (`users.createUser`). Traduza erros do Clerk (ex.: "Invitations are only supported on instances that accept email addresses" → orientar a ligar "Sign-up with email").

## 6. Pipeline de coleta de notícias (o coração do app)

Executada por `runIngest()` (job `ingest`). Passos:

1. **Origens** (`buildOrigins`):
   - **Feeds RSS** da tabela `FeedSource` ativos (semeados na 1ª execução; marcadores `Setting seed_*` evitam recriar feeds que o admin apagou). Lista inicial sugerida: G1 Política, Folha, Poder360, Metrópoles, Congresso em Foco, CartaCapital, Veja, Gazeta do Povo, O Antagonista, Revista Fórum, Agência Pública, Nexo, JOTA, ConJur, BBC Brasil, Agência Brasil, Agência Câmara, Agência Senado, STF, Planalto; depois CNN Brasil (`https://www.cnnbrasil.com.br/feed/`), Estadão (`.../arc/outboundfeeds/rss/?outputType=xml`), O Globo (`https://oglobo.globo.com/rss/oglobo`), Brasil de Fato, Terra Política, Jovem Pan, Revista Oeste, Intercept, Agência Gov; e **checagem**: Agência Lupa (`https://lupa.news/feed/`), Aos Fatos (`https://www.aosfatos.org/noticias/feed/`), Projeto Comprova (`https://projetocomprova.com.br/feed/`) com `factCheck=true`. *Confirme cada URL — feeds mudam.*
   - **Google News RSS**: `https://news.google.com/rss/search?q=<query> when:<N>d&hl=pt-BR&gl=BR&ceid=BR:pt-419`. Por **esfera × poder** (9 buscas configuráveis): federal (Câmara/Senado/Congresso; governo federal/Planalto; STF/STJ/TSE/PF), estadual por UF dos usuários (`{estado}`) e municipal por cidade dos usuários (`{cidade}`). Só rodam para UFs/cidades que têm usuário. Mais: buscas de **eleições** (nacional e por estado), buscas locais de **checagem**, e buscas por **veículos prioritários** (`site:dominio.com (...)`).
   - O título do Google News vem como `"Título - Veículo"`; extraia o veículo do sufixo/tag `<source>`.
2. **Leitura dos feeds**: `fetch` com `User-Agent` de navegador; **decodifique o charset** (lendo bytes e usando `TextDecoder` com o charset do header/XML — a Folha usa ISO‑8859‑1); remova lixo antes de `<?xml`. Filtre por idade máxima (configurável; **0 = sem limite**; janela separada para locais). Concorrência 6.
3. **Deduplicação**: por URL e por `veículo + título normalizado` (o mesmo texto chega por URLs diferentes do Google News), contra o lote e contra o banco. `clusterKey` = sha1 dos 8 tokens mais "informativos" (sem stopwords) do título, para agrupar o mesmo assunto de vários veículos.
4. **Persistência**: cria `Source` (categoria por heurística de nome + lista conhecida; os desconhecidos vão para a IA), cria `Article` com `classified=false`, `searchText`, `origin`, `branch` (sugerido pela busca de origem), `factCheck` (se a origem ou o veículo é de checagem).
5. **Classificação com IA** (`classifyPending`): lotes de **25** itens, **4 lotes em paralelo**, 3 tentativas. Entrada: título, descrição, veículo, `scopeHint`, `scopeLocked` (origens locais não mudam de esfera), `locationHint`, `branchHint`. Saída JSON (validada com `zod`): `political`, `onLocation`, `scope`, `uf`, `category`, `branch`, `cargo`, `poll`. Regras: descartar o que não é política (exceto checagens); em origem local, se `onLocation=false` (a notícia é de outro estado/cidade) → descartar; notícia vinda de feed nacional com esfera MUNICIPAL vira ESTADUAL, e ESTADUAL sem UF vira FEDERAL; **valide os enums** (a IA inventa categorias). **Fallback por regras** (regex de palavras‑chave) se não houver chave/IA. **Importante:** ao chamar o Haiku para tarefas de extração/classificação, **desative o raciocínio estendido** (`thinking: { type: "disabled" }`) — senão os tokens de raciocínio consomem o `max_tokens` e o JSON vem truncado.
6. **Tiers**: `applyTiers()` — lista curada (Tier 1: grandes nacionais, agências e fontes oficiais **federais**; Tier 2: nacionais menores/especializados, regionais fortes e oficiais **estaduais**; Tier 3: o resto, inclusive oficiais **municipais**); veículos desconhecidos recebem sugestão da IA em lotes de 60 (`tierBy="ai"`, o admin confirma/corrige; `admin` nunca é sobrescrito). Critério é **alcance e tipo — nunca qualidade ou viés político**.
7. **Retorno**: ids das notícias novas → `processAlerts()`.

**Configurações do robô** (tabela `Setting`, com defaults em código): `ingestIntervalMinutes` (padrão 60, mín. 10), `maxAgeDays`, `localMaxAgeDays`, `retentionDays` (0 = nunca apagar), `googleNews`, `aiClassify`, `aiModel`, `priorityOutlets`, as 9 `query*`, `queryElection*`, `queryFactCheck*`. Cada formulário do admin salva **só o seu grupo** de chaves (campos checkbox usam um hidden `__cb_<chave>` para distinguir "desmarcado" de "ausente"); "restaurar padrão" apaga só as chaves do grupo, nunca os marcadores `seed_*`.

**Agendamento**: `runJob(name, { scheduled })`. Execuções agendadas de `ingest` **respeitam o intervalo** (compara com o último `JobRun`, tolerância de 3 min); execuções manuais ignoram. O worker roda `node-cron` (`ingest` a cada 5 min; `digest` diário 7h; `digestWeekly` segunda 7h; `digestMonthly` dia 1 7h; `politicians` semanal; `candidates` a cada 6h; `cleanup` diário), com timezone `America/Sao_Paulo`, trava contra execução concorrente e registro em `JobRun`. Ao subir, completa dados que faltam e coleta. Jobs: `ingest`, `reclassifyElections`, `digest`, `digestWeekly`, `digestMonthly`, `politicians`, `politiciansMissing`, `candidates`, `cleanup`. CLI: `npm run job -- <job> [--scheduled]`. Rota HTTP opcional `POST /api/cron/[job]` com `Authorization: Bearer $CRON_SECRET`.

## 7. Fontes de dados externas (endpoints e armadilhas)

- **IBGE**: `https://servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/municipios` (id + nome; cache em memória 24h).
- **Câmara dos Deputados** (`https://dadosabertos.camara.leg.br/api/v2`): `/deputados?itens=100&pagina=N` (nome, partido, UF, foto, e‑mail); `/proposicoes?idDeputadoAutor=ID&itens=40&ordem=DESC&ordenarPor=id` (filtrar requerimentos `RQ/REQ/RPD/INC/REL`); `/eventos?dataInicio&dataFim&ordem=ASC&ordenarPor=dataHoraInicio` (agenda); `/votacoes?dataInicio&dataFim&itens=100&ordem=DESC&ordenarPor=dataHoraRegistro` (filtrar `siglaOrgao==="PLEN"`); `/deputados/{id}/despesas?ano=` (cota parlamentar — em testes retornou lista vazia; trate como "indisponível"). **Use sempre o header `Accept: application/json` exatamente nesse formato** (o WAF bloqueia variações).
- **Senado** (`https://legis.senado.leg.br/dadosabertos`, header `Accept: application/json`): `/senador/lista/atual` (81 senadores; `IdentificacaoParlamentar`); `/senador/{codigo}/autorias?v=7` (filtrar siglas PL, PLS, PLP, PEC, PDL, PLC, PRS; ordenar por ano/número); `/plenario/agenda/mes/{yyyymmdd}` (sessões); `/comissao/agenda/{ini}/{fim}` (reuniões); `/plenario/lista/votacao/{ini}/{fim}` (máx. 60 dias; `Resultado` "A"/"R").
- **TSE** (dados abertos): `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ANO}.zip` (2022: governador/vice/deputados estaduais eleitos; 2024: prefeito/vice/vereadores; 2026: candidatos e situação). Dentro do zip: `consulta_cand_{ANO}_{UF}.csv` e `_BR.csv`. CSV em **latin1**, separador `;`, campos entre aspas — escreva um parser próprio. Colunas úteis: `SG_UF, SG_UE, NM_UE, DS_CARGO, SQ_CANDIDATO, NR_CANDIDATO, NM_CANDIDATO, NM_URNA_CANDIDATO, SG_PARTIDO, DS_EMAIL, DS_SIT_TOT_TURNO` (eleitos começam com "ELEITO"; "2º TURNO"). Baixe o zip para o diretório temporário com cache (7 dias; 3 h para candidatos) e leia só a entrada da UF. As **fotos do TSE (divulgacandcontas) retornam 403** — use avatar com iniciais. Atenção: o TSE traz os **eleitos**, não necessariamente quem ocupa o cargo hoje (suplentes, renúncias).
- **Presidente e vice**: cadastro manual (`manual:presidente`, `manual:vice-presidente`) no código.
- **Querido Diário** (Diários Oficiais municipais): `https://api.queridodiario.ok.org.br/gazettes?territory_ids={IBGE}&size=15&sort_by=descending_date&excerpt_size=300&number_of_excerpts=3[&querystring=...]`. Em alguns ambientes a conexão TLS falha — a página deve degradar com mensagem amigável.
- **Google News — resolver o link real** (necessário para ler a matéria): o link `news.google.com/rss/articles/{id}` redireciona por JavaScript. Faça `GET https://news.google.com/rss/articles/{id}?hl=pt-BR&gl=BR&ceid=BR:pt-419`, extraia `data-n-a-sg` e `data-n-a-ts` do HTML e `POST https://news.google.com/_/DotsSplashUi/data/batchexecute` com `f.req` (RPC `Fbv4je`, payload `["garturlreq",[[...parâmetros fixos...],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"{id}",{ts},"{sg}"]`); a URL real está no JSON da resposta. É frágil: envolva em `try/catch` e caia para "sem resumo".
- **Resend**: sem domínio verificado só envia para o e‑mail do dono da conta; verifique o domínio e use `EMAIL_FROM` desse domínio.

## 8. Páginas do app (rotas)

Layout autenticado `(app)`: cabeçalho fixo (logo, navegação, pílula com "Cidade · UF" → Conta, botão **Admin** para admins, ícone de configurações, avatar do Clerk com menu: Diário Oficial, Favoritos, Alertas, Minha conta, Administração); **barra inferior no celular** (Feed, Pessoas, Agenda, Alertas, Mais); rodapé discreto.

- **`/` Feed**: cabeçalho com data, nome da localidade e "Notícias atualizadas há X min" (última coleta bem‑sucedida). Aviso "2º turno em N dias" enquanto a eleição não passou. Abas Municipal/Estadual/Federal com contagem. Faixa de **poder** (Todos/Legislativo/Executivo/Judiciário com contagens). Painel de filtros (lateral no desktop, recolhível no celular): busca, **organizar por** (Recentes/Veículo/Tipo/Categoria), **nível do veículo** (Todos/Só Tier 1/Tier 1 e 2), tipo, veículo, categoria, "só quem eu sigo"; os filtros se aplicam sozinhos ao mudar e viram "chips" removíveis. Primeiro item com imagem vira **destaque** grande. Agrupa o mesmo assunto (`clusterKey`) mostrando "também em: …". Paginação (40/página). **Os filtros ficam salvos num cookie (1 ano)** e voltam sozinhos quando a URL não traz filtros (links explícitos sempre vencem; busca e página não são salvos).
- **Cartão de notícia**: avatar do veículo (cor por hash do nome), nome, tipo, selo **T1/T2/T3**, tempo relativo, título (serifa), descrição, chips de categoria e poder, miniatura, estrela de favorito. Clicar abre a **folha de leitura**.
- **Folha de leitura** (`<dialog>`: bottom sheet no celular, centralizada no desktop): veículo/tier/data, título, e ao abrir busca `POST /api/article-summary` → **resumo por IA de 3 parágrafos (150–250 palavras)** gerado a partir do texto real da página (resolver link do Google News → baixar página com `cheerio` → extrair `<article>/<main>` parágrafos > 70 caracteres até ~14 mil caracteres → Haiku). Prompt exige fidelidade ao texto, sem opinião, 3 parágrafos: fato principal; detalhes (números, nomes, posições); consequências/próximos passos. Se o texto for curto/inacessível usa `og:description`/`meta description`; guarda `summary`, `summaryKind`, `directUrl` (cache; nova tentativa após 6 h se falhou). Mostra "Mesmo assunto em outros veículos" e o botão "Ler a matéria completa" (**no celular abre na mesma aba**; no desktop em nova aba). Nota: muitos sites proíbem iframe, por isso não use iframe. Proteja contra SSRF (só http/https, bloqueie localhost/IPs privados).
- **`/representantes`**: abas Municipal/Estadual/Federal/Seguindo; busca; seção **Executivo** em cartões de destaque (prefeito/vice, governador/vice, presidente/vice) e legisladores em grade (vereadores; deputados estaduais; senadores e deputados federais, com opção "todos os estados"). Botão Seguir. Estado vazio com "Carregar dados" (dispara a sincronização do TSE da UF).
- **`/representantes/[id]`**: capa, avatar/iniciais, partido, local, mandato, contatos, Seguir e **Receber alertas**; para deputados federais e senadores: **Projetos de autoria** (Câmara/Senado) e, para deputados, **Gastos** (cota parlamentar) — carregados sob demanda com `Suspense`; depois "Nas notícias" (artigos que citam o nome).
- **`/agenda`**: abas de esfera. **Federal**: sessões e reuniões da Câmara e do Senado nos próximos 10 dias (filtro Câmara/Senado), coluna de **votações recentes** das duas casas (aprovada/rejeitada). Cada evento/votação tem **"Saiba mais"** recolhido que busca, sob demanda (`POST /api/explain`), uma explicação em linguagem simples gerada por IA e **guardada em cache** (tabela `Explanation`, chave sha1). **Estadual/Municipal**: não há agenda oficial aberta — mostre notícias legislativas locais sobre sessões/pautas/votações, com aviso explícito.
- **`/eleicoes`**: contagem regressiva para o 2º turno; abas por cargo (Geral, Presidente, Governador, Senado, Deputados — governador/senado/deputados só do estado do usuário); filtro de nível dos veículos; **candidatos** (da tabela `Candidate`, atualizada a cada 6 h do arquivo do TSE 2026); **pesquisas eleitorais** (artigos com `poll=true`); notícias do cargo; **checagens eleitorais**; calendário; "como votar".
- **`/checagens`**: abas de esfera; artigos com `factCheck=true` (feeds de agências + buscas locais).
- **`/diario-oficial`**: edições do município (Querido Diário) com trechos e busca.
- **`/favoritos`**, **`/alertas`** (criar por palavra‑chave; pausar/excluir; alertas de políticos vêm da página do político), **`/configuracoes`** (e‑mails: resumo diário, semanal, mensal — cada um com seletor de **tiers considerados** —, alertas, botões "enviar teste" por período, localização), **`/mais`** (menu do celular), **`/onboarding`**, **`/sign-in`**, **`/sign-up`**, **`/acesso-negado`**.
- **Rotas de API**: `/api/health`, `/api/municipios?uf=`, `/api/explain`, `/api/article-summary`, `/api/cron/[job]` — todas (exceto health/cron) exigem sessão.

## 9. Seguir, favoritos, alertas

- **Seguir** político (pílula "Seguindo"); no feed, "só quem eu sigo" filtra `searchText` pelos nomes (normalizados) dos seguidos.
- **Favoritar** notícia (nunca apagada pela limpeza).
- **Alertas**: após cada coleta, cruza os artigos novos com alertas ativos (palavra‑chave ou nome/ nome de urna do político — mínimo 5 caracteres normalizados); notícias locais só interessam a quem mora lá. Grava `AlertMatch` e envia **um e‑mail por usuário** (até 20 itens), marcando `notifiedAt`. Respeita `alertEmails`.

## 10. Resumos por e-mail (diário, semanal, mensal)

Por usuário e período, com `DigestLog (userId, kind, day)` para não duplicar. Conteúdo: introdução do período; **Município**, **Estado**, **Federal** (até 5/7/9 assuntos, priorizando os cobertos por mais veículos com bônus para Tier 1/2, e um parágrafo de resumo por IA em cada); **No Congresso** (votações do período da Câmara e do Senado com selo aprovada/rejeitada + resumo por IA, e próximas sessões deliberativas); **Quem você segue**; **Checagem de fatos**; botões "Abrir o feed" e "Ver a agenda". Cada usuário escolhe os **tiers** (1/2/3) considerados em cada período (veículo sem tier conta como Tier 3). Assunto com emoji (🗞️ diário, 📅 semanal, 🗓️ mensal). Cache de blocos entre usuários com a mesma localidade e os mesmos tiers. Botões de teste em Configurações.

## 11. Administração (`/admin`, só ADMIN)

Layout com **menu lateral agrupado** (no celular, abas roláveis) e selos de pendência. Cada página reconfere `requireAdmin()`.

- **Visão geral**: última e próxima coleta, notícias das últimas 24 h por esfera, usuários; lista "Precisa de atenção" (feeds com erro, sugestões de tier pendentes, convites pendentes, notícias sem classificação) com links; checagem de ambiente (Anthropic, Resend, Clerk, CRON_SECRET); botão "Coletar agora"; execuções recentes.
- **Usuários**: cadastrar (convite ou senha provisória, escolhendo o papel), listar, promover/rebaixar, excluir (remove também no Clerk; não permite excluir a si mesmo nem o último admin) com confirmação.
- **Feeds RSS**: lista com filtro (Todos/Com erro/Pausados), status da última coleta, pausar/excluir; formulário "Testar e adicionar" (valida o feed antes de salvar; esfera, poder, tipo, UF/município).
- **Veículos e tiers**: cartões por tier (filtram a lista), busca, filtro por tier, **ordenação** (mais notícias, Tier 1→3, 3→1, não revisados, nome), seletor por veículo, **edição em massa** (marcar vários / selecionar todos → aplicar tier ou confirmar sugestões da IA; confirmar todas com diálogo), "mostrar mais".
- **Buscas**: as 9 buscas por esfera×poder, veículos prioritários, buscas de eleições e de checagens locais; salvar/restaurar por grupo; barra de ação fixa.
- **Robô**: ações agrupadas (Notícias, Dados políticos, E‑mails, Manutenção) com data/resultado da última execução de cada; **parâmetros** (intervalo, idades máximas, retenção, modelo, Google News on/off, IA on/off); histórico de execuções.

## 12. Design system e UX

- **Direção visual**: editorial, "civic": fundo "papel" quente, títulos em **Fraunces** (serifa) e texto em **Geist**; um azul profundo como cor de marca e dourado como detalhe; cores por esfera (verde = municipal, âmbar = estadual, índigo = federal).
- **Tokens (CSS variables em `:root`, redefinidos em `@media (prefers-color-scheme: dark)`)**: `--paper #f5f2ec`, `--surface #fff`, `--ink #14181f`, `--muted #5f6672`, `--line #e6e1d7`, `--brand #17407f`, `--gold #e9b320`, `--municipal #0e8a5f`, `--estadual #b86e00`, `--federal #3b5bdb`, mais versões suaves (`*-soft`) e equivalentes escuros. Mapeie para utilitários Tailwind com `@theme inline` (ex.: `bg-paper`, `text-ink`, `border-line`).
- **Armadilha do Tailwind 4**: variáveis declaradas com `@theme inline` **não são emitidas** como CSS custom properties; em CSS escrito à mão use os nomes das variáveis do `next/font` diretamente (`var(--font-fraunces)`, `var(--font-geist-sans)`), não os do tema.
- **Componentes base** (classes em `@layer components`): `.card`, `.card-flat`, `.input` (com seta própria em `select`), `.btn` + `.btn-primary/secondary/ghost/danger/sm`, `.chip`, `.eyebrow`, `.display`, `.skeleton`. Animação de entrada curta (≈0,2 s, sem atraso escalonado). `scroll-behavior: smooth`.
- **Padrões**: abas em "pílulas", estados vazios com ilustração e ação, skeletons de carregamento (`loading.tsx`), botões de envio com **spinner** (`useFormStatus`) em toda ação lenta, `ConfirmButton` (`window.confirm`) em ações destrutivas, toggles acessíveis (checkbox `sr-only` + `peer`), formulários GET que se auto‑enviam ao mudar filtros (debounce de 600 ms para texto), `<details>` para "Saiba mais"/filtros no celular.
- **Mobile**: barra inferior fixa com `safe-area-inset-bottom`; filtros recolhíveis; cartões em coluna única; folha de leitura como *bottom sheet*; menu "Mais". **Desktop**: feed em duas colunas (lista + painel de filtros "sticky"); navegação do topo enxuta (Feed, Representantes, Agenda, Eleições, Checagens).
- **Texto**: pt‑BR, tom neutro; datas relativas ("há 12 min") e absolutas no fuso `America/Sao_Paulo`.

## 13. Deploy (VPS com Coolify)

- Um **`Dockerfile`** multi‑stage (`node:22-bookworm-slim`, instala `openssl ca-certificates wget`): `deps` (`npm ci`), `build` (recebe `ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e as `SIGN_IN/UP_URL`, roda `npm run build`), `runtime` (copia tudo; `CMD sh -c "npx prisma migrate deploy && npm start"`). Não use `output: "standalone"` (o Prisma CLI e o `tsx` precisam na imagem). O mesmo container serve o site e roda os jobs (`npm run job -- …`).
- No Coolify: criar **PostgreSQL** (recurso à parte) e uma **Application** apontando para o repositório com *Build Pack = Dockerfile*; **Ports Exposes = 3000**; em **Domains** colocar `https://seu-dominio.com` (sem domínio configurado o proxy Traefik responde "404 page not found"); em *Environment Variables* todas as chaves (a `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` marcada como **build variable**); *Healthcheck* em `/api/health`.
- **Agendamento em produção**: *Scheduled Tasks* do Coolify executando comandos no container: `*/10 * * * *` → `npm run job -- ingest --scheduled`; `0 10 * * *` → `npm run job -- digest`; `0 10 * * 1` → `npm run job -- digestWeekly`; `0 10 1 * *` → `npm run job -- digestMonthly`; `0 4 * * 0` → `npm run job -- politicians`; `0 */6 * * *` → `npm run job -- candidates`; `30 3 * * *` → `npm run job -- cleanup` (horários em UTC; 10 h UTC = 7 h de Brasília). Alternativa: um segundo serviço rodando `npm run worker`. Rode `npm run job -- politicians` e `candidates` uma vez após o 1º deploy.
- Local: Postgres via Docker (`docker-compose.dev.yml`) ou instalado; `npm run dev` + `npm run worker`.
- Backups do Postgres (histórico de notícias é o ativo principal).

## 14. Armadilhas conhecidas (aprendidas na prática)

1. **Prisma em dev**: após mudar o schema e gerar o client, o servidor `next dev` e o worker continuam com o client antigo em memória → reinicie ambos (sintoma: `PrismaClientValidationError` em campos novos).
2. **Fuso**: o Prisma grava timestamps em UTC; ao comparar com `now()` do SQL local há deslocamento. Use datas do app.
3. **Haiku + raciocínio**: desative o *thinking* nas chamadas de extração, ou o JSON sai truncado.
4. **Feeds quebrados**: charset (ISO‑8859‑1), texto antes do `<?xml`, `User-Agent` obrigatório, 403 em alguns (ConJur). Nunca deixe um feed ruim derrubar a coleta; guarde `lastError`/`lastCount`.
5. **Google News**: mesma matéria com várias URLs → deduplique por veículo+título; o link só é utilizável depois de resolvido.
6. **Clerk**: `Show` em vez de `SignedIn`; `UserButton.MenuItems` em componente de cliente; instância sem "Sign-up with email" não aceita convites; use *Access mode = Invite‑only*; `auth.protect()` no middleware responde 404 para não logados → proteja nas páginas.
7. **Next**: `<dialog>` precisa de `inset-0 m-auto h-fit` para centralizar em `fixed`; `useFormStatus` só funciona dentro do `<form>`; layouts não re‑executam em toda navegação → reconfira permissões em cada página/ação.
8. **Classificação**: enums inventados pela IA → valide; notícia "sobre outro estado" aparece no feed errado → use `locationHint` + `onLocation`; deduplicar clusters evita repetição visual.
9. **Dados do TSE**: o CSV usa latin1 e `;`; fotos bloqueadas; "eleito" ≠ "em exercício".
10. **Configurações em páginas diferentes**: nunca salve campos ausentes como vazios (use salvamento parcial por grupo) e nunca "restaure padrão" apagando a tabela inteira.
11. **Deploy**: sem domínio no Coolify → 404 do Traefik; `NEXT_PUBLIC_*` só vale se estiver disponível **no build**; e‑mail do Resend só chega a terceiros com domínio verificado.
12. **Páginas que chamam APIs externas** (Câmara/Senado/Querido Diário): sempre com timeout, cache (`next: { revalidate }`) e mensagem amigável quando cair.

## 15. Segurança e privacidade

Sessão verificada em toda ação/rota; papel ADMIN conferido no servidor; chaves só em variáveis de ambiente; leitura de páginas externas apenas por `id` do artigo (não aceite URL do cliente) e com bloqueio de hosts privados; sem armazenar o texto integral das matérias — guarde título, trecho/descrição, link e **resumo próprio**; mostre a origem e aviso de "gerado por IA"; cookie de filtros só com preferências (sem dados pessoais); e‑mails com link para gerenciar preferências.

## 16. Plano de construção em fases (com critério de aceite)

0. **Preparação**: contas/chaves, Postgres local, projeto Next 15 + Tailwind 4, dependências, `.env`, `.gitignore` (ignora `.env*`, exceto `.env.example`), tokens/CSS base, fontes. *Aceite:* `npm run dev` abre uma página com o tema.
1. **Banco e login**: schema completo (ou por etapas), migração inicial, Clerk (middleware simples, `getDbUser/requireUser/requireAdmin`, `/sign-in`, `/sign-up` por convite, `/acesso-negado`, `ADMIN_EMAILS`), **onboarding** (UF/município via IBGE). *Aceite:* entro com meu e‑mail (admin), escolho a cidade, e um e‑mail não cadastrado cai em "acesso negado".
2. **Coleta e classificação**: `FeedSource` + sementes, `ingest` (RSS + Google News por esfera/poder), dedupe, classificação com Haiku (+fallback), fontes/categorias de veículo, `JobRun`, worker com cron, CLI `npm run job`. *Aceite:* `npm run job -- ingest` popula artigos classificados por esfera/poder/categoria.
3. **Feed e folha de leitura**: layout, navegação, feed com abas/filtros/agrupamento/destaque/paginação, cookie de filtros, cartões, favoritos, "atualizado há X", folha com resumo por IA (resolução do Google News + extração + cache). *Aceite:* filtros funcionam no celular e no desktop; abrir matéria mostra resumo de 3 parágrafos.
4. **Representantes**: sincronização Câmara/Senado/TSE, páginas de lista e perfil, seguir, projetos e gastos. *Aceite:* meus prefeito/vereadores/governador/deputados/senadores aparecem.
5. **Alertas e resumos por e‑mail**: alertas, `DigestLog`, diário/semanal/mensal com votações, preferências e seletor de tiers, botões de teste. *Aceite:* recebo um e‑mail de teste de cada período.
6. **Agenda, Eleições, Checagens, Diário Oficial**: conforme a seção 8 (com cache de explicações). *Aceite:* cada página carrega com dados reais ou mensagem amigável quando a fonte cai.
7. **Tiers**: campos, curadoria + IA, selo no cartão, filtros (feed/eleições), uso nos resumos. 
8. **Admin**: layout lateral, visão geral, usuários (convite), feeds, veículos/tiers em massa, buscas, robô, confirmações.
9. **Design polish**: revisão mobile/desktop/escuro, estados vazios, skeletons, spinners, acessibilidade, animações curtas.
10. **Deploy**: Dockerfile, Coolify (banco, app, domínio, variáveis, healthcheck, tarefas agendadas), Clerk de produção (Invite‑only), Resend com domínio verificado, backup. *Aceite:* site no domínio, coleta rodando sozinha e e‑mail chegando.

Cada fase termina com `npm run typecheck` e `npm run lint` sem erros e um commit.

## 17. Perguntas iniciais que o Claude deve fazer ao usuário

1. Sistema operacional, versão do Node e como vai rodar o Postgres (Docker, instalado, serviço gerenciado)?
2. Domínio final e onde hospedar (VPS com Coolify? outra opção — se for outra, adapte a seção 13)?
3. Estado e cidade para testes e quais outras cidades/estados terão usuários.
4. Já tem Clerk, Anthropic e Resend (com domínio verificado)? Qual o e‑mail do administrador?
5. Se há eleição em curso: quais cargos e datas (ajuste `ELECTION` e o arquivo `consulta_cand_{ano}` do TSE)?
6. Quer manter todos os módulos ou começar pelo núcleo (feed + representantes) e adicionar o resto depois?
7. Quais veículos são prioritários (domínios) e quais feeds regionais da sua cidade devem entrar?
