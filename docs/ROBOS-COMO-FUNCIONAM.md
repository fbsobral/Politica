# Como funcionam os "robôs" do app Política (guia para reaproveitar em outro projeto)

Os "robôs" são **rotinas em segundo plano** (jobs) que rodam sozinhas: coletar notícias, classificar com IA, atualizar dados públicos, mandar e-mails. Este guia explica a arquitetura e traz **esqueletos de código genéricos** que você pode copiar para qualquer projeto Next.js + Prisma + Postgres.

---

## 1. Visão geral (as 6 peças)

```
                ┌──────────────────────────────────────────────┐
  Admin (UI) ──▶│ 6. Settings (tabela no banco, editável)      │
                └──────────────────────────────────────────────┘
                                   │ lidas pelos jobs
┌───────────────┐   dispara   ┌────┴────────────┐  spawn   ┌──────────────────┐
│ 2. Scheduler  │────────────▶│ 3. Job runner   │─────────▶│ processo filho   │
│ (node-cron no │             │ (processo       │          │ tsx job.ts <nome>│
│  próprio site)│             │  separado)      │          └────────┬─────────┘
└───────────────┘             └─────────────────┘                   │
  ▲ sinal de vida (ping)                                            ▼
  │                                              ┌──────────────────────────────┐
  └──────────── Admin "Visão geral"              │ 1. Registro de jobs (JOBS)   │
                                                 │    runJob(): trava + log     │
                                                 └───────┬──────────────────────┘
                                                         ▼
                                          4. Pipelines (coleta → dedupe →
                                             IA → grava)   5. Uso de IA (log, orçamento)
```

1. **Registro de jobs + `runJob`**: um objeto `JOBS = { nome: função }`; `runJob(nome)` põe trava (não roda 2× junto), grava início/fim/resultado numa tabela `JobRun`.
2. **Scheduler**: `node-cron` dentro do próprio servidor do site (iniciado pelo `instrumentation.ts` do Next). Não precisa de worker nem de cron externo.
3. **Job runner**: executa cada job num **processo filho** (`tsx`), para a coleta pesada não travar as páginas.
4. **Pipelines**: o conteúdo dos jobs (coletar → deduplicar → classificar → gravar).
5. **Camada de IA**: uma função `ask()` que registra tokens, respeita orçamento diário e desliga o "thinking".
6. **Settings no banco**: parâmetros (intervalos, queries, modelo) editáveis por uma tela de admin, sem redeploy.

Outras formas de disparar o mesmo job: **CLI** (`npm run job -- ingest`), **botão no admin** e **rota HTTP** protegida por segredo.

---

## 2. Banco (Prisma) — o mínimo

```prisma
model JobRun {            // histórico de execuções
  id         String    @id @default(cuid())
  job        String
  startedAt  DateTime  @default(now())
  finishedAt DateTime?
  ok         Boolean   @default(false)
  info       String?               // JSON do resultado ou mensagem de erro
  @@index([job, startedAt(sort: Desc)])
}

model Setting {           // configuração editável + sinais internos
  key   String @id
  value String
}

model AiUsage {           // consumo de IA, para painel e orçamento
  id           String   @id @default(cuid())
  at           DateTime @default(now())
  kind         String
  model        String
  inputTokens  Int
  outputTokens Int
  cachedTokens Int      @default(0)
  @@index([at])
}
```

Migrações sem terminal interativo: `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<ts>_<nome>/migration.sql` e depois `prisma migrate deploy`.

---

## 3. Registro de jobs e `runJob` (`src/lib/jobs.ts`)

Ideia: **todo job é uma função assíncrona que devolve um objeto-resumo**. O wrapper cuida do resto.

```ts
import { db } from "@/lib/db";

export const JOBS = {
  async ingest()        { return await runIngest(); },        // coleta + classifica
  async classifyBacklog() { /* classifica o que sobrou */ return { classified: 0 }; },
  digest:  () => sendDigests("daily"),
  async cleanup()       { /* apaga dados antigos */ return { deleted: 0 }; },
};
export type JobName = keyof typeof JOBS;

const running = new Set<string>();   // trava por processo

/** Sinal de vida: o admin usa para avisar "o agendador parou". */
export async function pingScheduler() {
  const now = new Date().toISOString();
  await db.setting.upsert({ where: { key: "schedulerPing" }, create: { key: "schedulerPing", value: now }, update: { value: now } }).catch(() => {});
}

/** Minutos até a próxima coleta (0 = já está na hora). Intervalo vem do painel. */
export async function minutesUntilIngest() {
  const minutes = Math.min(1440, Math.max(10, Number(await getSetting("ingestIntervalMinutes")) || 60));
  const last = await db.jobRun.findFirst({ where: { job: "ingest" }, orderBy: { startedAt: "desc" } });
  if (!last) return 0;
  const left = minutes - (Date.now() - last.startedAt.getTime()) / 60000;
  return left <= 3 ? 0 : Math.round(left);          // tolerância: crons disparam em minutos "redondos"
}

/** scheduled=true: veio de um agendador → respeita o intervalo. Manual (botão/CLI) ignora. */
export async function runJob(name: JobName, opts: { scheduled?: boolean } = {}) {
  if (opts.scheduled && name === "ingest") await pingScheduler();
  if (running.has(name)) return { skipped: "já em execução" };
  if (opts.scheduled && name === "ingest" && (await minutesUntilIngest()) > 0) return { skipped: "ainda não é hora" };

  running.add(name);
  const run = await db.jobRun.create({ data: { job: name } });
  try {
    const result = await JOBS[name]();
    await db.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), ok: true, info: JSON.stringify(result) } });
    return result;
  } catch (err) {
    await db.jobRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), ok: false, info: (err as Error).message } });
    throw err;
  } finally {
    running.delete(name);
  }
}
```

**Por quê assim:** o `JobRun` vira o "diário de bordo" (aparece no admin); a trava evita duas coletas simultâneas; `info` guarda o resumo (ex.: `{ created: 87, classified: 80 }`), ótimo para depurar.

---

## 4. CLI (`src/worker/job.ts`)

```ts
import { JOBS, runJob, type JobName } from "@/lib/jobs";
const name = process.argv[2] as JobName;
const scheduled = process.argv.includes("--scheduled");
if (!name || !(name in JOBS)) { console.error(`Uso: npm run job -- <${Object.keys(JOBS).join("|")}> [--scheduled]`); process.exit(1); }
runJob(name, { scheduled }).then(() => process.exit(0)).catch(() => process.exit(1));
```

`package.json`: `"job": "tsx src/worker/job.ts"` e `tsx` em **dependencies** (a imagem de produção precisa dele). Uso: `npm run job -- ingest`.

---

## 5. Job runner em processo separado (`src/lib/job-runner.ts`)

Coleta e classificação consomem CPU; no mesmo processo do site, as páginas ficam lentas. Solução: rodar cada job num **processo filho**.

```ts
import { spawn } from "node:child_process";
import { join } from "node:path";
import { runJob, type JobName } from "@/lib/jobs";

const running = new Map<string, Promise<void>>();

export function runJobDetached(name: JobName, opts: { scheduled?: boolean } = {}): Promise<void> {
  const existing = running.get(name);
  if (existing) return existing;                                    // nunca 2× o mesmo job
  const tsx = join(process.cwd(), "node_modules", ".bin", "tsx");
  const args = ["src/worker/job.ts", name, ...(opts.scheduled ? ["--scheduled"] : [])];
  const p = new Promise<void>((resolve) => {
    const child = spawn(tsx, args, { cwd: process.cwd(), env: process.env, stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", () => runJob(name, opts).catch(() => {}).finally(resolve)); // fallback: roda aqui mesmo
    child.on("exit", () => resolve());
  }).finally(() => running.delete(name));
  running.set(name, p);
  return p;
}
```

`stdio: "inherit"` faz os logs do filho aparecerem nos logs do container.

---

## 6. Scheduler embutido no site (`src/lib/scheduler.ts` + `src/instrumentation.ts`)

```ts
// src/lib/scheduler.ts
import cron from "node-cron";
const tz = process.env.TZ || "America/Sao_Paulo";
const g = globalThis as unknown as { __sched?: boolean };

export function startScheduler(opts: { bootDelayMs?: number } = {}) {
  if (g.__sched) return; g.__sched = true;                          // não duplica (HMR, chamadas repetidas)

  // coleta: confere a cada 5 min, mas só abre processo se já está na hora (intervalo do painel)
  cron.schedule("*/5 * * * *", async () => {
    await pingScheduler();
    if ((await minutesUntilIngest()) === 0) await runJobDetached("ingest", { scheduled: true });
  }, { timezone: tz });

  cron.schedule("0 7 * * *", () => runJobDetached("digest"), { timezone: tz });
  cron.schedule("30 3 * * *", () => runJobDetached("cleanup"), { timezone: tz });

  // fila: se sobrou item sem processar, termina sem esperar a próxima coleta
  cron.schedule("2-59/5 * * * *", async () => {
    if ((await db.article.count({ where: { classified: false } })) > 0) await runJobDetached("classifyBacklog");
  }, { timezone: tz });

  setTimeout(async () => {                                          // ao subir
    await pingScheduler();
    if ((await minutesUntilIngest()) === 0) await runJobDetached("ingest", { scheduled: true });
  }, opts.bootDelayMs ?? 0);
}
```

```ts
// src/instrumentation.ts  (Next 15; na raiz de src/)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production" && process.env.EMBEDDED_WORKER !== "0") {
    const { startScheduler } = await import("./lib/scheduler");   // import DENTRO do if (senão o build "edge" tenta empacotar libs de Node)
    startScheduler({ bootDelayMs: 30_000 });
  }
}
```

**Padrão importante — "recuperar envio perdido":** para e-mails que têm hora marcada (resumo das 7h), não confie só no cron das 7h (um deploy às 7h derruba o envio). Adicione um cron a cada 5 min que, **depois das 7h**, procura usuários sem envio hoje e dispara o job (com limite de 3 tentativas/dia). O job é idempotente (ver §9).

Alternativas ao scheduler embutido (se preferir): *Scheduled Tasks* do Coolify chamando `npm run job -- ingest --scheduled`; um serviço `worker` rodando `npm run worker`; ou `POST /api/cron/<job>` com `Authorization: Bearer $CRON_SECRET`.

---

## 7. Settings editáveis no banco (`src/lib/settings.ts`)

```ts
export const SETTING_DEFAULTS = { ingestIntervalMinutes: "60", maxAgeDays: "0", aiModel: "", aiDailyTokenBudget: "0", /* queries... */ } as const;
export async function getSettings() {
  const rows = await db.setting.findMany();
  const out: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in out && r.value !== "") out[r.key] = r.value;
  return out as Record<keyof typeof SETTING_DEFAULTS, string>;
}
```

Regras que evitam dor de cabeça:
- **Defaults no código**, overrides no banco (se a chave não existe, vale o default).
- **Salvar só o que veio no formulário** (cada página do admin edita um grupo). Para checkbox, use um hidden `__cb_<chave>` para distinguir "desmarcado" de "ausente".
- **"Restaurar padrão"** apaga só as chaves do grupo — nunca a tabela inteira (ela também guarda sinais internos como `schedulerPing`, `seed_*`).
- Valide e limite números (mín./máx.) no servidor.

---

## 8. Pipeline de coleta (o job `ingest`)

Padrão em 7 passos (vale para qualquer "coletar de várias fontes → limpar → enriquecer com IA → guardar"):

1. **Montar as origens**: lista de feeds RSS (tabela no banco, editável) + buscas parametrizadas (ex.: Google News RSS por esfera/cidade, a partir das localidades dos usuários) + buscas por veículo (`site:dominio.com …`).
2. **Buscar em paralelo com limite** (`mapLimit(origens, 6, fetchOrigin)`): `fetch` com `User-Agent` de navegador, timeout, **decodificar o charset** (alguns feeds são ISO-8859-1: leia bytes e use `TextDecoder`), tolerar lixo antes do `<?xml`. Falha de uma origem **não derruba** as outras (guarde `lastError`/`lastCount` por feed).
3. **Filtrar por idade** (configurável; 0 = sem limite).
4. **Deduplicar**: por URL e por `veículo + título normalizado` (a mesma matéria chega por URLs diferentes), no lote e contra o banco. Calcule um `clusterKey` (hash dos tokens principais do título) para agrupar o "mesmo assunto".
5. **Pular o que já foi rejeitado**: tabela `RejectedCluster` (assuntos que a IA julgou "não é do nosso tema") evita salvar e reclassificar de novo.
6. **Salvar como "não classificado"** (`classified=false`) e **classificar em lote** (§10).
7. **Pós-processamento**: categoria/tier de veículos novos, alertas, etc. Devolver um resumo `{ fetched, created, classified, removed }`.

**Reaproveitamento antes de gastar IA** (economiza ~metade): se já existe artigo classificado com o mesmo `clusterKey` (e mesmo contexto), copie a classificação; dentro do lote, classifique um representante por grupo e replique.

---

## 9. Idempotência e "claim" antes de agir (e-mails, cobranças, avisos)

Qualquer job que **envia algo** deve ser seguro para rodar 2×:

```ts
// tabela com chave única (userId, kind, day)
const claim = await db.digestLog.createMany({ data: [{ userId, kind, day }], skipDuplicates: true });
if (claim.count === 0) continue;                 // outro processo já reservou/enviou hoje
try {
  const ok = await sendEmail(...);
  if (!ok) await db.digestLog.deleteMany({ where: { userId, kind, day } });   // falhou: libera para tentar depois
} catch { await db.digestLog.deleteMany({ where: { userId, kind, day } }); }
```

Reserve **antes** de enviar (a restrição de unicidade resolve a corrida entre processos) e **libere** se falhar. Guarde os motivos de falha no `info` do `JobRun`.

---

## 10. Camada de IA (`src/lib/ai.ts`) e como gastar pouco

```ts
export async function ask(system: string, user: string, maxTokens = 4000, kind = "other", cacheSystem = false) {
  await assertBudget();                                   // lança BudgetError se passou do orçamento diário
  const res = await getClient().messages.create({
    model: getModel(), max_tokens: maxTokens,
    thinking: { type: "disabled" },                       // extração/classificação: sem raciocínio estendido
    system: cacheSystem ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] : system,
    messages: [{ role: "user", content: user }],
  });
  db.aiUsage.create({ data: { kind, model: getModel(), inputTokens: res.usage.input_tokens + (res.usage.cache_creation_input_tokens ?? 0), outputTokens: res.usage.output_tokens, cachedTokens: res.usage.cache_read_input_tokens ?? 0 } }).catch(() => {});
  return res.content.filter((b) => b.type === "text").map((b: any) => b.text).join("");
}
```

Boas práticas aprendidas:
- **Desative o "thinking"** em tarefas de classificação: os tokens de raciocínio consomem o `max_tokens` e o JSON sai **truncado**.
- **Formato de saída compacto**: o app pede linhas como `[i, 1, 1, "F", null, "ECO", "E", null, 0]` (índice + códigos de 3 letras) em vez de objetos JSON → **~60% menos tokens de saída** (os mais caros). Use códigos mnemônicos (não índices numéricos: a IA troca por 1).
- **Lotes** de 25–30 itens, 4 em paralelo, 3 tentativas, com **fallback por regras** (regex) se a IA falhar.
- **Valide os enums** que a IA devolve (ela inventa categorias).
- **Trunque a entrada**: título 180 e descrição 140 caracteres foram suficientes (testado: sem descrição a qualidade cai; com 120 é igual a 220).
- **Cache do prompt de sistema** (`cache_control`) para chamadas seguidas.
- **Reutilize resultados** (cluster) e **memorize rejeições**.
- **Cache de resultados caros** por chave (`Explanation` por sha1 do texto; resumos guardados no artigo, com nova tentativa só após 6 h se falhou).
- **Orçamento diário** configurável no painel + painel de uso por tipo; ao estourar, cada função cai para o fallback sem IA.
- **Rate limit por usuário** nos endpoints que disparam IA sob demanda.
- Meça antes/depois: compare tokens e a concordância das classificações em ~60 itens reais (o modelo concorda com ele mesmo ~80–85%; mudanças dentro disso são ruído).

---

## 11. Estrutura de arquivos para copiar

```
src/
  instrumentation.ts        # inicia o scheduler (produção)
  lib/
    jobs.ts                 # JOBS, runJob, pingScheduler, minutesUntilIngest
    job-runner.ts           # runJobDetached (processo filho)
    scheduler.ts            # crons
    settings.ts             # defaults + getSettings/saveSettings
    ai.ts                   # ask(), orçamento, uso
    <dominio>/ingest.ts     # pipeline de coleta
    <dominio>/classify.ts   # IA em lote + fallback por regras
  worker/
    job.ts                  # CLI
    index.ts                # (opcional) worker separado: startScheduler()
  app/
    api/cron/[job]/route.ts # gatilho HTTP (Bearer CRON_SECRET)
    admin-actions.ts        # runJobNow, saveSettings (server actions)
    (app)/admin/...         # visão geral, robô, parâmetros
```

Admin mínimo útil: **visão geral** (última/próxima coleta, "agendador sem sinal" se o ping > 20 min, pendências, uso de IA), **botões** para rodar cada job com a data/resultado da última execução, **histórico** de `JobRun`, **parâmetros** editáveis.

---

## 12. Armadilhas (todas aconteceram)

| Problema | Causa | Solução |
|---|---|---|
| Build quebra: `Can't resolve 'http'` no `instrumentation.ts` | O arquivo é compilado também para o runtime *edge* | `if (process.env.NEXT_RUNTIME === "nodejs") { await import(...) }` (import dentro do `if`) |
| Site lento logo depois do deploy | Coleta/classificação no mesmo processo das páginas | `runJobDetached` (processo filho) |
| Aviso "agendador parou" falso | `INGEST_CRON` de hora em hora | Cron fixo de 5 em 5 min + intervalo no painel |
| Resumo das 7h não chegou | Deploy/restart às 7h | Cron de "recuperação" + `claim` único por (usuário, tipo, dia) |
| JSON da IA truncado | *Thinking* consumindo `max_tokens` | `thinking: { type: "disabled" }` |
| Notícia repetida | Mesma matéria por URLs diferentes | Dedupe por `veículo+título` e `clusterKey` |
| Acentos quebrados | Feed em ISO-8859-1 lido como UTF-8 | Ler bytes e decodificar pelo charset |
| Erro de campo novo do Prisma em dev | Processo com client antigo na memória | Reiniciar dev server **e** worker após `prisma generate` |
| "Restaurar padrão" apagou configurações internas | `deleteMany()` sem filtro | Apagar só as chaves do grupo |
| Setting salva vazia ao dividir formulários | Loop salvando campos ausentes | Salvar só `formData.has(chave)` (+ `__cb_` para checkbox) |

---

## 13. Checklist para levar para outro projeto

1. Copie `JobRun`, `Setting`, `AiUsage` (e `RejectedCluster`, se tiver triagem por IA) para o `schema.prisma`; gere e aplique a migração.
2. Copie `jobs.ts`, `job-runner.ts`, `scheduler.ts`, `instrumentation.ts`, `worker/job.ts`, `ai.ts`, `settings.ts`; ajuste `JOBS` aos seus jobs.
3. `package.json`: `node-cron`, `tsx` (em dependencies), script `"job": "tsx src/worker/job.ts"`.
4. Escreva cada job como função que **retorna um objeto-resumo** e é **idempotente**.
5. Crie a tela de admin (visão geral + botões + histórico + parâmetros).
6. Dockerfile: mantenha `node_modules` e `src/` na imagem (o filho roda `tsx src/worker/job.ts`); variáveis: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `TZ`, `CRON_SECRET`, `EMBEDDED_WORKER` (0 para desligar).
7. Teste local em **modo produção** (`next build && next start`): o scheduler só sobe com `NODE_ENV=production`.
8. Em produção, confira na Visão geral que o "último sinal do agendador" é recente.
