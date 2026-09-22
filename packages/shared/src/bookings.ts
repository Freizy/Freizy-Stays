export type BookingStatus = "pending" | "paid" | "moved_in" | "cancelled";
export type EscrowStatus = "held" | "released" | "refunded";
export type PaymentType = "full" | "installment";

export interface Booking {
  id: string;
  studentId: string;
  hostelId: string;
  total: number;
  paidAmount: number;
  paymentType: PaymentType;
  status: BookingStatus;
  escrowStatus: EscrowStatus;
  ownerApproved: boolean;
  roomTypeId?: string | null;
  installmentPlan?: {
    totalParts: 4;
    paidParts: number;
    amountPerPart: number;
  };
}

export interface CreateBookingInput {
  hostelId: string;
  paymentType: PaymentType;
  roomTypeId: string;
}
