import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router = Router();

const score = z.number().int().min(1).max(5);

/**
 * POST /api/ratings — student rates water & light for a paid/moved-in booking.
 * One rating per booking (upsert — tenant can revise it).
 */
router.post("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const parsed = z
      .object({ bookingId: z.string(), waterScore: score, lightScore: score, comment: z.string().max(500).optional() })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", details: parsed.error.flatten() });

    const booking = await prisma.booking.findFirst({ where: { id: parsed.data.bookingId, studentId: req.userId! } });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "paid" && booking.status !== "moved_in") {
      return res.status(400).json({ message: "You can rate after payment" });
    }

    const rating = await prisma.rating.upsert({
      where: { bookingId: booking.id },
      update: { waterScore: parsed.data.waterScore, lightScore: parsed.data.lightScore, comment: parsed.data.comment ?? null },
      create: {
        bookingId: booking.id,
        hostelId: booking.hostelId,
        studentId: req.userId!,
        waterScore: parsed.data.waterScore,
        lightScore: parsed.data.lightScore,
        comment: parsed.data.comment ?? null,
      },
    });
    res.status(201).json(rating);
  } catch (e) {
    next(e);
  }
});

/** GET /api/ratings/hostel/:hostelId — public averages + tenant ratings. */
router.get("/hostel/:hostelId", async (req, res, next) => {
  try {
    const ratings = await prisma.rating.findMany({
      where: { hostelId: req.params.hostelId },
      include: { booking: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const avg = (k: "waterScore" | "lightScore") =>
      ratings.length ? Math.round((ratings.reduce((s, r) => s + r[k], 0) / ratings.length) * 10) / 10 : null;
    res.json({ count: ratings.length, waterAvg: avg("waterScore"), lightAvg: avg("lightScore"), ratings });
  } catch (e) {
    next(e);
  }
});

export default router;
