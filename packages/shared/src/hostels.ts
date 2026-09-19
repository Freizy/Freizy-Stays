export interface Hostel {
  id: string;
  ownerId: string;
  name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  distanceToCampusKm: number | null;
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
}
