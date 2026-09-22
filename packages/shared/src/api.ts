export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: "ALL" | "STUDENT" | "OWNER";
}

export interface Payout {
  id: string;
  ownerId: string;
  bookingId: string;
  amount: number;
  status: string;
  reference: string | null;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
}

export interface SchoolInfo {
  id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
}

/** Live server distance preferred, stored distance as fallback. */
export function distKm(h: { distanceKm?: number | null; distanceToCampusKm: number | null }): number | null {
  return h.distanceKm ?? h.distanceToCampusKm;
}
