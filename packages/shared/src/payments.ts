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
