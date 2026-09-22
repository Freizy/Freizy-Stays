export type PaymentProvider = "MTN_MOMO" | "VODAFONE_CASH" | "CARD";
export type PaymentStatus = "initiated" | "pending" | "success" | "failed";

export interface Payment {
  id: string;
  bookingId: string;
  provider: PaymentProvider;
  amount: number;
  status: PaymentStatus;
  reference: string;
}

export const ESCROW_COPY =
  "Your money is safe with Freizy. Owner gets paid only after you move in and confirm.";

/** One-time onboarding fee per role (GHS). Required before first booking (student) / listing (owner). */
export const ACCESS_FEE_GHS = {
  STUDENT: 50,
  OWNER: 100,
} as const;

export type AccessFeeStatus = "initiated" | "pending" | "success" | "failed";
