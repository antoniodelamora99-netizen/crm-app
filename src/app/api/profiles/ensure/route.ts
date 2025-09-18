import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') || req.headers.get('Authorization')
    if (!auth?.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })
    }
    const token = auth.split(' ')[1]
    const sb = supabaseServer()
    const { data: userData, error: userErr } = await sb.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
  const uid = userData.user.id
  const email = userData.user.email || null

    const body = await req.json().catch(() => ({}))
    const name: string | null = body?.name ?? null
    const role: 'asesor' | 'gerente' | 'promotor' | 'admin' | null = body?.role ?? null

    // Upsert profile with safe defaults; service role bypasses RLS
    const display_name = name || email; // prefer provided name, fallback to email
    const payload: Record<string, any> = { id: uid, email, display_name }
    if (role) payload.role = role
    const { data, error } = await sb
      .from('profiles')
      .upsert(payload, { onConflict: 'id', ignoreDuplicates: false })
      .select('id, email, display_name, role')
      .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, profile: data }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
