import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { normalizeGhanaMsisdn } from "../services/phone";
import { getTransactionStatus, isMomoConfigured, requestToPay } from "../services/momo";
import { initializeTransaction, isPaystackConfigured, verifyTransaction } from "../services/paystack";
import { applyFeeResult, feeAmountFor } from "../services/accessFee";

const router = Router();

/**
 * POST /api/access-fee/initiate — one-time onboarding fee (GH₵50 student / GH₵100 owner).
 * Mirrors the booking payment flow; sandbox stub when provider creds are absent.
 */
router.post("/initiate", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const schema = z.object({
      provider: z.enum(["MTN_MOMO", "VODAFONE_CASH", "CARD"]),
      phone: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", details: parsed.error.flatten() });

    const amount = feeAmountFor(req.role);
    if (amount == null) return res.json({ exempt: true });
    const existing = await prisma.accessFee.findUnique({ where: { userId: req.userId! } });
    if (existing?.status === "success") return res.status(400).json({ message: "Fee already paid" });
    const student = await prisma.user.findUnique({ where: { id: req.userId! } });
    const reference = `FRZ-FEE-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    let extra: { sandbox: boolean; authorizationUrl?: string; prompt?: string } = { sandbox: true };
    if (parsed.data.provider === "CARD") {
      if (isPaystackConfigured()) {
        const digits = (parsed.data.phone ?? student?.phone ?? "").replace(/\D/g, "");
        const email = student?.email ?? `${digits || "user"}@freizy.stays`;
        const init = await initializeTransaction({ email, amountGHS: amount, reference, channels: ["card", "mobile_money"] });
        extra = { sandbox: false, authorizationUrl: init.authorization_url };
      }
    } else if (isMomoConfigured()) {
      const msisdn = normalizeGhanaMsisdn(parsed.data.phone ?? student?.phone);
      if (!msisdn) return res.status(400).json({ message: "Enter a valid MoMo number (e.g. 0241234567)" });
      await requestToPay({ amountGHS: amount, msisdn, reference, note: "Freizy Stays onboarding fee" });
      extra = {
        sandbox: env.momo.environment === "sandbox",
        prompt: `Approve GH₵${amount} on ${parsed.data.phone ?? student?.phone}`,
      };
    }

    const fee = await prisma.accessFee.upsert({
      where: { userId: req.userId! },
      update: { amount, provider: parsed.data.provider, phone: parsed.data.phone ?? null, status: "pending", reference, raw: extra },
      create: {
        userId: req.userId!,
        role: req.role!,
        amount,
        provider: parsed.data.provider,
        phone: parsed.data.phone ?? null,
        status: "pending",
        reference,
        raw: extra,
      },
    });
    res.status(201).json({ accessFee: fee, ...extra });
  } catch (e) {
    next(e);
  }
});

/** GET /api/access-fee/mine — have I paid? */
router.get("/mine", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const amount = feeAmountFor(req.role);
    if (amount == null) return res.json({ paid: true, exempt: true, amount: 0 });
    const f = await prisma.accessFee.findUnique({ where: { userId: req.userId! } });
    res.json({ paid: f?.status === "success", amount, status: f?.status ?? "unpaid" });
  } catch (e) {
    next(e);
  }
});

/** GET /api/access-fee/:reference/status — "I've approved, check now". */
router.get("/:reference/status", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const fee = await prisma.accessFee.findUnique({ where: { reference: req.params.reference } });
    if (!fee || fee.userId !== req.userId) return res.status(404).json({ message: "Fee payment not found" });
    if (fee.status === "success" || fee.status === "failed") return res.json({ status: fee.status, accessFee: fee });
    if (!fee.provider) return res.json({ status: fee.status, accessFee: fee, sandbox: true });

    if (fee.provider === "CARD" && isPaystackConfigured()) {
      const s = await verifyTransaction(fee.reference);
      if (s !== "pending") await applyFeeResult(fee.reference, s === "success", { polled: true, status: s });
      const fresh = await prisma.accessFee.findUnique({ where: { reference: fee.reference } });
      return res.json({ status: s === "pending" ? "pending" : s, accessFee: fresh });
    }
    if (fee.provider !== "CARD" && isMomoConfigured()) {
      const s = await getTransactionStatus(fee.reference);
      if (s === "SUCCESSFUL" || s === "FAILED") {
        await applyFeeResult(fee.reference, s === "SUCCESSFUL", { polled: true, status: s });
        const fresh = await prisma.accessFee.findUnique({ where: { reference: fee.reference } });
        return res.json({ status: s === "SUCCESSFUL" ? "success" : "failed", accessFee: fresh });
      }
      return res.json({ status: "pending", accessFee: fee });
    }
    return res.json({ status: fee.status, accessFee: fee, sandbox: true });
  } catch (e) {
    next(e);
  }
});

export default router;
