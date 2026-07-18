import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { addInterval, type Freq } from "@/lib/recurrence";

/** Comparação de segredo resistente a timing-attack. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Gera a próxima ocorrência de cada recorrência indeterminada (assinaturas
 * sem data de término) cuja `proximaData` já chegou, e avança a data.
 * Protegido por CRON_SECRET, agendado no vercel.json.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const due = await prisma.recurrence.findMany({
    where: { ativo: true, indeterminada: true, proximaData: { lte: new Date() } },
  });

  let criadas = 0;
  for (const rec of due) {
    if (!rec.tipo || rec.valor === null) continue; // recorrência antiga sem modelo — ignora
    await prisma.transaction.create({
      data: {
        workspaceId: rec.workspaceId,
        tipo: rec.tipo,
        valor: rec.valor,
        descricao: rec.descricao,
        categoryId: rec.categoryId,
        accountId: rec.accountId,
        cardId: rec.cardId,
        status: "previsto",
        dataCompetencia: rec.proximaData,
        dataVencimento: rec.proximaData,
        recurrenceId: rec.id,
      },
    });
    await prisma.recurrence.update({
      where: { id: rec.id },
      data: { proximaData: addInterval(rec.proximaData, rec.regra as Freq, 1) },
    });
    criadas++;
  }

  return NextResponse.json({ ok: true, verificadas: due.length, criadas });
}
