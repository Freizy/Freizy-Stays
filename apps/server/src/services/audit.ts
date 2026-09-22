import { prisma } from "../config/prisma";

/** Best-effort audit trail — never throws into request handling. */
export async function audit(
  actorId: string,
  actorRole: string | undefined,
  action: string,
  entity: string,
  entityId?: string,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        actorRole: actorRole ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        meta: (meta ?? {}) as object,
      },
    });
  } catch (e) {
    console.warn("[audit]", e instanceof Error ? e.message : e);
  }
}
