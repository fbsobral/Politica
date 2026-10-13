// Executa um job manualmente: npm run job -- ingest | digest | politicians | cleanup
import { JOBS, runJob, type JobName } from "@/lib/jobs";

const name = process.argv[2] as JobName;
if (!name || !(name in JOBS)) {
  console.error(`Uso: npm run job -- <${Object.keys(JOBS).join("|")}>`);
  process.exit(1);
}
runJob(name)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
