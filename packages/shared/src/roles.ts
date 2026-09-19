export const ROLES = ["STUDENT", "OWNER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export interface UserProfile {
  id: string;
  phone: string | null;
  email: string | null;
  role: Role;
  school: string | null;
  budget: number | null;
  mustHaves: string[];
}
