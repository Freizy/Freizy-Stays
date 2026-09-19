import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole } from "../middlewares/requireAuth";
import { notifyUser } from "../services/push";

const router = Router();
router.use(requireAuth, requireRole("ADMIN"));

/** PATCH /api/admin/hostels/:id/verify — toggles green Freizy Verified badge. Priority #1. */
router.patch("/hostels/:id/verify", async (req, res, next) => {
  try {
    const hostel = await prisma.hostel.update({
      where: { id: req.params.id },
      data: { isVerified: req.body.isVerified !== false },
    });
    res.json(hostel);
  } catch (e) {
    next(e);
  }
});

/** GET /api/admin/bookings — view all bookings with escrow status. */
router.get("/bookings", async (_req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: { hostel: true, student: true, payments: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(bookings);
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/admin/bookings/:id/release — release escrow after student confirms move-in. */
router.patch("/bookings/:id/release", async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { hostel: { select: { ownerId: true, name: true } } } });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "moved_in") return res.status(400).json({ message: "Student must confirm move-in first" });
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { escrowStatus: "released" } });
    notifyUser(booking.hostel.ownerId, "Escrow released 💰", `${booking.hostel.name}: GH₵${booking.paidAmount.toLocaleString()} released to you.`, { tab: "Owner" });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

export default router;
