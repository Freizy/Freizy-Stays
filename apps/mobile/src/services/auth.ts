import { supabase } from "./supabase";
import { api } from "./api";
import type { UserProfile } from "@freizy-stays/shared";

/** Step 1: send SMS code. Phone must be E.164, e.g. +233201234567. */
export async function sendOtp(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw new Error(error.message);
}

/** Step 2: verify SMS code, returns Supabase access token for our API. */
export async function verifyOtp(phone: string, code: string): Promise<string> {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) throw new Error("No session returned — try again");
  return token;
}

/** Cold start: pick up an existing Supabase session, if any. */
export async function restoreToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function loadProfile(token: string): Promise<UserProfile | null> {
  try {
    return (await api.me(token)) as UserProfile;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
