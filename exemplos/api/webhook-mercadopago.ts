import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPreapproval } from "@/lib/mercadopago";
import { logEvent } from "@/lib/audit";

/**
 * Valida o header x-signature do MP (HMAC-SHA256 sobre o manifest
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`). Só roda quando
 * MERCADOPAGO_WEBHOOK_SECRET está configurado — sem o secret, seguimos
 * confiando na re-busca pela API (que já impede payload forjado).
 */
function validSignature(request: Request, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true;

  const sig = request.headers.get("x-signature") ?? "";
  const requestId = request.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(
    sig.split(",").map((p) => p.trim().split("=", 2) as [string, string]),
  );
  if (!parts.ts || !parts.v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  } catch {
    return false;
  }
}

/**
 * Webhook de Assinaturas do Mercado Pago.
 * Segurança: nunca confiamos no corpo da notificação — só no `data.id`.
 * O estado real é re-buscado na API do MP com o nosso token; um payload
 * forjado no máximo nos faz consultar uma assinatura que não existe.
 */
export async function POST(request: Request) {
  let dataId: string | null = null;
  let type: string | null = null;

  const url = new URL(request.url);
  dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  type = url.searchParams.get("type") ?? url.searchParams.get("topic");

  try {
    const body = (await request.json()) as { type?: string; data?: { id?: string } };
    type = body.type ?? type;
    dataId = body.data?.id ?? dataId;
  } catch {
    // notificações antigas vêm só com query params
  }

  // Só nos importam eventos de assinatura
  if (!dataId || !type?.includes("preapproval")) {
    return NextResponse.json({ ok: true });
  }

  if (!validSignature(request, dataId)) {
    await logEvent({
      category: "security",
      action: "webhook.invalid_signature",
      actorEmail: "mercadopago",
      details: { dataId },
      ip: null,
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const sub = await getPreapproval(dataId);
  if (!sub?.external_reference) return NextResponse.json({ ok: true });

  const [workspaceId, plano] = sub.external_reference.split(":");
  if (!workspaceId || !plano) return NextResponse.json({ ok: true });

  if (sub.status === "authorized") {
    await prisma.subscription.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        plano,
        status: "active",
        gatewaySubscriptionId: sub.id,
        gatewayCustomerId: sub.payer_id ? String(sub.payer_id) : null,
      },
      update: {
        plano,
        status: "active",
        trialEndsAt: null,
        gatewaySubscriptionId: sub.id,
        gatewayCustomerId: sub.payer_id ? String(sub.payer_id) : null,
      },
    });
    await logEvent({
      category: "system",
      action: "payment.authorized",
      actorEmail: sub.payer_email ?? "mercadopago",
      targetType: "workspace",
      targetId: workspaceId,
      details: { plano, preapprovalId: sub.id },
      ip: null,
    });
  } else if (sub.status === "cancelled" || sub.status === "paused") {
    // Só derruba se a assinatura cancelada é a MESMA que ativou o workspace
    await prisma.subscription.updateMany({
      where: { workspaceId, gatewaySubscriptionId: sub.id },
      data: { status: "canceled" },
    });
    await logEvent({
      category: "system",
      action: `payment.${sub.status}`,
      actorEmail: sub.payer_email ?? "mercadopago",
      targetType: "workspace",
      targetId: workspaceId,
      details: { plano, preapprovalId: sub.id },
      ip: null,
    });
  }

  return NextResponse.json({ ok: true });
}

/** O MP às vezes valida a URL com GET. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
