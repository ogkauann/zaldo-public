import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth";
import { listTransactions } from "@/lib/data/transactions";

/** Prévia de busca da topbar: até 6 lançamentos que casam com ?q=. */
export async function GET(request: Request) {
  const { workspace } = await requireWorkspace();
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ items: [] });

  const items = await listTransactions(workspace.id, { take: 6, q });
  return NextResponse.json({
    items: items.map((t) => ({
      id: t.id,
      descricao: t.descricao ?? t.categoria?.nome ?? "Lançamento",
      valor: t.valor,
      tipo: t.tipo,
      dataCompetencia: t.dataCompetencia,
      categoria: t.categoria?.nome ?? null,
    })),
  });
}
