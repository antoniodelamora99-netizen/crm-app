import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

type Body = {
  email: string
  password: string
  name?: string
  role?: 'asesor' | 'gerente' | 'promotor' | 'admin'
  manager_id?: string | null
  promoter_id?: string | null
}

export async function POST(req: Request) {
  try {
    const sb = supabaseServer()
    // AuthN: require a valid bearer token
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ')
      ? auth.slice(7).trim()
      : null
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: userData, error: userErr } = await sb.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const callerId = userData.user.id
    // AuthZ: caller must be admin in profiles
    const { data: callerProfile, error: profErr } = await sb
      .from('profiles')
      .select('id, role')
      .eq('id', callerId)
      .single()
    if (profErr || !callerProfile || callerProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = (await req.json()) as Partial<Body>
    const email = (body.email || '').trim()
    const password = body.password || ''
    const name = (body.name || '').trim() || null
    const allowedRoles = ['asesor','gerente','promotor','admin'] as const
    const role = (allowedRoles as readonly string[]).includes(String(body.role || ''))
      ? (body.role as Body['role'])
      : 'promotor'
    const manager_id = body.manager_id ?? null
    const promoter_id = body.promoter_id ?? null

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

  const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email,
      password,
      user_metadata: name ? { name } : undefined,
      email_confirm: false,
    })
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 })
    const uid = created.user?.id
    if (!uid) return NextResponse.json({ error: 'No se obtuvo ID de usuario' }, { status: 500 })

    const { data: prof, error: upErr } = await sb
      .from('profiles')
      .upsert({ id: uid, email, display_name: name || email, role, manager_id, promoter_id }, { onConflict: 'id' })
      .select('id, email, display_name, role, manager_id, promoter_id')
      .single()
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, id: uid, profile: prof }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
