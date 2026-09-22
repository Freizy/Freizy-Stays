import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole, type AuthedRequest } from "../middlewares/requireAuth";
import { parseSearchQuery } from "../services/search";
import { schoolCoordsFor, withDistance } from "../services/hostelDist";
import { availabilityFor, withAvailability, ACTIVE_BOOKING } from "../services/availability";
import { feeAmountFor, hasPaidAccessFee } from "../services/accessFee";

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
    const avail = await availabilityFor(hostels.map((h) => h.id));
    const stocked = withAvailability(hostels, avail).filter((h) => !h.hasRoomTypes || h.totalAvailable > 0);
    const data = withDistance(stocked, coords);
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
    const avail = await availabilityFor([hostel.id]);
    const [withD] = withDistance(withAvailability([hostel], avail), coords);
    res.json({ ...withD, schoolCoords: coords });
  } catch (e) {
    next(e);
  }
});

const roomTypeInput = z.object({
  id: z.string().optional(),
  kind: z.enum(["single", "shared"]),
  capacity: z.number().int().min(1).max(4),
  total: z.number().int().min(0).max(200),
  price: z.number().int().positive().optional(),
});

function roomLabel(t: { kind: string; capacity: number }): string {
  return t.kind === "single" ? "Single" : `Shared (${t.capacity})`;
}

async function activeCount(roomTypeId: string): Promise<number> {
  return prisma.booking.count({ where: { roomTypeId, status: { in: ACTIVE_BOOKING } } });
}

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
  roomTypes: z.array(roomTypeInput).min(1).max(4),
});

/** POST /api/hostels — owner adds listing. */
router.post("/", requireAuth, requireRole("OWNER", "ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", details: parsed.error.flatten() });
    const need = feeAmountFor(req.role);
    if (need != null && !(await hasPaidAccessFee(req.userId!))) {
      return res.status(402).json({ message: `Pay the one-time GH₵${need} owner fee to list.`, code: "ACCESS_FEE_REQUIRED", amount: need });
    }
    // Normalize location: "Madina" + Legon → "Madina, Accra" (skip if city already present).
    let location = parsed.data.location.trim();
    if (parsed.data.school) {
      const schoolRow = await prisma.school.findUnique({ where: { name: parsed.data.school } });
      if (schoolRow && !location.toLowerCase().includes(schoolRow.city.toLowerCase())) {
        location = `${location}, ${schoolRow.city}`;
      }
    }
    if (parsed.data.roomTypes.reduce((s, t) => s + t.total, 0) < 1) {
      return res.status(400).json({ message: "Add at least 1 room" });
    }
    for (const t of parsed.data.roomTypes) {
      if (t.kind === "single" && t.capacity !== 1) return res.status(400).json({ message: "Single rooms hold 1 person" });
      if (t.total < 1) return res.status(400).json({ message: "Each room type needs at least 1 room" });
    }
    const { roomTypes, ...rest } = parsed.data;
    const hostel = await prisma.hostel.create({
      data: {
        ...rest,
        location,
        ownerId: req.userId!,
        roomTypes: { create: roomTypes.map((t) => ({ kind: t.kind, capacity: t.capacity, total: t.total, price: t.price ?? null })) },
      },
    });
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
    const avail = await availabilityFor(mine.map((h) => h.id));
    res.json(withAvailability(mine, avail));
  } catch (e) {
    next(e);
  }
});

const ownerUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  location: z.string().min(2).optional(),
  pricePerSemester: z.number().int().positive().optional(),
  amenities: z.array(z.string()).optional(),
  agentFee: z.boolean().optional(),
  momoAllowed: z.boolean().optional(),
  roomTypes: z.array(roomTypeInput).max(4).optional(),
});

/** PATCH /api/hostels/mine/:id — owner edits own listing + room inventory. */
router.patch("/mine/:id", requireAuth, requireRole("OWNER", "ADMIN"), async (req: AuthedRequest, res, next) => {
  try {
    const parsed = ownerUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body", details: parsed.error.flatten() });
    const hostel =
      req.role === "ADMIN"
        ? await prisma.hostel.findUnique({ where: { id: req.params.id } })
        : await prisma.hostel.findFirst({ where: { id: req.params.id, ownerId: req.userId! } });
    if (!hostel) return res.status(404).json({ message: "Listing not found" });

    const { roomTypes, ...scalars } = parsed.data;
    if (scalars.location) {
      let loc = scalars.location.trim();
      if (hostel.school) {
        const sr = await prisma.school.findUnique({ where: { name: hostel.school } });
        if (sr && !loc.toLowerCase().includes(sr.city.toLowerCase())) loc = `${loc}, ${sr.city}`;
      }
      scalars.location = loc;
    }
    if (Object.keys(scalars).length) {
      await prisma.hostel.update({ where: { id: hostel.id }, data: scalars });
    }

    if (roomTypes) {
      const existing = await prisma.roomType.findMany({ where: { hostelId: hostel.id } });
      const counts = await Promise.all(existing.map((t) => activeCount(t.id)));
      const activeOf = (id: string) => counts[existing.findIndex((t) => t.id === id)] ?? 0;
      for (const rt of roomTypes) {
        if (rt.kind === "single" && rt.capacity !== 1) return res.status(400).json({ message: "Single rooms hold 1 person" });
        if (rt.id) {
          const cur = existing.find((t) => t.id === rt.id);
          if (!cur) return res.status(400).json({ message: "Unknown room type" });
          if (rt.total < activeOf(rt.id)) {
            return res.status(400).json({ message: `${roomLabel(rt)} has ${activeOf(rt.id)} active booking(s) — can't go below that` });
          }
        }
      }
      const seen = new Set<string>();
      for (const rt of roomTypes) {
        if (rt.id) {
          seen.add(rt.id);
          await prisma.roomType.update({ where: { id: rt.id }, data: { kind: rt.kind, capacity: rt.capacity, total: rt.total, price: rt.price ?? null } });
        } else if (rt.total > 0) {
          const c = await prisma.roomType.create({
            data: { hostelId: hostel.id, kind: rt.kind, capacity: rt.capacity, total: rt.total, price: rt.price ?? null },
          });
          seen.add(c.id);
        }
      }
      for (const cur of existing) {
        if (!seen.has(cur.id)) {
          if (activeOf(cur.id) > 0) return res.status(400).json({ message: `${roomLabel(cur)} has active bookings — cannot remove it` });
          await prisma.roomType.delete({ where: { id: cur.id } });
        }
      }
    }

    const updated = await prisma.hostel.findUnique({ where: { id: hostel.id }, include: { roomTypes: true } });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

export default router;
