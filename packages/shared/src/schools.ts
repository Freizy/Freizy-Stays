export const SCHOOLS = ["Legon", "KNUST", "UCC", "UPSA", "UDS"] as const;
export type School = (typeof SCHOOLS)[number];

export const MUST_HAVES = [
  "Water 24/7",
  "WiFi",
  "Single room",
  "Self-contained",
  "Close to campus",
  "Light",
] as const;
export type MustHave = (typeof MUST_HAVES)[number];

export const HOME_FILTER_CHIPS = [
  "Verified Only",
  "No Agent Fee",
  "MoMo Installment",
  "Close to Campus",
  "Under GH₵3000",
] as const;
export type HomeFilterChip = (typeof HOME_FILTER_CHIPS)[number];

export const BUDGET_MIN = 1500;
export const BUDGET_MAX = 10000;
