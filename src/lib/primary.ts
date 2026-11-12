import { db } from "@/lib/db";
import { ibgeIdFor } from "@/lib/ibge";
import { dcaCached, ipcaByYear, UF_CODE, type BudgetScope, type DcaYear } from "@/lib/budget";
import { perYear, sgs } from "@/lib/indicators/core";

/*
 * Resultado primário por ano, calculado com os balanços anuais (DCA/Siconfi), pela regra "acima da linha":
 *   receita primária = receita líquida de deduções, sem operações de crédito, alienação de bens,
 *                      amortização de empréstimos concedidos e rendimentos de aplicações financeiras;
 *   despesa primária = despesa empenhada sem juros e encargos da dívida e sem amortização da dívida.
 * É uma aproximação do resultado oficial do RREO (que pode ajustar outros itens).
 */

export type Part = { code: string; name: string; value: number };
export type PrimaryYear = {
  year: number;
  revenue: Part[];
  /** despesa primária por tipo de gasto */
  expenseNature: Part[];
  /** despesa primária por área (função); Encargos Especiais sem juros e amortização */
  expenseFunction: Part[];
  revenueTotal: number;
  expenseTotal: number;
  result: number;
  /** juros e encargos da dívida pagos (empenhados) e rendimentos financeiros recebidos */
  interest: number;
  financialIncome: number;
  /** itens fora da conta primária, para transparência */
  excluded: Part[];
};

export type PrimaryHistory = {
  scope: BudgetScope;
  entity: string;
  years: PrimaryYear[];
  deflator: Record<number, number>;
  population: Record<number, number>;
  /** só federal: resultado primário do setor público consolidado (Banco Central), % do PIB; positivo = superávit */
  bcb: { year: number; pct: number }[];
  firstAvailable: number | null;
  fetchedAt: string;
};

const DATA_START = 2013; // DCA padronizado no Siconfi
const MAX_YEARS = 30;
const DAY = 864e5;

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Receitas de capital que não entram na conta primária (códigos de origem do MCASP). */
const NON_PRIMARY_REVENUE: Record<string, string> = { "RO2.1": "Operações de crédito (empréstimos tomados)", "RO2.2": "Alienação de bens", "RO2.3": "Amortização de empréstimos concedidos" };
const FINANCIAL_YIELD = /valores mobiliarios|aplicacoes financeiras|aplicacao financeira|remuneracao de depositos|rendimentos? de aplica/;

const NATURE_PRIMARY: Record<string, string> = { "nat:3.1": "Pessoal e encargos", "nat:3.3": "Custeio e outras correntes", "nat:4.4": "Investimentos", "nat:4.5": "Inversões financeiras" };

export function computeYear(d: DcaYear): PrimaryYear | null {
  if (d.empty || !d.nature?.length || !d.revenue.length) return null;
  const kids = new Map<string, DcaYear["revenue"]>();
  for (const r of d.revenue) if (r.parent) kids.set(r.parent, [...(kids.get(r.parent) ?? []), r]);
  // dedução de um nó: a dele, ou a soma das dos filhos quando o anexo só traz no detalhe
  const ded = (r: DcaYear["revenue"][number]): number => {
    const own = r.net !== undefined ? r.value - r.net : 0;
    if (own > 0) return own;
    return (kids.get(r.code) ?? []).reduce((a, k) => a + ded(k), 0);
  };
  const net = (r: DcaYear["revenue"][number]) => r.value - ded(r);
  // rendimentos financeiros: nós mais altos dentro da receita patrimonial que casam com o padrão
  const yields = (code: string): number => (kids.get(code) ?? []).reduce((a, k) => a + (FINANCIAL_YIELD.test(norm(k.name)) ? net(k) : yields(k.code)), 0);

  const roots = d.revenue.filter((r) => !r.parent && /^RO[12]\.\d+$/.test(r.code) && !/intra/i.test(r.name));
  const revenue: Part[] = [];
  const excluded: Part[] = [];
  let financialIncome = 0;
  for (const r of roots) {
    let v = net(r);
    if (NON_PRIMARY_REVENUE[r.code]) {
      if (v) excluded.push({ code: r.code, name: NON_PRIMARY_REVENUE[r.code], value: v });
      continue;
    }
    if (r.code === "RO1.3") {
      const y = Math.min(v, yields(r.code));
      if (y > 0) {
        financialIncome += y;
        excluded.push({ code: "fin", name: "Rendimentos de aplicações financeiras", value: y });
        v -= y;
      }
    }
    if (v) revenue.push({ code: r.code, name: r.name, value: v });
  }
  const nat = new Map(d.nature.map((n) => [n.code, n.value]));
  const interest = nat.get("nat:3.2") ?? 0;
  const amort = nat.get("nat:4.6") ?? 0;
  if (interest) excluded.push({ code: "nat:3.2", name: "Juros e encargos da dívida", value: interest });
  if (amort) excluded.push({ code: "nat:4.6", name: "Amortização da dívida", value: amort });
  const expenseNature = Object.entries(NATURE_PRIMARY).map(([code, name]) => ({ code, name, value: nat.get(code) ?? 0 })).filter((p) => p.value);

  const revenueTotal = revenue.reduce((a, p) => a + p.value, 0);
  const expenseTotal = expenseNature.reduce((a, p) => a + p.value, 0);
  if (revenueTotal <= 0 || expenseTotal <= 0) return null;

  // por área: funções; Encargos Especiais (28) sem a dívida; o que sobrar de diferença vira ajuste
  const fns = d.expense.filter((e) => !e.parent).map((e) => ({ code: e.code, name: e.name, value: e.code === "28" ? Math.max(0, e.value - interest - amort) : e.value })).filter((p) => p.value > 0);
  const diff = expenseTotal - fns.reduce((a, p) => a + p.value, 0);
  if (Math.abs(diff) > expenseTotal * 0.005) fns.push({ code: "ajuste", name: "Ajustes (intraorçamentárias e diferenças entre anexos)", value: diff });

  return { year: d.year, revenue: revenue.sort((a, b) => b.value - a.value), expenseNature, expenseFunction: fns.sort((a, b) => b.value - a.value), revenueTotal, expenseTotal, result: revenueTotal - expenseTotal, interest, financialIncome, excluded };
}

async function build(scope: BudgetScope, id: number): Promise<PrimaryHistory | null> {
  const now = new Date().getFullYear();
  let last = now - 1;
  let probe = await dcaCached(id, last, 14, false);
  if (probe.empty) {
    last = now - 2;
    probe = await dcaCached(id, last, 14, false);
  }
  const from = Math.max(DATA_START, last - MAX_YEARS + 1);
  const wanted = Array.from({ length: last - from + 1 }, (_, i) => from + i);
  const data = new Map<number, DcaYear>([[last, probe]]);
  const pending = wanted.filter((y) => y !== last);
  let next = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (next < pending.length) {
        const y = pending[next++];
        data.set(y, await dcaCached(id, y, y >= last - 1 ? 14 : 90, false));
      }
    }),
  );
  const years = wanted.map((y) => computeYear(data.get(y)!)).filter((x): x is PrimaryYear => !!x);
  const ipca = await ipcaByYear();
  const base = ipca[last];
  const deflator: Record<number, number> = {};
  const population: Record<number, number> = {};
  for (const y of wanted) {
    if (ipca[y] && base) deflator[y] = base / ipca[y];
    const p = data.get(y)?.pop;
    if (p) population[y] = p;
  }
  let bcb: PrimaryHistory["bcb"] = [];
  if (scope === "FEDERAL") {
    try {
      // NFSP primária do setor público consolidado, 12 meses, % do PIB (positivo = déficit): dezembro de cada ano
      const s = perYear(await sgs(5793, now - MAX_YEARS, now), "last");
      bcb = Object.entries(s).map(([y, v]) => ({ year: Number(y), pct: -v })).filter((x) => x.year <= now - 1).sort((a, b) => a.year - b.year).slice(-MAX_YEARS);
    } catch (err) {
      console.warn("[primary:bcb]", (err as Error).message);
    }
  }
  if (!years.length && !bcb.length) return null;
  return { scope, entity: probe.name ?? (scope === "FEDERAL" ? "Governo Federal" : ""), years, deflator, population, bcb, firstAvailable: years[0]?.year ?? null, fetchedAt: new Date().toISOString() };
}

/** Resultado primário ano a ano (cache de 1 dia; os balanços de cada ano já ficam em cache próprio). */
export async function getPrimaryHistory(scope: BudgetScope, user: { uf: string; municipalityKey: string }): Promise<PrimaryHistory | null> {
  const id = scope === "FEDERAL" ? 1 : scope === "ESTADUAL" ? UF_CODE[user.uf] : await ibgeIdFor(user.uf, user.municipalityKey);
  if (!id) return null;
  const key = `primary:v1:${id}`;
  const hit = await db.budgetCache.findUnique({ where: { key } });
  if (hit && Date.now() - hit.fetchedAt.getTime() < DAY) return hit.data as unknown as PrimaryHistory;
  try {
    const fresh = await build(scope, id);
    if (fresh) await db.budgetCache.upsert({ where: { key }, create: { key, data: fresh as never }, update: { data: fresh as never, fetchedAt: new Date() } });
    return fresh ?? (hit ? (hit.data as unknown as PrimaryHistory) : null);
  } catch (err) {
    console.warn("[primary]", scope, id, (err as Error).message);
    return hit ? (hit.data as unknown as PrimaryHistory) : null;
  }
}
