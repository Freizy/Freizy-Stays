export interface Hostel {
  id: string;
  ownerId: string;
  name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  distanceToCampusKm: number | null;
  /** Live distance from the requested school (server-computed); falls back to distanceToCampusKm. */
  distanceKm?: number | null;
  pricePerSemester: number;
  images: string[];
  videoUrl: string | null;
  amenities: string[];
  isVerified: boolean;
  lightScore: number | null;
  waterScore: number | null;
  agentFee: boolean;
  momoAllowed: boolean;
  school: string | null;
  suspended: boolean;
}

export interface HostelFilters {
  school?: string;
  verifiedOnly?: boolean;
  noAgentFee?: boolean;
  momoInstallment?: boolean;
  closeToCampus?: boolean;
  maxPrice?: number;
  search?: string;
}

export interface CreateHostelInput {
  name: string;
  location: string;
  latitude?: number;
  longitude?: number;
  pricePerSemester: number;
  images: string[];
  videoUrl?: string;
  amenities: string[];
  agentFee?: boolean;
  momoAllowed?: boolean;
  school?: string;
  lightScore?: number;
  waterScore?: number;
}

/** Full amenity catalogue for the add-hostel form (max 20). */
export const HOSTEL_AMENITIES = [
  "Water 24/7",
  "WiFi",
  "Single room",
  "Self-contained",
  "Close to campus",
  "Light",
  "Air Conditioning",
  "24/7 Security",
  "Study Room",
  "Kitchen",
  "Laundry Area",
  "Parking Space",
  "DSTV",
  "Backup Generator",
  "Balcony",
  "Wardrobe",
  "Water Heater",
  "CCTV",
  "Cleaning Service",
  "Prepaid Meter",
] as const;
export type HostelAmenity = (typeof HOSTEL_AMENITIES)[number];
