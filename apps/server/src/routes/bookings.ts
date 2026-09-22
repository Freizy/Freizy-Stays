import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { ACTIVE_BOOKING } from "../services/availability";
import { feeAmountFor, hasPaidAccessFee } from "../services/accessFee";
import { notifyUser } from "../services/push";

const router = Router();
const INSTALLMENTS = 4;

const createSchema = z.object({
  hostelId: z.string(),
  paymentType: z.enum(["full", "installment"]),
  roomTypeId: z.string(),
});

/** POST /api/bookings — student locks a room. 1st installment (25%) to lock when installment. */
router.post("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", details: parsed.error.flatten() });
    const need = feeAmountFor(req.role);
    if (need != null && !(await hasPaidAccessFee(req.userId!))) {
      return res.status(402).json({ message: `Pay the one-time GH₵${need} onboarding fee to book.`, code: "ACCESS_FEE_REQUIRED", amount: need });
    }
    const hostel = await prisma.hostel.findUnique({ where: { id: parsed.data.hostelId } });
    if (!hostel) return res.status(404).json({ message: "Hostel not found" });
    if (parsed.data.paymentType === "installment" && !hostel.momoAllowed) {
      return res.status(400).json({ message: "MoMo installments not allowed for this hostel" });
    }
    const roomType = await prisma.roomType.findFirst({
      where: { id: parsed.data.roomTypeId, hostelId: hostel.id },
      include: { _count: { select: { bookings: { where: { status: { in: ACTIVE_BOOKING } } } } } },
    });
    if (!roomType) return res.status(400).json({ message: "Choose a valid room type" });
    if (roomType._count.bookings >= roomType.total) {
      return res.status(400).json({ message: "No rooms of this type left" });
    }
    const total = roomType.price ?? hostel.pricePerSemester;
    const booking = await prisma.booking.create({
      data: {
        studentId: req.userId!,
        hostelId: hostel.id,
        roomTypeId: roomType.id,
        total,
        paymentType: parsed.data.paymentType,
        status: "pending",
        escrowStatus: "held",
      },
      include: { roomType: true },
    });
    notifyUser(
      hostel.ownerId,
      "New booking request",
      `${hostel.name}: ${parsed.data.paymentType === "full" ? "full payment" : "MoMo 4x"} booking for GH₵${total.toLocaleString()}.`,
      { tab: "Owner" }
    );
    const amountPerPart = Math.ceil(total / INSTALLMENTS);
    res.status(201).json({
      ...booking,
      breakdown:
        parsed.data.paymentType === "full"
          ? { dueNow: total }
          : { dueNow: amountPerPart, plan: `${amountPerPart} x ${INSTALLMENTS} via MoMo` },
    });
  } catch (e) {
    next(e);
  }
});

/** GET /api/bookings/my — tenant dashboard. */
router.get("/my", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { studentId: req.userId! },
      include: { hostel: true, roomType: true, payments: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(bookings);
  } catch (e) {
    next(e);
  }
});

/** GET /api/bookings/owner — owner dashboard: requests on my hostels + wallet. */
router.get("/owner", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { hostel: { ownerId: req.userId! } },
      include: {
        hostel: true,
        roomType: true,
        student: { select: { id: true, phone: true, email: true, school: true } },
        payments: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    const sum = (list: typeof bookings) => list.reduce((s, b) => s + b.paidAmount, 0);
    const releasedNet = bookings
      .filter((b) => b.escrowStatus === "released")
      .reduce((s, b) => s + b.paidAmount - (b.platformFee ?? 0), 0);
    const fees = bookings
      .filter((b) => b.escrowStatus === "released")
      .reduce((s, b) => s + (b.platformFee ?? 0), 0);
    res.json({
      bookings,
      wallet: {
        held: sum(bookings.filter((b) => b.escrowStatus === "held")),
        released: releasedNet,
        fees,
        pendingCount: bookings.filter((b) => b.status === "pending").length,
      },
    });
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/bookings/:id/confirm-move-in — student confirms, triggers escrow release eligibility. */
router.patch("/:id/confirm-move-in", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const booking = await prisma.booking.findFirst({ where: { id: req.params.id, studentId: req.userId! } });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.paidAmount < booking.total) return res.status(400).json({ message: "Balance outstanding" });
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: "moved_in" } });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/bookings/:id/approve — owner accepts a request on their hostel. */
router.patch("/:id/approve", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { hostel: true } });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.hostel.ownerId !== req.userId && req.role !== "ADMIN") return res.status(403).json({ message: "Not your listing" });
    if (booking.status === "cancelled") return res.status(400).json({ message: "Booking was cancelled" });
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { ownerApproved: true } });
    notifyUser(booking.studentId, "Booking approved ✓", `${booking.hostel.name} — the owner approved your request.`, { tab: "Bookings" });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/bookings/:id/reject — owner rejects a request (frees the room). */
router.patch("/:id/reject", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { hostel: true } });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.hostel.ownerId !== req.userId && req.role !== "ADMIN") return res.status(403).json({ message: "Not your listing" });
    if (booking.status === "moved_in") return res.status(400).json({ message: "Student already moved in" });
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: "cancelled" } });
    notifyUser(booking.studentId, "Booking declined", `${booking.hostel.name} — the owner declined this request.`, { tab: "Bookings" });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/bookings/:id/cancel — student cancels own pending booking. */
router.patch("/:id/cancel", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const booking = await prisma.booking.findFirst({ where: { id: req.params.id, studentId: req.userId! } });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status === "moved_in") return res.status(400).json({ message: "Cannot cancel after move-in" });
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { status: "cancelled" } });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

export default router;
