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
