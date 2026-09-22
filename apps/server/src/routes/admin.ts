import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole, type AuthedRequest } from "../middlewares/requireAuth";
import { notifyUser, sendPush } from "../services/push";
import { audit } from "../services/audit";
import { HttpError } from "../services/errors";

const router = Router();

export const PLATFORM_FEE_BPS = 500; // 5% platform cut on every escrow release

export const VERIFY_CHECKLIST = [
  "Photos verified (5+ real photos)",
  "Video tour reviewed",
  "Location pin confirmed",
  "Price within area norm",
  "Owner contact confirmed",
];

/** Public notices feed — must stay above the ADMIN gate below. */
router.get("/announcements/feed", async (req, res, next) => {
  try {
    const { audience } = req.query as { audience?: string };
    const roles = audience === "STUDENT" || audience === "OWNER" ? (["ALL", audience] as string[]) : ["ALL"];
    res.json(
      await prisma.announcement.findMany({
        where: { audience: { in: roles } },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    );
  } catch (e) {
    next(e);
  }
});

router.use(requireAuth, requireRole("ADMIN"));

/* ---------- hostels: verify + moderate ---------- */

/** PATCH /api/admin/hostels/:id/verify — green badge; turning ON requires the full checklist. */
router.patch("/hostels/:id/verify", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = z.object({ isVerified: z.boolean(), checklist: z.array(z.string()).optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    const { isVerified, checklist = [] } = parsed.data;
    if (isVerified) {
      const missing = VERIFY_CHECKLIST.filter((c) => !checklist.includes(c));
      if (missing.length) return res.status(400).json({ message: "Checklist incomplete", missing });
    }
    const hostel = await prisma.hostel.update({
      where: { id: req.params.id },
      data: {
        isVerified,
        verificationChecklist: checklist,
        verifiedAt: isVerified ? new Date() : null,
        verifiedBy: isVerified ? req.userId! : null,
      },
    });
    await audit(req.userId!, req.role, isVerified ? "hostel.verify" : "hostel.unverify", "hostel", hostel.id, { checklist });
    res.json(hostel);
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/admin/hostels/:id — moderate name/location/price/amenities. */
router.patch("/hostels/:id", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = z
      .object({
        name: z.string().min(2).optional(),
        location: z.string().min(2).optional(),
        pricePerSemester: z.number().int().positive().optional(),
        amenities: z.array(z.string()).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    const hostel = await prisma.hostel.update({ where: { id: req.params.id }, data: parsed.data });
    await audit(req.userId!, req.role, "hostel.edit", "hostel", hostel.id, parsed.data as Record<string, unknown>);
    res.json(hostel);
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/admin/hostels/:id — blocked while active bookings exist. */
router.delete("/hostels/:id", async (req: AuthedRequest, res, next) => {
  try {
    const active = await prisma.booking.count({
      where: { hostelId: req.params.id, status: { notIn: ["cancelled"] } },
    });
    if (active > 0) return res.status(400).json({ message: `Has ${active} active booking(s) — cancel them first` });
    await prisma.hostel.delete({ where: { id: req.params.id } });
    await audit(req.userId!, req.role, "hostel.delete", "hostel", req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------- bookings, escrow, refunds ---------- */

/** GET /api/admin/bookings — view all bookings with escrow status. */
router.get("/bookings", async (_req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: { hostel: true, student: true, roomType: true, payments: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(bookings);
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/admin/bookings/:id/release — release escrow (5% fee) after move-in confirm. Idempotent. */
router.patch("/bookings/:id/release", async (req: AuthedRequest, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { hostel: { select: { ownerId: true, name: true } } },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "moved_in") return res.status(400).json({ message: "Student must confirm move-in first" });
    if (booking.escrowStatus === "released") return res.status(400).json({ message: "Already released" });

    const fee = Math.round((booking.paidAmount * PLATFORM_FEE_BPS) / 10000);
    // Atomic release + payout record; the row lock makes double-release impossible.
    const { updated, payout } = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "bookings" WHERE id = ${booking.id} FOR UPDATE`;
      const fresh = await tx.booking.findUnique({ where: { id: booking.id } });
      if (!fresh || fresh.escrowStatus === "released") throw new HttpError(400, "Already released");
      const upd = await tx.booking.update({
        where: { id: booking.id },
        data: { escrowStatus: "released", platformFee: fee },
      });
      let p = await tx.payout.findFirst({ where: { bookingId: booking.id } });
      if (!p) {
        p = await tx.payout.create({
          data: { ownerId: booking.hostel.ownerId, bookingId: booking.id, amount: booking.paidAmount - fee, status: "pending" },
        });
      }
      return { updated: upd, payout: p };
    });
    notifyUser(
      booking.hostel.ownerId,
      "Escrow released 💰",
      `${booking.hostel.name}: GH₵${(booking.paidAmount - fee).toLocaleString()} net (GH₵${fee.toLocaleString()} Freizy fee).`,
      { tab: "Owner" }
    );
    await audit(req.userId!, req.role, "escrow.release", "booking", booking.id, { fee, net: booking.paidAmount - fee });
    res.json({ booking: updated, payout, fee });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ message: e.message });
    next(e);
  }
});

/** PATCH /api/admin/bookings/:id/refund — mark escrow refunded (manual MoMo reversal in pilot). */
router.patch("/bookings/:id/refund", async (req: AuthedRequest, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.paidAmount <= 0) return res.status(400).json({ message: "Nothing paid to refund" });
    if (booking.escrowStatus !== "held") return res.status(400).json({ message: `Escrow is ${booking.escrowStatus}, not held` });
    if (booking.status === "moved_in") return res.status(400).json({ message: "Student already moved in" });
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { escrowStatus: "refunded", status: "cancelled" },
    });
    notifyUser(booking.studentId, "Refund marked ↩️", `GH₵${booking.paidAmount.toLocaleString()} refund for booking ${booking.id.slice(0, 8)}.`, {
      tab: "Bookings",
    });
    await audit(req.userId!, req.role, "escrow.refund", "booking", booking.id, { amount: booking.paidAmount });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

/* ---------- payouts ---------- */

/** GET /api/admin/payouts — all owner payouts, pending first. */
router.get("/payouts", async (_req, res, next) => {
  try {
    res.json(
      await prisma.payout.findMany({
        include: { owner: { select: { id: true, phone: true, email: true } }, booking: { include: { hostel: true } } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      })
    );
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/admin/payouts/:id/pay — mark paid after manual MoMo disbursement. */
router.patch("/payouts/:id/pay", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = z.object({ reference: z.string().min(2).optional() }).safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    const payout = await prisma.payout.update({
      where: { id: req.params.id },
      data: { status: "paid", reference: parsed.data.reference ?? null },
    });
    notifyUser(payout.ownerId, "Payout sent 💸", `GH₵${payout.amount.toLocaleString()} disbursed${payout.reference ? ` (ref ${payout.reference})` : ""}.`, {
      tab: "Owner",
    });
    await audit(req.userId!, req.role, "payout.pay", "payout", payout.id, { amount: payout.amount, reference: payout.reference });
    res.json(payout);
  } catch (e) {
    next(e);
  }
});

/* ---------- users ---------- */

/** GET /api/admin/users?search=&role= — manage accounts. */
router.get("/users", async (req, res, next) => {
  try {
    const { search, role } = req.query as { search?: string; role?: string };
    res.json(
      await prisma.user.findMany({
        where: {
          ...(role && ["STUDENT", "OWNER", "ADMIN"].includes(role) ? { role: role as "STUDENT" | "OWNER" | "ADMIN" } : {}),
          ...(search
            ? { OR: [{ email: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }] }
            : {}),
        },
        select: { id: true, phone: true, email: true, role: true, school: true, suspended: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    );
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/admin/users/:id/role — change role (never your own). */
router.patch("/users/:id/role", async (req: AuthedRequest, res, next) => {
  try {
    if (req.params.id === req.userId) return res.status(400).json({ message: "Cannot change your own role" });
    const parsed = z.object({ role: z.enum(["STUDENT", "OWNER", "ADMIN"]) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role: parsed.data.role } });
    await audit(req.userId!, req.role, "user.role", "user", user.id, { role: user.role });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/admin/users/:id/suspend — suspend/unsuspend (never yourself). */
router.patch("/users/:id/suspend", async (req: AuthedRequest, res, next) => {
  try {
    if (req.params.id === req.userId) return res.status(400).json({ message: "Cannot suspend yourself" });
    const parsed = z.object({ suspended: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { suspended: parsed.data.suspended } });
    await audit(req.userId!, req.role, parsed.data.suspended ? "user.suspend" : "user.unsuspend", "user", user.id);
    res.json(user);
  } catch (e) {
    next(e);
  }
});

/* ---------- disputes ---------- */

/** GET /api/admin/issues — escalated + open first, with context. */
router.get("/issues", async (_req, res, next) => {
  try {
    const issues = await prisma.issue.findMany({
      include: {
        hostel: { select: { id: true, name: true } },
        student: { select: { id: true, phone: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const rank = (s: string) => (s === "escalated" ? 0 : s === "open" ? 1 : 2);
    res.json([...issues].sort((a, b) => rank(a.status) - rank(b.status)));
  } catch (e) {
    next(e);
  }
});

/* ---------- announcements ---------- */

/** POST /api/admin/announcements — publish + push to audience. */
router.post("/announcements", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = z
      .object({ title: z.string().min(3).max(120), body: z.string().min(3).max(1000), audience: z.enum(["ALL", "STUDENT", "OWNER"]).default("ALL") })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", details: parsed.error.flatten() });
    const ann = await prisma.announcement.create({ data: { ...parsed.data, createdBy: req.userId! } });
    const targets = await prisma.user.findMany({
      where: {
        pushToken: { not: null },
        ...(parsed.data.audience === "ALL" ? {} : { role: parsed.data.audience as "STUDENT" | "OWNER" }),
      },
      select: { pushToken: true },
    });
    await sendPush(
      targets.flatMap((t) => (t.pushToken ? [{ to: t.pushToken, title: `📢 ${parsed.data.title}`, body: parsed.data.body }] : []))
    );
    await audit(req.userId!, req.role, "announcement.publish", "announcement", ann.id, { audience: ann.audience });
    res.status(201).json(ann);
  } catch (e) {
    next(e);
  }
});

/** GET /api/admin/announcements — all, newest first. */
router.get("/announcements", async (_req, res, next) => {
  try {
    res.json(await prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 50 }));
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/admin/announcements/:id */
router.delete("/announcements/:id", async (req: AuthedRequest, res, next) => {
  try {
    await prisma.announcement.delete({ where: { id: req.params.id } });
    await audit(req.userId!, req.role, "announcement.delete", "announcement", req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------- stats + audit ---------- */

/** GET /api/admin/stats — pilot analytics. */
router.get("/stats", async (_req, res, next) => {
  try {
    const [users, hostels, bookings, payouts, issues] = await Promise.all([
      prisma.user.findMany({ select: { role: true } }),
      prisma.hostel.findMany({ select: { isVerified: true, createdAt: true, verifiedAt: true } }),
      prisma.booking.findMany({ select: { status: true, escrowStatus: true, paidAmount: true, platformFee: true } }),
      prisma.payout.findMany({ select: { status: true, amount: true } }),
      prisma.issue.findMany({ select: { status: true } }),
    ]);
    const live = bookings.filter((b) => (b.status as string) !== "cancelled");
    const verifyTimes = hostels
      .filter((h) => h.isVerified && h.verifiedAt)
      .map((h) => h.verifiedAt!.getTime() - h.createdAt.getTime());
    res.json({
      users: { total: users.length, students: users.filter((u) => u.role === "STUDENT").length, owners: users.filter((u) => u.role === "OWNER").length, admins: users.filter((u) => u.role === "ADMIN").length },
      hostels: { total: hostels.length, verified: hostels.filter((h) => h.isVerified).length },
      bookings: { total: bookings.length, pending: bookings.filter((b) => b.status === "pending").length, paid: bookings.filter((b) => b.status === "paid").length, movedIn: bookings.filter((b) => b.status === "moved_in").length },
      money: {
        gmv: live.reduce((s, b) => s + b.paidAmount, 0),
        held: bookings.filter((b) => b.escrowStatus === "held").reduce((s, b) => s + b.paidAmount, 0),
        released: bookings.filter((b) => b.escrowStatus === "released").reduce((s, b) => s + b.paidAmount, 0),
        fees: bookings.reduce((s, b) => s + (b.platformFee ?? 0), 0),
      },
      payouts: { pending: payouts.filter((p) => p.status === "pending").length, pendingAmount: payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0) },
      issues: { open: issues.filter((i) => i.status === "open" || i.status === "escalated").length },
      occupancy: hostels.length ? Math.round((live.filter((b) => b.status === "paid" || b.status === "moved_in").length / Math.max(hostels.length, 1)) * 100) / 100 : 0,
      avgVerifyHours: verifyTimes.length ? Math.round(verifyTimes.reduce((s, t) => s + t, 0) / verifyTimes.length / 3600000) : null,
    });
  } catch (e) {
    next(e);
  }
});

/** GET /api/admin/audit — latest staff actions. */
router.get("/audit", async (_req, res, next) => {
  try {
    res.json(await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 150 }));
  } catch (e) {
    next(e);
  }
});

/** GET /api/admin/schools — all schools with hostel counts. */
router.get("/schools", async (_req, res, next) => {
  try {
    const [schools, counts] = await Promise.all([
      prisma.school.findMany({ orderBy: { name: "asc" } }),
      prisma.hostel.groupBy({ by: ["school"], _count: { _all: true } }),
    ]);
    const map: Record<string, number> = {};
    counts.forEach((c) => {
      if (c.school) map[c.school] = c._count._all;
    });
    res.json(schools.map((s) => ({ ...s, hostelCount: map[s.name] ?? 0 })));
  } catch (e) {
    next(e);
  }
});

/** POST /api/admin/schools — add a school with map location. */
router.post("/schools", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = z
      .object({ name: z.string().min(2).max(60), city: z.string().min(2).max(60), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", details: parsed.error.flatten() });
    const school = await prisma.school.create({ data: parsed.data });
    await audit(req.userId!, req.role, "school.create", "school", school.id, { name: school.name });
    res.status(201).json(school);
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/admin/schools/:id — edit; renaming re-links hostels. */
router.patch("/schools/:id", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = z
      .object({ name: z.string().min(2).max(60).optional(), city: z.string().min(2).max(60).optional(), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional() })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    const before = await prisma.school.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ message: "School not found" });
    const school = await prisma.school.update({ where: { id: req.params.id }, data: parsed.data });
    if (parsed.data.name && parsed.data.name !== before.name) {
      await prisma.hostel.updateMany({ where: { school: before.name }, data: { school: parsed.data.name } });
    }
    await audit(req.userId!, req.role, "school.edit", "school", school.id, parsed.data as Record<string, unknown>);
    res.json(school);
  } catch (e) {
    next(e);
  }
});

/** DELETE /api/admin/schools/:id — blocked while hostels reference it. */
router.delete("/schools/:id", async (req: AuthedRequest, res, next) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: req.params.id } });
    if (!school) return res.status(404).json({ message: "School not found" });
    const used = await prisma.hostel.count({ where: { school: school.name } });
    if (used > 0) return res.status(400).json({ message: `${used} hostel(s) use this school — reassign them first` });
    await prisma.school.delete({ where: { id: school.id } });
    await audit(req.userId!, req.role, "school.delete", "school", school.id, { name: school.name });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/** GET /api/admin/hostels — everything including suspended. */
router.get("/hostels", async (_req, res, next) => {
  try {
    res.json(await prisma.hostel.findMany({ orderBy: { createdAt: "desc" }, take: 100 }));
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/admin/hostels/:id/suspend — hide from students/owners (feed filters it). */
router.patch("/hostels/:id/suspend", async (req: AuthedRequest, res, next) => {
  try {
    const parsed = z.object({ suspended: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    const hostel = await prisma.hostel.update({ where: { id: req.params.id }, data: { suspended: parsed.data.suspended } });
    await audit(req.userId!, req.role, parsed.data.suspended ? "hostel.suspend" : "hostel.restore", "hostel", hostel.id);
    res.json(hostel);
  } catch (e) {
    next(e);
  }
});

export default router;
