import type { BookingStatus } from "@prisma/client";
import { prisma } from "../config/prisma";

export const ACTIVE_BOOKING: BookingStatus[] = ["pending", "paid", "moved_in"];

export interface TypeAvailability {
  id: string;
  hostelId: string;
  kind: string;
  capacity: number;
  total: number;
  price: number | null;
  available: number;
}

/** Live availability per room type. Hostels with no types return [] (legacy grace). */
export async function availabilityFor(hostelIds: string[]): Promise<Record<string, TypeAvailability[]>> {
  if (!hostelIds.length) return {};
  const types = await prisma.roomType.findMany({
    where: { hostelId: { in: hostelIds } },
    include: { _count: { select: { bookings: { where: { status: { in: ACTIVE_BOOKING } } } } } },
  });
  const map: Record<string, TypeAvailability[]> = {};
  for (const t of types) {
    const { _count, ...rest } = t;
    (map[t.hostelId] ??= []).push({ ...rest, available: Math.max(0, t.total - _count.bookings) });
  }
  return map;
}

export function withAvailability<T extends { id: string }>(
  hostels: T[],
  avail: Record<string, TypeAvailability[]>
): (T & { roomTypes: TypeAvailability[]; totalAvailable: number; hasRoomTypes: boolean })[] {
  return hostels.map((h) => {
    const types = avail[h.id] ?? [];
    return {
      ...h,
      roomTypes: types,
      totalAvailable: types.reduce((s, t) => s + t.available, 0),
      hasRoomTypes: types.length > 0,
    };
  });
}
