import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { normalizeGhanaMsisdn } from "../services/phone";
import { notifyUser } from "../services/push";
import { getTransactionStatus, isMomoConfigured, requestToPay } from "../services/momo";
import { initializeTransaction, isPaystackConfigured, verifyTransaction } from "../services/paystack";

const router = Router();
const ESCROW_NOTICE = "Your money is safe with Freizy. Owner gets paid only after you move in and confirm.";

/** Idempotent: first success wins, retries are safe. */
async function applyPaymentResult(reference: string, ok: boolean, raw: unknown) {
  const existing = await prisma.payment.findUnique({ where: { reference } });
  if (!existing || existing.status === "success") return existing;
  const payment = await prisma.payment.update({
    where: { reference },
    data: { status: ok ? "success" : "failed", raw: raw as object },
  });
  if (ok) {
    const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId } });
    if (booking) {
      const paidAmount = booking.paidAmount + payment.amount;
      await prisma.booking.update({
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
      provider: z.enum(["MTN_MOMO", "VODAFONE_CASH", "CARD"]),
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

    if (parsed.data.provider === "CARD") {
      if (isPaystackConfigured()) {
        const digits = (parsed.data.phone ?? student?.phone ?? "").replace(/\D/g, "");
        const email = student?.email ?? `${digits || "user"}@freizy.stays`;
        const init = await initializeTransaction({ email, amountGHS: amount, reference, channels: ["card", "mobile_money"] });
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

    const payment = await prisma.payment.create({
      data: { bookingId: booking.id, provider: parsed.data.provider, amount, status: "pending", reference, raw: extra },
    });

    res.status(201).json({ payment, escrowNotice: ESCROW_NOTICE, ...extra });
  } catch (e) {
    next(e);
  }
});

/** POST /api/payments/webhook/:provider — provider callbacks. */
router.post("/webhook/:provider", async (req, res, next) => {
  try {
    const { reference, status } = req.body as { reference?: string; status?: string };
    if (!reference) return res.status(400).json({ message: "Missing reference" });
    const ok = status === "success" || status === "successful" || status === "SUCCESSFUL";
    const payment = await applyPaymentResult(reference, ok, req.body);
    if (!payment) return res.status(404).json({ message: "Unknown reference" });
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

    if (payment.provider === "CARD" && isPaystackConfigured()) {
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
