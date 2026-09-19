import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { notifyUser } from "../services/push";

const router = Router();

/** POST /api/issues — student SOS / maintenance report. */
router.post("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const parsed = z
      .object({
        message: z.string().min(3).max(1000),
        kind: z.enum(["SOS", "REPORT"]).default("REPORT"),
        hostelId: z.string().optional(),
        bookingId: z.string().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", details: parsed.error.flatten() });

    const issue = await prisma.issue.create({
      data: {
        studentId: req.userId!,
        message: parsed.data.message,
        kind: parsed.data.kind,
        hostelId: parsed.data.hostelId,
        bookingId: parsed.data.bookingId,
      },
    });
    res.status(201).json(issue);
    if (parsed.data.hostelId) {
      const hostel = await prisma.hostel.findUnique({ where: { id: parsed.data.hostelId }, select: { ownerId: true, name: true } });
      if (hostel) {
        notifyUser(
          hostel.ownerId,
          parsed.data.kind === "SOS" ? "🆘 SOS report" : "New issue report",
          `${hostel.name}: ${parsed.data.message.slice(0, 120)}`,
          { tab: "Owner" }
        );
      }
    }
  } catch (e) {
    next(e);
  }
});

/** GET /api/issues/mine — student's own reports. */
router.get("/mine", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    res.json(
      await prisma.issue.findMany({
        where: { studentId: req.userId! },
        include: { hostel: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      })
    );
  } catch (e) {
    next(e);
  }
});

/** GET /api/issues/owner — open-first issues on my hostels. */
router.get("/owner", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    res.json(
      await prisma.issue.findMany({
        where: { hostel: { ownerId: req.userId! } },
        include: {
          hostel: { select: { id: true, name: true } },
          student: { select: { id: true, phone: true, email: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      })
    );
  } catch (e) {
    next(e);
  }
});

/** PATCH /api/issues/:id/resolve — owner of the hostel or admin. */
router.patch("/:id/resolve", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const issue = await prisma.issue.findUnique({ where: { id: req.params.id }, include: { hostel: true } });
    if (!issue) return res.status(404).json({ message: "Issue not found" });
    if (issue.hostel && issue.hostel.ownerId !== req.userId && req.role !== "ADMIN") {
      return res.status(403).json({ message: "Not your listing" });
    }
    res.json(await prisma.issue.update({ where: { id: issue.id }, data: { status: "resolved" } }));
  } catch (e) {
    next(e);
  }
});

export default router;
