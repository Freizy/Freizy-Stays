import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "anon";

export const supabase = createClient(url, anon);
