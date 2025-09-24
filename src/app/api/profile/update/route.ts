import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

type Body = {
  name?: string | null
  username?: string | null
  role?: 'asesor' | 'gerente' | 'promotor' | 'admin' | null
  manager_id?: string | null
  promoter_id?: string | null
}

export async function POST(req: Request) {
  try {
    const sb = supabaseServer()
    const auth = req.headers.get('authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: meData, error: meErr } = await sb.auth.getUser(token)
    if (meErr || !meData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const meId = meData.user.id

  const { data: meProfile } = await sb
    .from('profiles')
    .select('id, role, promoter_id, active_role_id')
    .eq('id', meId)
    .single()

    const body = (await req.json()) as Partial<Body>
    const updates: Record<string, any> = {}
    if (typeof body.name === 'string' || body.name === null) updates.display_name = body.name
    if (typeof body.username === 'string' || body.username === null) updates.username = body.username

    let activeRoleId: string | null | undefined = undefined
    if (typeof body.role !== 'undefined') {
      const target = body.role
      if (target) {
        if (meProfile?.role === 'admin') {
          // admin puede todo
        } else if (meProfile?.role === 'promotor') {
          if (!['asesor', 'gerente', 'promotor'].includes(target)) {
            return NextResponse.json({ error: 'No permitido' }, { status: 403 })
          }
        } else if (meProfile?.role === 'gerente') {
          if (!['asesor', 'gerente'].includes(target)) {
            return NextResponse.json({ error: 'No permitido' }, { status: 403 })
          }
        } else {
          return NextResponse.json({ error: 'No permitido' }, { status: 403 })
        }

        const { data: roleRow, error: roleErr } = await sb
          .from('roles')
          .select('id, slug')
          .eq('slug', target)
          .maybeSingle()
        if (roleErr || !roleRow) {
          return NextResponse.json({ error: 'Rol no encontrado' }, { status: 400 })
        }
        activeRoleId = roleRow.id
        updates.role = target
        updates.active_role_id = roleRow.id
        await sb
          .from('user_roles')
          .upsert({ user_id: meId, role_id: roleRow.id }, { onConflict: 'user_id,role_id' })
          .select('user_id')
          .maybeSingle()
      } else {
        // Se envió null explícito: quitar rol activo
        if (meProfile?.role !== 'admin') {
          return NextResponse.json({ error: 'No permitido' }, { status: 403 })
        }
        updates.role = null
        updates.active_role_id = null
        activeRoleId = null
      }
    }

    // Validar jerarquía
    const checkIdRole = async (id: string, expected: string): Promise<boolean> => {
      const { data, error } = await sb.from('profiles').select('id, role').eq('id', id).single();
      if (error || !data) return false;
      return data.role === expected;
    };

    let manager_id = body.manager_id ?? undefined
    let promoter_id = body.promoter_id ?? undefined

    if (typeof manager_id !== 'undefined') {
      if (manager_id === null) updates.manager_id = null
      else {
        const ok = await checkIdRole(manager_id, 'gerente')
        if (!ok) return NextResponse.json({ error: 'manager_id no es un gerente' }, { status: 400 })
        updates.manager_id = manager_id
      }
    }
    if (typeof promoter_id !== 'undefined') {
      if (promoter_id === null) updates.promoter_id = null
      else {
        const ok = await checkIdRole(promoter_id, 'promotor')
        if (!ok) return NextResponse.json({ error: 'promoter_id no es un promotor' }, { status: 400 })
        updates.promoter_id = promoter_id
      }
    }

    if (Object.keys(updates).length === 0 && typeof activeRoleId === 'undefined') {
      return NextResponse.json({ ok: true })
    }

    const { data, error } = await sb
      .from('profiles')
      .update(updates)
      .eq('id', meId)
      .select('id, email, display_name, username, role, manager_id, promoter_id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, profile: data }, { status: 200 })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
