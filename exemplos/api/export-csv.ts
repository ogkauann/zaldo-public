import { requireWorkspace } from "@/lib/auth";
import { listTransactions } from "@/lib/data/transactions";
import { formatBRL } from "@/lib/utils";

/** Exporta os lançamentos do workspace como CSV (Excel-friendly, separador ;). */
export async function GET() {
  const { workspace } = await requireWorkspace();
  const txs = await listTransactions(workspace.id, { take: 5000 });

  const header = [
    "Data",
    "Descrição",
    "Categoria",
    "Conta/Cartão",
    "Tipo",
    "Situação",
    "Valor",
  ];

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const linhas = txs.map((t) =>
    [
      t.dataCompetencia,
      t.descricao ?? t.categoria?.nome ?? "Lançamento",
      t.categoria?.nome ?? "",
      t.conta?.nome ?? (t.cartao ? `Cartão ${t.cartao.nome}` : ""),
      t.tipo,
      t.status,
      formatBRL(t.tipo === "despesa" ? -t.valor : t.valor),
    ]
      .map((c) => esc(String(c)))
      .join(";"),
  );

  // BOM p/ o Excel reconhecer UTF-8 (acentos)
  const csv = "﻿" + [header.map(esc).join(";"), ...linhas].join("\r\n");
  const hoje = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zaldo-lancamentos-${hoje}.csv"`,
    },
  });
}
