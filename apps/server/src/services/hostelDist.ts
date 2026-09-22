import { prisma } from "../config/prisma";
import { haversineKm } from "./geo";

export interface SchoolCoords {
  name: string;
  latitude: number;
  longitude: number;
}

export async function schoolCoordsFor(name?: string | null): Promise<SchoolCoords | null> {
  if (!name) return null;
  const s = await prisma.school.findUnique({ where: { name } });
  return s ? { name: s.name, latitude: s.latitude, longitude: s.longitude } : null;
}

type Locatable = { latitude: number | null; longitude: number | null; distanceToCampusKm: number | null };

/** Attach live distanceKm from the school (haversine) or fall back to stored distance. */
export function withDistance<T extends Locatable>(
  list: T[],
  coords: SchoolCoords | null
): (T & { distanceKm: number | null })[] {
  return list.map((h) => ({
    ...h,
    distanceKm:
      coords && h.latitude != null && h.longitude != null
        ? haversineKm(coords.latitude, coords.longitude, h.latitude, h.longitude)
        : (h.distanceToCampusKm ?? null),
  }));
}
