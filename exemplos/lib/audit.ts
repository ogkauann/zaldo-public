import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type AuditCategory = "admin" | "security" | "system";

type LogEventInput = {
  category: AuditCategory;
  action: string;
  actorEmail: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  /** Se omitido, tenta ler o IP do request atual. */
  ip?: string | null;
};

/** IP do request atual (Vercel/proxy) — "unknown" fora de um request. */
export async function requestIp(): Promise<string> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Registro append-only de eventos do sistema (segurança, admin, app).
 * Fire-and-forget: um log nunca pode derrubar a ação principal —
 * qualquer erro é engolido de propósito.
 */
export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    const ip = input.ip !== undefined ? input.ip : await requestIp();
    await prisma.auditLog.create({
      data: {
        category: input.category,
        action: input.action,
        actorEmail: input.actorEmail,
        targetType: input.targetType,
        targetId: input.targetId,
        details: input.details as object | undefined,
        ip,
      },
    });
  } catch {
    // nunca propaga — log é best-effort
  }
}
