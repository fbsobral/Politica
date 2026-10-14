/**
 * Roda uma vez quando o servidor do site sobe. Em produção, o próprio site agenda a coleta de notícias, os
 * resumos por e-mail e as demais rotinas — não depende de worker nem de tarefas agendadas externas.
 * Para desligar (ex.: se usar um worker separado): EMBEDDED_WORKER=0.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production" && process.env.EMBEDDED_WORKER !== "0") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler({ bootDelayMs: 30_000 });
  }
}
