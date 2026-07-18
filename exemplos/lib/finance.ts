/**
 * Fórmulas financeiras puras (sem I/O) — reutilizadas na UI e cobertas por testes.
 */

/** Taxa anual (%) → mensal equivalente (%) por juros compostos. */
export function anualParaMensal(anual: number): number {
  return (Math.pow(1 + anual / 100, 1 / 12) - 1) * 100;
}

/** % do CDI + CDI anual (%) → taxa anual efetiva (%). */
export function yieldAnual(percentualCDI: number, cdiAnual: number): number {
  return Number(((percentualCDI / 100) * cdiAnual).toFixed(2));
}

export type ProjecaoPonto = { mes: number; investido: number; total: number };
export type ProjecaoResultado = {
  saldo: number;
  investido: number;
  juros: number;
  serie: ProjecaoPonto[];
};

/**
 * Juros compostos com aporte mensal no fim de cada mês.
 * @param taxaMensalPct taxa ao mês em % (ex.: 0.8)
 */
export function projetarInvestimento(
  inicial: number,
  aporteMensal: number,
  meses: number,
  taxaMensalPct: number,
): ProjecaoResultado {
  const i = taxaMensalPct / 100;
  const serie: ProjecaoPonto[] = [];
  let saldo = inicial;
  let investido = inicial;
  serie.push({ mes: 0, investido, total: saldo });
  for (let m = 1; m <= meses; m++) {
    saldo = saldo * (1 + i) + aporteMensal;
    investido += aporteMensal;
    serie.push({ mes: m, investido: Math.round(investido), total: Math.round(saldo) });
  }
  return { saldo, investido, juros: saldo - investido, serie };
}

export type BudgetTone = "ok" | "warn" | "over";

/** Estado do orçamento conforme o gasto se aproxima/estoura a meta. */
export function budgetTone(gasto: number, meta: number): BudgetTone {
  if (meta <= 0) return "ok";
  const r = gasto / meta;
  if (r > 1) return "over";
  if (r >= 0.8) return "warn";
  return "ok";
}

/** Percentual consumido da meta, limitado a 100. */
export function budgetPct(gasto: number, meta: number): number {
  return meta > 0 ? Math.min((gasto / meta) * 100, 100) : 0;
}
