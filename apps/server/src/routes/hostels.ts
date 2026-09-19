import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole, type AuthedRequest } from "../middlewares/requireAuth";

const router = Router();

/** GET /api/hostels?school=Legon&verifiedOnly&noAgentFee&momo&maxPrice=3000&search= */
router.get("/", async (req, res, next) => {
  try {
    const { school, verifiedOnly, noAgentFee, momo, maxPrice, search } = req.query as Record<string, string | undefined>;
    const hostels = await prisma.hostel.findMany({
      where: {
        ...(school ? { school } : {}),
        ...(verifiedOnly === "true" ? { isVerified: true } : {}),
        ...(noAgentFee === "true" ? { agentFee: false } : {}),
        ...(momo === "true" ? { momoAllowed: true } : {}),
        ...(maxPrice ? { pricePerSemester: { lte: Number(maxPrice) } } : {}),
        ...(search
          ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { location: { contains: search, mode: "insensitive" } }] }
          : {}),
      },
      orderBy: [{ isVerified: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
    res.json({ data: hostels, total: hostels.length });
  } catch (e) {
    next(e);
  }
});

/** GET /api/hostels/:id */
router.get("/:id", async (req, res, next) => {
  try {
    const hostel = await prisma.hostel.findUnique({ where: { id: req.params.id } });
    if (!hostel) return res.status(404).json({ message: "Hostel not found" });
    res.json(hostel);
  } catch (e) {
    next(e);
  }
});

const createSchema = z.object({
  name: z.string().min(2),
  location: z.string().min(2),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  pricePerSemester: z.number().int().positive(),
  images: z.array(z.string().url()).min(5, "Min 5 photos required"),
  videoUrl: z.string().url().optional(),
  amenities: z.array(z.string()).default([]),
  agentFee: z.boolean().default(false),
  momoAllowed: z.boolean().default(true),
  school: z.string().optional(),
});

/** POST /api/hostels — owner adds listing. */
router.post("/", requireAuth, requireRole("OWNER", "ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", details: parsed.error.flatten() });
    const hostel = await prisma.hostel.create({ data: { ...parsed.data, ownerId: req.userId! } });
    res.status(201).json(hostel);
  } catch (e) {
    next(e);
  }
});

/** GET /api/hostels/owner/mine — owner dashboard listings. */
router.get("/owner/mine", requireAuth, requireRole("OWNER", "ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const mine = await prisma.hostel.findMany({
      where: { ownerId: req.userId! },
      include: { _count: { select: { bookings: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(mine);
  } catch (e) {
    next(e);
  }
});

export default router;
