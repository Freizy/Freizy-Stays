import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole, type AuthedRequest } from "../middlewares/requireAuth";
import { parseSearchQuery } from "../services/search";
import { schoolCoordsFor, withDistance } from "../services/hostelDist";

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
        // Suspended listings are invisible to students/owners (admin fetches via /admin/hostels).
        suspended: false,
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
    const coords = await schoolCoordsFor(effSchool ?? preferSchool);
    const data = withDistance(hostels, coords);
    res.json({
      data,
      total: data.length,
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

/** GET /api/hostels/:id — detail with live distance (?school= overrides hostel.school). */
router.get("/:id", async (req, res, next) => {
  try {
    const hostel = await prisma.hostel.findUnique({ where: { id: req.params.id } });
    if (!hostel) return res.status(404).json({ message: "Hostel not found" });
    const { school } = req.query as { school?: string };
    const coords = await schoolCoordsFor(school ?? hostel.school);
    const [withD] = withDistance([hostel], coords);
    res.json({ ...withD, schoolCoords: coords });
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
  lightScore: z.number().min(0).max(5).optional(),
  waterScore: z.number().min(0).max(5).optional(),
});

/** POST /api/hostels — owner adds listing. */
router.post("/", requireAuth, requireRole("OWNER", "ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", details: parsed.error.flatten() });
    // Normalize location: "Madina" + Legon → "Madina, Accra" (skip if city already present).
    let location = parsed.data.location.trim();
    if (parsed.data.school) {
      const schoolRow = await prisma.school.findUnique({ where: { name: parsed.data.school } });
      if (schoolRow && !location.toLowerCase().includes(schoolRow.city.toLowerCase())) {
        location = `${location}, ${schoolRow.city}`;
      }
    }
    const hostel = await prisma.hostel.create({ data: { ...parsed.data, location, ownerId: req.userId! } });
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
