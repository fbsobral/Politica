import AdmZip from "adm-zip";
import { createWriteStream, existsSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { PoliticianRole } from "@prisma/client";
import { db } from "@/lib/db";
import { normalize } from "@/lib/text";

const BASE = "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

async function downloadZip(year: number): Promise<string> {
  const dir = join(tmpdir(), "politica-tse");
  await mkdir(dir, { recursive: true });
  const file = join(dir, `consulta_cand_${year}.zip`);
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < MAX_AGE_MS && statSync(file).size > 1_000_000) return file;
  const res = await fetch(`${BASE}/consulta_cand_${year}.zip`);
  if (!res.ok || !res.body) throw new Error(`TSE ${year}: HTTP ${res.status}`);
  const tmp = `${file}.part`;
  await pipeline(Readable.fromWeb(res.body as any), createWriteStream(tmp));
  const { renameSync } = await import("node:fs");
  renameSync(tmp, file);
  return file;
}

/** Parser CSV do TSE: separador ";" e campos entre aspas. */
function* parseCsv(text: string): Generator<string[]> {
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ";") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      yield row;
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    yield row;
  }
}

function* readCandidates(zipPath: string, uf: string, year: number): Generator<Record<string, string>> {
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry(`consulta_cand_${year}_${uf}.csv`);
  if (!entry) throw new Error(`Arquivo do TSE para ${uf}/${year} não encontrado`);
  const text = new TextDecoder("latin1").decode(entry.getData());
  let header: string[] | null = null;
  for (const row of parseCsv(text)) {
    if (!header) {
      header = row;
      continue;
    }
    if (row.length < header.length) continue;
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => (rec[h] = row[idx]));
    yield rec;
  }
}

const ELECTED = /^ELEITO/;
const clean = (v?: string) => (v && !/^#?(NULO|NÃO DIVULGÁVEL)/i.test(v) ? v.trim() : null);

type Mapped = {
  externalKey: string;
  name: string;
  ballotName: string | null;
  role: PoliticianRole;
  uf: string;
  municipality: string | null;
  municipalityKey: string | null;
  party: string | null;
  email: string | null;
  mandate: string;
};

function collect(zipPath: string, uf: string, year: number, roles: Record<string, PoliticianRole>, mandate: string, municipal: boolean): Mapped[] {
  const seen = new Map<string, Mapped>();
  for (const r of readCandidates(zipPath, uf, year)) {
    const role = roles[r.DS_CARGO];
    if (!role || !ELECTED.test(r.DS_SIT_TOT_TURNO)) continue;
    const key = `tse:${year}:${r.SQ_CANDIDATO}`;
    if (seen.has(key)) continue;
    seen.set(key, {
      externalKey: key,
      name: titleCase(r.NM_CANDIDATO),
      ballotName: titleCase(r.NM_URNA_CANDIDATO),
      role,
      uf,
      municipality: municipal ? titleCase(r.NM_UE) : null,
      municipalityKey: municipal ? normalize(r.NM_UE) : null,
      party: r.SG_PARTIDO || null,
      email: clean(r.DS_EMAIL),
      mandate,
    });
  }
  return [...seen.values()];
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|\s|-|')(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase())
    .replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());
}

async function save(rows: Mapped[], where: { uf: string; roles: PoliticianRole[] }) {
  for (const r of rows) {
    await db.politician.upsert({ where: { externalKey: r.externalKey }, create: r, update: r });
  }
  await db.politician.deleteMany({
    where: { uf: where.uf, role: { in: where.roles }, externalKey: { startsWith: "tse:", notIn: rows.map((r) => r.externalKey) } },
  });
}

/** Governador, vice e deputados estaduais eleitos em 2022 para a UF. */
export async function syncEstadual(uf: string): Promise<number> {
  const zip = await downloadZip(2022);
  const roles = { GOVERNADOR: "GOVERNADOR", "VICE-GOVERNADOR": "VICE_GOVERNADOR", "DEPUTADO ESTADUAL": "DEPUTADO_ESTADUAL" } as const;
  const rows = collect(zip, uf, 2022, roles, "2023–2026", false);
  if (!rows.length) throw new Error(`Nenhum eleito encontrado para ${uf}`);
  // DF elege deputados distritais
  await save(rows, { uf, roles: Object.values(roles) });
  return rows.length;
}

/** Prefeitos, vices e vereadores eleitos em 2024 para todos os municípios da UF. */
export async function syncMunicipal(uf: string): Promise<number> {
  if (uf === "DF") return 0; // DF não tem municípios
  const zip = await downloadZip(2024);
  const roles = { PREFEITO: "PREFEITO", "VICE-PREFEITO": "VICE_PREFEITO", VEREADOR: "VEREADOR" } as const;
  const rows = collect(zip, uf, 2024, roles, "2025–2028", true);
  if (!rows.length) throw new Error(`Nenhum eleito municipal encontrado para ${uf}`);
  await save(rows, { uf, roles: Object.values(roles) });
  return rows.length;
}
