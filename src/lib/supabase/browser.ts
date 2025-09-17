// Lightweight browser Supabase client (no SSR-specific package to avoid extra deps)
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null | undefined;

export const supabaseBrowser = (): SupabaseClient => {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) throw new Error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY)');
  cached = createClient(url, key, { auth: { persistSession: true } });
  return cached;
};
