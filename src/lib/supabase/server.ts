import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null | undefined;

export const supabaseServer = (): SupabaseClient => {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE) as string | undefined;
  if (!url || !serviceKey) throw new Error('Missing Supabase server env (URL/SERVICE_ROLE_KEY)');
  cached = createClient(url, serviceKey, { auth: { persistSession: false } });
  return cached;
};
