/** Divide `valor` (R$) em N fatias iguais, resto (centavos) na 1ª — mesmo
 *  padrão de arredondamento do parcelamento em `(app)/actions.ts`. Puro (sem
 *  `server-only`) pra poder rodar no client (preview do form) e no server. */
export function computeEqualShares(
  valor: number,
  memberIds: string[],
): { userId: string; valor: number }[] {
  const n = memberIds.length;
  if (n === 0 || !Number.isFinite(valor)) return [];
  const totalCents = Math.round(valor * 100);
  const base = Math.floor(totalCents / n);
  const resto = totalCents - base * n;
  return memberIds.map((userId, i) => ({
    userId,
    valor: (base + (i === 0 ? resto : 0)) / 100,
  }));
}
