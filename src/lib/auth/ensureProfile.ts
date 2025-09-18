import { supabaseBrowser } from '@/lib/supabase/browser'

export async function ensureProfile(opts?: { name?: string; role?: 'asesor' | 'gerente' | 'promotor' | 'admin' }) {
  const sb = supabaseBrowser()
  const { data: sess } = await sb.auth.getSession()
  const token = sess.session?.access_token
  if (!token) return false
  const res = await fetch('/api/profiles/ensure', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ name: opts?.name, role: opts?.role })
  })
  return res.ok
}
