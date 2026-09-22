import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole, type AuthedRequest } from "../middlewares/requireAuth";
import { parseSearchQuery } from "../services/search";

const router = Router();

/** GET /api/hostels?school=&verifiedOnly&noAgentFee&momo&maxPrice=&search= (search is natural-language parsed) */
router.get("/", async (req, res, next) => {
  try {
    const { school, verifiedOnly, noAgentFee, momo, maxPrice, search, preferSchool } = req.query as Record<string, string | undefined>;
    const parsed = parseSearchQuery(search);
    const effSchool = school ?? parsed.school;
    const effMax = maxPrice ? Number(maxPrice) : parsed.maxPrice;
    const effNoFee = noAgentFee === "true" || parsed.noAgentFee;
    const effVerified = verifiedOnly === "true" || parsed.verifiedOnly;
    const effMomo = momo === "true" || parsed.momoOnly;
    const effClose = parsed.closeToCampus;
    const unordered = await prisma.hostel.findMany({
      where: {
        ...(effSchool ? { school: effSchool } : {}),
        ...(effVerified ? { isVerified: true } : {}),
        ...(effNoFee ? { agentFee: false } : {}),
        ...(effMomo ? { momoAllowed: true } : {}),
        ...(effClose ? { distanceToCampusKm: { lte: 2 } } : {}),
        ...(effMax ? { pricePerSemester: { lte: effMax } } : {}),
        ...(parsed.amenities.length ? { amenities: { hasSome: parsed.amenities } } : {}),
        ...(parsed.text.length
          ? {
              AND: parsed.text.map((w) => ({
                OR: [{ name: { contains: w, mode: "insensitive" } }, { location: { contains: w, mode: "insensitive" } }],
              })),
            }
          : {}),
      },
      orderBy: [{ isVerified: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
    // Preferred school first, then verified, nearest, newest.
    const prefer = preferSchool || "";
    const hostels = [...unordered].sort(
      (a, b) =>
        (prefer ? Number((b.school ?? "") === prefer) - Number((a.school ?? "") === prefer) : 0) ||
        Number(b.isVerified) - Number(a.isVerified) ||
        (a.distanceToCampusKm ?? 999) - (b.distanceToCampusKm ?? 999) ||
        b.createdAt.getTime() - a.createdAt.getTime()
    );
    res.json({
      data: hostels,
      total: hostels.length,
      applied: {
        ...(effMax ? { maxPrice: effMax } : {}),
        ...(effSchool ? { school: effSchool } : {}),
        ...(parsed.amenities.length ? { amenities: parsed.amenities } : {}),
        ...(effNoFee ? { noAgentFee: true } : {}),
        ...(effVerified ? { verifiedOnly: true } : {}),
        ...(effMomo ? { momoOnly: true } : {}),
        ...(effClose ? { closeToCampus: true } : {}),
        ...(parsed.text.length ? { keywords: parsed.text } : {}),
      },
    });
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
