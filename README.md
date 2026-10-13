# Política

Feed de notícias políticas (municipal, estadual, federal) + diretório de representantes, com login Clerk.

**Stack:** Next.js 15 · Clerk · PostgreSQL + Prisma · Claude Haiku (classificação/resumos) · Resend (e-mails) · worker `node-cron`.

## O que tem

- **Feed** com abas Municipal / Estadual / Federal, filtros por **veículo**, **tipo de veículo** (portal, jornal, TV, rádio, revista, agência, órgão oficial…) e **categoria da notícia** (economia, saúde, segurança…), busca, "quem eu sigo" e agrupamento por veículo/tipo/categoria. O mesmo assunto publicado por vários veículos aparece agrupado ("Também em: …").
- **Robô** (container `worker`): a cada hora lê ~20 feeds RSS nacionais + Google News (por estado e por município dos usuários cadastrados), deduplica, classifica com Claude Haiku e descarta o que não é política.
- **Representantes:** prefeito, vice e vereadores; governador, vice e deputados estaduais; presidente, vice, senadores e deputados federais. Fontes: API da Câmara, API do Senado e dados abertos do TSE (eleitos 2022 e 2024).
- **Seguir** políticos, **favoritar** notícias, **alertas** por palavra-chave/político (e-mail, a cada hora) e **resumo diário** às 7h (e-mail via Resend, resumo escrito pelo Haiku).

## Administração e papéis

Dois papéis: **USER** e **ADMIN**. Defina `ADMIN_EMAILS` (vírgula) no ambiente: quem entrar com esses e-mails vira admin automaticamente (é assim que nasce o primeiro admin). Admins têm o menu **Admin**:

- **Usuários:** cadastrar por *convite por e-mail* (Clerk envia; o papel escolhido já fica reservado) ou *criar com senha provisória*; promover/rebaixar; excluir (remove também no Clerk). Não é possível excluir/rebaixar a si mesmo nem remover o último admin.
- **Robô:** botões para rodar coleta, resumo, atualização de representantes e limpeza; histórico das execuções.

## Rodando localmente

```bash
cp .env.example .env            # preencha as chaves do Clerk (e Anthropic/Resend se quiser)
docker compose -f docker-compose.dev.yml up -d   # ou use um Postgres local
npm install
npx prisma migrate deploy
npm run dev                      # site em http://localhost:3000
npm run worker                   # robô (em outro terminal)
npm run job -- ingest            # roda uma coleta agora (também: digest, politicians, cleanup)
```

Sem `ANTHROPIC_API_KEY` a classificação cai para regras por palavra-chave; sem `RESEND_API_KEY` os e-mails só são logados.

## Clerk

Crie uma aplicação em clerk.com, copie `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY`. Em produção, adicione o domínio do app em *Domains* e use as chaves de produção (`pk_live_…`).

## Deploy no Coolify (VPS Hostinger)

1. No Coolify: **New Resource → Docker Compose** apontando para este repositório (`docker-compose.yml`).
2. Em *Environment Variables* preencha: `POSTGRES_PASSWORD`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (marque como *Build Variable*), `CLERK_SECRET_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM` (domínio verificado no Resend), `APP_URL` (https do seu domínio), `CRON_SECRET`, `ADMIN_EMAILS`.
3. Em *Domains* do serviço **web**, informe seu domínio com a porta `3000`.
4. Deploy. O `web` aplica as migrações; o `worker` sobe junto e já faz a primeira coleta.

Alternativa ao worker: um *Scheduled Task* do Coolify chamando
`curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://SEU_DOMINIO/api/cron/ingest` (jobs: `ingest`, `digest`, `politicians`, `cleanup`).

Se preferir o Postgres gerenciado do Coolify, remova o serviço `db` do compose e defina `DATABASE_URL` com a URL interna dele.

## Observações

- Representantes vêm do TSE (**eleitos**, 2022/2024): não refletem suplentes que assumiram, renúncias ou troca de partido. Câmara e Senado são de quem está em exercício. Presidente/vice estão fixos em `src/lib/politicians/federal.ts` (`syncPresidencia`).
- Os dados de uma UF são baixados do TSE quando o primeiro usuário daquela UF se cadastra (~30 s) e atualizados semanalmente.
- Notícias com mais de 90 dias são apagadas, exceto as favoritadas.
- Notícias vêm de feeds RSS públicos e do Google News (links levam ao site do veículo); o app guarda só título, trecho e link.
