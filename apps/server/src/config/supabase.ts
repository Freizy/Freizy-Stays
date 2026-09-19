import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

if (!env.supabaseUrl || !env.supabaseServiceKey) {
  console.warn("[supabase] SUPABASE_URL / SERVICE_ROLE_KEY missing — auth verify will fail until .env is set.");
}

export const supabaseAdmin = createClient(env.supabaseUrl || "http://localhost:54321", env.supabaseServiceKey || "anon", {
  auth: { persistSession: false, autoRefreshToken: false },
});
