import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

// One-time bootstrap endpoint to create the first admin user online.
// Security:
// - Requires ADMIN_BOOTSTRAP_TOKEN env and matching Bearer token in request.
// - Refuses to run if an admin already exists in profiles.
// - Server-side only; uses SUPABASE_SERVICE_ROLE to create user and upsert profile.
// Usage (once):
//   POST /api/admin/bootstrap with JSON { email, password, name? }
//   Headers: Authorization: Bearer <ADMIN_BOOTSTRAP_TOKEN>
// After success, keep the token secret; this route is safe to keep as it no-ops if an admin exists.

type Body = { email: string; password: string; name?: string }

export async function POST(req: Request) {
  try {
    const tokenEnv = process.env.ADMIN_BOOTSTRAP_TOKEN
    if (!tokenEnv) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ')
      ? auth.slice(7).trim()
      : null
    if (!token || token !== tokenEnv) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const sb = supabaseServer()

    // If an admin already exists, block
    const { data: existing, error: qErr } = await sb
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Admin already exists' }, { status: 409 })
    }

    const body = (await req.json()) as Partial<Body>
    const email = (body.email || '').trim()
    const password = body.password || ''
    const name = (body.name || '').trim() || null

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const { data: created, error: cErr } = await sb.auth.admin.createUser({
      email,
      password,
      user_metadata: name ? { display_name: name, name } : undefined,
      email_confirm: false,
    })
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
    const uid = created.user?.id
    if (!uid) return NextResponse.json({ error: 'No se obtuvo ID de usuario' }, { status: 500 })

    const { data: prof, error: upErr } = await sb
      .from('profiles')
      .upsert({ id: uid, email, display_name: name || email, role: 'admin', manager_id: null, promoter_id: null }, { onConflict: 'id' })
      .select('id, email, display_name, role')
      .single()
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, id: uid, profile: prof }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
