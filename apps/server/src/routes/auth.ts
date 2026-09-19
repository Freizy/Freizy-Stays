import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router = Router();

/** GET /api/auth/me — returns local profile for the Supabase user. */
router.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

const updateMeSchema = z.object({
  role: z.enum(["STUDENT", "OWNER"]).optional(),
  school: z.string().optional(),
  budget: z.number().int().min(1500).max(10000).optional(),
  mustHaves: z.array(z.string()).optional(),
});

/** PATCH /api/auth/me — onboarding: role, school, budget, must-haves. */
router.patch("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const parsed = updateMeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", details: parsed.error.flatten() });
    const user = await prisma.user.update({ where: { id: req.userId! }, data: parsed.data });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

/** POST /api/auth/push-token — register Expo push token for this user. */
router.post("/push-token", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const parsed = z.object({ pushToken: z.string().min(10) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    res.json(await prisma.user.update({ where: { id: req.userId! }, data: { pushToken: parsed.data.pushToken } }));
  } catch (e) {
    next(e);
  }
});

export default router;
