import { prisma } from "../config/prisma";

// Keep in sync with ACCESS_FEE_GHS in packages/shared
// (server runtime can't import TS sources, so the values are duplicated here).
export const ACCESS_FEE_GHS_SERVER = { STUDENT: 50, OWNER: 100 } as const;

export type AppRole = "STUDENT" | "OWNER" | "ADMIN";

export function feeAmountFor(role: AppRole | undefined): number | null {
  if (role === "STUDENT") return ACCESS_FEE_GHS_SERVER.STUDENT;
  if (role === "OWNER") return ACCESS_FEE_GHS_SERVER.OWNER;
  return null; // ADMIN exempt
}

export async function hasPaidAccessFee(userId: string): Promise<boolean> {
  const f = await prisma.accessFee.findUnique({ where: { userId } });
  return f?.status === "success";
}

export async function applyFeeResult(reference: string, ok: boolean, raw: unknown) {
  const existing = await prisma.accessFee.findUnique({ where: { reference } });
  if (!existing || existing.status === "success") return existing;
  return prisma.accessFee.update({
    where: { reference },
    data: { status: ok ? "success" : "failed", raw: raw as object, paidAt: ok ? new Date() : null },
  });
}
