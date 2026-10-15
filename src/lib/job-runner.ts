import { spawn } from "node:child_process";
import { join } from "node:path";
import { runJob, type JobName } from "@/lib/jobs";

const running = new Map<string, Promise<void>>();

/**
 * Executa um job num **processo separado** (tsx), para que coleta, classificação e e-mails — que são pesados —
 * não travem as páginas do site. Se o processo filho não puder subir, roda no próprio processo.
 * Um mesmo job nunca roda duas vezes ao mesmo tempo.
 */
export function runJobDetached(name: JobName, opts: { scheduled?: boolean } = {}): Promise<void> {
  const existing = running.get(name);
  if (existing) return existing;
  const tsx = join(process.cwd(), "node_modules", ".bin", "tsx");
  const args = ["src/worker/job.ts", name, ...(opts.scheduled ? ["--scheduled"] : [])];
  const p = new Promise<void>((resolve) => {
    try {
      const child = spawn(tsx, args, { cwd: process.cwd(), env: process.env, stdio: ["ignore", "inherit", "inherit"] });
      child.on("error", (err) => {
        console.warn(`[job-runner] não consegui iniciar ${name} em processo separado (${err.message}); rodando aqui mesmo`);
        runJob(name, opts).catch(() => undefined).finally(resolve);
      });
      child.on("exit", () => resolve());
    } catch (err) {
      console.warn(`[job-runner] falha ao iniciar ${name}:`, (err as Error).message);
      runJob(name, opts).catch(() => undefined).finally(resolve);
    }
  }).finally(() => running.delete(name));
  running.set(name, p);
  return p;
}
