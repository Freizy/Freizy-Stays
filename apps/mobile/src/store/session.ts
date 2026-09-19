import { create } from "zustand";
import type { UserProfile } from "@freizy-stays/shared";

interface SessionState {
  token: string | null;
  profile: UserProfile | null;
  setSession: (token: string | null, profile: UserProfile | null) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>((set) => ({
  token: null,
  profile: null,
  setSession: (token, profile) => set({ token, profile }),
  signOut: () => set({ token: null, profile: null }),
}));
