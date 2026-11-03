# Segurança do projeto

## O que está em vigor
- **Autenticação:** Clerk. Toda página usa `requireUser`/`requireAdmin`; toda rota de API usa `auth()`; toda server action chama `getDbUser`/`requireAdmin`. As únicas rotas públicas são `/api/health` e `/api/cron/*` (esta exige `Authorization: Bearer $CRON_SECRET`, comparado em tempo constante e com limite de tentativas).
- **Autorização:** ações de administração só com `requireAdmin`; dados do usuário sempre filtrados por `userId` (sem IDs de outros usuários aceitos de fora).
- **Banco:** Prisma com consultas parametrizadas; não há SQL cru com entrada do usuário.
- **Requisições do servidor para fora (SSRF):** `src/lib/safe-url.ts` só permite http(s) em sites públicos (bloqueia loopback, redes privadas, link-local, metadados de nuvem, credenciais na URL e portas fora de 80/443), confere o DNS e cada redirecionamento. Usado na leitura de artigos e no teste/cadastro de feeds.
- **Cabeçalhos:** `next.config.ts` define HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e uma CSP que fecha clickjacking, `<base>`, formulários externos e plugins. Respostas de `/api/*` não são cacheadas. `X-Powered-By` desligado.
- **Limites de uso:** `src/lib/rate-limit.ts` (por usuário/IP, em memória do processo) em IA, resumos, municípios, indicadores, CSV, cron e e-mail de teste.
- **CSV:** campos que começam com `= + @` recebem apóstrofo (evita injeção de fórmula no Excel).
- **Container:** a imagem roda como usuário `node`, não como root.
- **Segredos:** `.env*` está no `.gitignore` (só `.env.example`, sem valores). Nunca registre chaves em logs.

## Regras ao desenvolver
1. Rota nova ⇒ `auth()` no começo e `allow(...)` se for cara (IA, rede externa, CSV).
2. Qualquer `fetch` a uma URL que veio de fora (feed, notícia, formulário) usa `safeFetch`.
3. Server action nova ⇒ `getDbUser()`/`requireAdmin()` antes de qualquer leitura ou escrita; valide o tamanho e o formato do que chega.
4. Nunca use `dangerouslySetInnerHTML` com texto de terceiros (notícias, feeds).
5. Rode `npm audit --omit=dev` antes de publicar e atualize o que for crítico.

## Pontos conhecidos e decisões
- A CSP não restringe `script-src` porque o Clerk e o Next injetam scripts; endurecer isso exigiria nonces por requisição.
- O limite de uso é por instância; se houver várias réplicas, use um armazenamento compartilhado (Redis).
- `prisma` (CLI) tem um aviso de `deepmerge-ts` que só se corrige subindo para o Prisma 7 (mudança grande). O CLI só roda no build e no `migrate deploy`, com entrada confiável.
