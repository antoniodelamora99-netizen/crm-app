// Lightweight Supabase client initializer. Returns null if env vars are missing.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached || null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    cached = null;
    return null;
  }
  try {
    cached = createClient(url, key, { auth: { persistSession: false } });
    return cached;
  } catch (e) {
    console.warn("Supabase init failed:", e);
    cached = null;
    return null;
  }
}
