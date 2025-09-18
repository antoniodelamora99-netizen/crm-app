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
    // AuthZ: caller must be admin/promotor/gerente (with constraints)
    const { data: callerProfile, error: profErr } = await sb
      .from('profiles')
      .select('id, role, promoter_id')
      .eq('id', callerId)
      .single()
    if (profErr || !callerProfile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const body = (await req.json()) as Partial<Body>
    const email = (body.email || '').trim()
    const password = body.password || ''
    const name = (body.name || '').trim() || null
    const allowedRoles = ['asesor','gerente','promotor','admin'] as const
    const requestedRole: Body['role'] | undefined = (allowedRoles as readonly string[]).includes(String(body.role || ''))
      ? (body.role as Body['role'])
      : undefined

    // Compute permissions and enforced hierarchy
    let role: Body['role'] = requestedRole || 'promotor'
    let manager_id: string | null = body.manager_id ?? null
    let promoter_id: string | null = body.promoter_id ?? null

    if (callerProfile.role === 'admin') {
      // admin: can create any role; keep provided ids
      role = requestedRole || 'promotor'
    } else if (callerProfile.role === 'promotor') {
      // promotor: can create asesor/gerente/promotor; default promoter_id to self for asesor/gerente; for promotor keep null
      if (!requestedRole) role = 'promotor'
      if (role === 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      if (role === 'asesor' || role === 'gerente') {
        if (!promoter_id) promoter_id = callerId
      }
      if (role === 'promotor') {
        promoter_id = null // promotores no tienen promotor asignado
        manager_id = null
      }
    } else if (callerProfile.role === 'gerente') {
      // gerente: can only create asesores; must belong to this gerente; propagate gerente's promoter to keep chain
      if (requestedRole && requestedRole !== 'asesor') {
        return NextResponse.json({ error: 'Solo puedes crear asesores' }, { status: 403 })
      }
      role = 'asesor'
      manager_id = callerId // forzar gerencia del creador
      if (!promoter_id) promoter_id = callerProfile.promoter_id ?? null
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    // Validate hierarchy ids (when present) against expected roles
    const checkIdRole = async (id: string, expected: Body['role']): Promise<boolean> => {
      const { data, error } = await sb.from('profiles').select('id, role').eq('id', id).single();
      if (error || !data) return false;
      return data.role === expected;
    };

    if (role === 'gerente') {
      // gerente debe tener promoter_id (promotor)
      if (!promoter_id) promoter_id = callerProfile.role === 'promotor' ? callerId : promoter_id;
      if (!promoter_id) return NextResponse.json({ error: 'Falta asignar promotor al gerente' }, { status: 400 });
      const ok = await checkIdRole(promoter_id, 'promotor');
      if (!ok) return NextResponse.json({ error: 'promoter_id no corresponde a un promotor' }, { status: 400 });
      // manager para gerente no aplica
      manager_id = null;
    }

    if (role === 'asesor') {
      // manager_id opcional; si viene, debe ser gerente
      if (manager_id) {
        const ok = await checkIdRole(manager_id, 'gerente');
        if (!ok) return NextResponse.json({ error: 'manager_id no corresponde a un gerente' }, { status: 400 });
      }
      // promoter_id opcional; si viene, debe ser promotor
      if (promoter_id) {
        const ok = await checkIdRole(promoter_id, 'promotor');
        if (!ok) return NextResponse.json({ error: 'promoter_id no corresponde a un promotor' }, { status: 400 });
      }
    }

    if (role === 'promotor') {
      // promotor no debe tener manager/promoter
      manager_id = null; promoter_id = null;
    }
    if (role === 'admin') {
      manager_id = null; promoter_id = null;
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
    if (upErr) {
      // Rollback: borrar el usuario de Auth para evitar huérfanos
      try { await sb.auth.admin.deleteUser(uid) } catch {}
      return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: uid, profile: prof }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
