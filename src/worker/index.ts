import { startScheduler } from "@/lib/scheduler";

// Worker separado (opcional): em produção o próprio site já agenda os jobs (src/instrumentation.ts).
startScheduler();

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
