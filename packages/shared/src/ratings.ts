export interface Rating {
  id: string;
  bookingId: string;
  hostelId: string;
  studentId: string;
  waterScore: number;
  lightScore: number;
  comment: string | null;
}

export interface CreateRatingInput {
  bookingId: string;
  waterScore: number;
  lightScore: number;
  comment?: string;
}

export type IssueKind = "SOS" | "REPORT";

export interface Issue {
  id: string;
  studentId: string;
  hostelId: string | null;
  bookingId: string | null;
  kind: IssueKind;
  message: string;
  status: "open" | "resolved";
}

export interface CreateIssueInput {
  message: string;
  kind: IssueKind;
  hostelId?: string;
  bookingId?: string;
}
