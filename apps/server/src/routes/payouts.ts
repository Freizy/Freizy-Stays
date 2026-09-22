import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router = Router();

/** GET /api/payouts/owner — my payouts with booking context. */
router.get("/owner", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    res.json(
      await prisma.payout.findMany({
        where: { ownerId: req.userId! },
        include: { booking: { include: { hostel: { select: { id: true, name: true } } } } },
        orderBy: { createdAt: "desc" },
      })
    );
  } catch (e) {
    next(e);
  }
});

export default router;
