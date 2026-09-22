import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { normalizeGhanaMsisdn } from "../services/phone";
import { notifyUser } from "../services/push";
import { getTransactionStatus, isMomoConfigured, requestToPay } from "../services/momo";
import { initializeTransaction, isPaystackConfigured, verifyPaystackSignature, verifyTransaction } from "../services/paystack";
import { applyFeeResult } from "../services/accessFee";

const router = Router();
const ESCROW_NOTICE = "Your money is safe with Freizy. Owner gets paid only after you move in and confirm.";

/** Idempotent: first success wins, retries are safe. Totals update atomically. */
async function applyPaymentResult(reference: string, ok: boolean, raw: unknown) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({ where: { reference } });
    if (!existing || existing.status === "success") return existing;
    const payment = await tx.payment.update({
      where: { reference },
      data: { status: ok ? "success" : "failed", raw: raw as object },
    });
    if (ok) {
      const booking = await tx.booking.findUnique({ where: { id: payment.bookingId } });
      if (booking) {
        const paidAmount = booking.paidAmount + payment.amount;
        await tx.booking.update({
          where: { id: booking.id },
          data: { paidAmount, status: paidAmount >= booking.total ? "paid" : "pending" },
        });
        notifyUser(
          booking.studentId,
          "Payment received ✓",
          `GH₵${payment.amount.toLocaleString()} confirmed (ref ${payment.reference.slice(0, 12)}…).`,
          { tab: "Bookings" }
        );
      }
    }
    return payment;
  });
}

/**
 * POST /api/payments/initiate — creates a payment row and talks to the
 * provider when credentials exist. Without creds it returns a sandbox stub
 * (approve in the test dashboard / poll below).
 */
router.post("/initiate", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const schema = z.object({
      bookingId: z.string(),
      provider: z.enum(["MTN_MOMO", "VODAFONE_CASH", "AT_MONEY", "CARD"]),
      phone: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", details: parsed.error.flatten() });

    const booking = await prisma.booking.findFirst({
      where: { id: parsed.data.bookingId, studentId: req.userId! },
      include: { hostel: true },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const remaining = booking.total - booking.paidAmount;
    if (remaining <= 0) return res.status(400).json({ message: "Already fully paid" });
    const amount = booking.paymentType === "installment" ? Math.min(Math.ceil(booking.total / 4), remaining) : remaining;
    const reference = `FRZ-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const student = await prisma.user.findUnique({ where: { id: req.userId! } });

    let extra: { sandbox: boolean; authorizationUrl?: string; prompt?: string } = { sandbox: true };

    if (parsed.data.provider === "CARD" || parsed.data.provider === "AT_MONEY") {
      if (isPaystackConfigured()) {
        const digits = (parsed.data.phone ?? student?.phone ?? "").replace(/\D/g, "");
        // Paystack requires a deliverable-looking email with a letter in it; phone-only users get a unique gmail fallback.
        const email = student?.email ?? `user${digits || "freizy"}@gmail.com`;
        // CARD: card + mobile money. AT_MONEY: mobile money only (MTN/Vodafone/AT picked on the Paystack page).
        const channels = parsed.data.provider === "CARD" ? ["card", "mobile_money"] : ["mobile_money"];
        const init = await initializeTransaction({ email, amountGHS: amount, reference, channels });
        extra = { sandbox: false, authorizationUrl: init.authorization_url };
      }
    } else {
      if (isMomoConfigured()) {
        const msisdn = normalizeGhanaMsisdn(parsed.data.phone ?? student?.phone);
        if (!msisdn) return res.status(400).json({ message: "Enter a valid MoMo number (e.g. 0241234567)" });
        await requestToPay({ amountGHS: amount, msisdn, reference, note: `Freizy hostel payment ${booking.hostel.name}` });
        extra = {
          sandbox: env.momo.environment === "sandbox",
          prompt: `Approve GH₵${amount} on ${parsed.data.phone ?? student?.phone}`,
        };
      }
    }

    // Idempotency: a recent pending row for the same booking+provider+amount is reused.
    const recent = await prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        provider: parsed.data.provider,
        amount,
        status: { in: ["initiated", "pending"] },
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      return res.status(200).json({
        payment: recent,
        escrowNotice: ESCROW_NOTICE,
        ...((recent.raw as Record<string, unknown> | null) ?? {}),
        deduped: true,
      });
    }

    const payment = await prisma.payment.create({
      data: { bookingId: booking.id, provider: parsed.data.provider, amount, status: "pending", reference, raw: extra },
    });

    res.status(201).json({ payment, escrowNotice: ESCROW_NOTICE, ...extra });
  } catch (e) {
    next(e);
  }
});

/**
 * POST /api/payments/webhook/:provider — provider callbacks.
 * Paystack calls MUST carry a valid x-paystack-signature (enforced in production).
 * MoMo calls are treated as notifications only: the result is always re-verified
 * against MTN's API, so forged callbacks can't mint money.
 */
router.post("/webhook/:provider", async (req, res, next) => {
  try {
    const provider = String(req.params.provider || "").toLowerCase();
    const isPaystack = provider.includes("paystack") || provider.includes("card");

    if (isPaystack) {
      const sig = req.headers["x-paystack-signature"] as string | undefined;
      const raw = (req as { rawBody?: Buffer }).rawBody;
      if (sig) {
        if (!verifyPaystackSignature(raw, sig)) return res.status(401).json({ message: "Bad signature" });
      } else if (env.nodeEnv === "production") {
        return res.status(401).json({ message: "Missing signature" });
      }
    }

    const body = req.body as { reference?: string; status?: string; externalId?: string };
    const reference = body.reference ?? body.externalId;
    if (!reference) return res.status(400).json({ message: "Missing reference" });

    if (!isPaystack && isMomoConfigured()) {
      try {
        const s = await getTransactionStatus(reference);
        const verified = s === "SUCCESSFUL" || s === "FAILED";
        const ok = s === "SUCCESSFUL";
        const mark = { ...req.body, verifiedVia: "momo-poll", providerStatus: s };
        const payment = verified ? await applyPaymentResult(reference, ok, mark) : null;
        if (payment) return res.json({ ok: true, verified: true });
        const fee = verified ? await applyFeeResult(reference, ok, mark) : null;
        if (fee) return res.json({ ok: true, verified: true });
        return res.status(404).json({ message: "Unknown reference" });
      } catch {
        return res.status(502).json({ message: "Could not verify with provider" });
      }
    }

    const ok = body.status === "success" || body.status === "successful" || body.status === "SUCCESSFUL";
    const payment = await applyPaymentResult(reference, ok, req.body);
    if (payment) return res.json({ ok: true });
    const fee = await applyFeeResult(reference, ok, req.body);
    if (!fee) return res.status(404).json({ message: "Unknown reference" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/** GET /api/payments/my — receipt history. */
router.get("/my", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { booking: { studentId: req.userId! } },
      include: { booking: { include: { hostel: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(payments);
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/payments/:reference/status — "I've approved, check now".
 * Polls the provider when configured, applies the result idempotently.
 */
router.get("/:reference/status", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { reference: req.params.reference },
      include: { booking: true },
    });
    if (!payment || payment.booking.studentId !== req.userId) return res.status(404).json({ message: "Payment not found" });
    if (payment.status === "success" || payment.status === "failed") return res.json({ status: payment.status, payment });

    if ((payment.provider === "CARD" || payment.provider === "AT_MONEY") && isPaystackConfigured()) {
      const s = await verifyTransaction(payment.reference);
      if (s !== "pending") await applyPaymentResult(payment.reference, s === "success", { polled: true, status: s });
      const fresh = await prisma.payment.findUnique({ where: { reference: payment.reference } });
      return res.json({ status: s === "pending" ? "pending" : s, payment: fresh });
    }

    if (payment.provider !== "CARD" && isMomoConfigured()) {
      const s = await getTransactionStatus(payment.reference);
      if (s === "SUCCESSFUL" || s === "FAILED") {
        await applyPaymentResult(payment.reference, s === "SUCCESSFUL", { polled: true, status: s });
        const fresh = await prisma.payment.findUnique({ where: { reference: payment.reference } });
        return res.json({ status: s === "SUCCESSFUL" ? "success" : "failed", payment: fresh });
      }
      return res.json({ status: "pending", payment });
    }

    return res.json({ status: payment.status, payment, sandbox: true });
  } catch (e) {
    next(e);
  }
});

export default router;
