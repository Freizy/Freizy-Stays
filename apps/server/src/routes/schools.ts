import { Router } from "express";
import { prisma } from "../config/prisma";

const router = Router();

/** GET /api/schools — public list for pickers and maps. */
router.get("/", async (_req, res, next) => {
  try {
    res.json(await prisma.school.findMany({ orderBy: { name: "asc" } }));
  } catch (e) {
    next(e);
  }
});

export default router;
