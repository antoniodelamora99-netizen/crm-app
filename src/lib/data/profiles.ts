import { supabaseBrowser } from '@/lib/supabase/browser'

export type ProfileRow = {
  id: string
  email: string | null
  name: string | null
  username: string | null
  role: 'asesor' | 'gerente' | 'promotor' | 'admin' | null
  manager_id: string | null
  promoter_id: string | null
  created_at: string | null
  roles?: ('asesor' | 'gerente' | 'promotor' | 'admin')[]
}

const PROFILE_LIST_SELECT = `
  id,
  email,
  display_name,
  username,
  role,
  manager_id,
  promoter_id,
  created_at,
  active_role:roles!profiles_active_role_id_fkey ( slug ),
  user_roles:user_roles ( role:roles ( slug ) )
`;

function normalizeRow(row: any): ProfileRow { // eslint-disable-line @typescript-eslint/no-explicit-any
  const roles = new Set<'asesor' | 'gerente' | 'promotor' | 'admin'>();
  const legacy = row.role as ProfileRow['role'];
  if (legacy) roles.add(legacy);
  row.user_roles?.forEach((r: any) => { const slug = r?.role?.slug; if (slug) roles.add(slug); });
  const active = row.active_role?.slug || legacy || null;
  if (active) roles.add(active);
  return {
    id: row.id,
    email: row.email ?? null,
    name: row.display_name ?? null,
    username: row.username ?? null,
    role: active,
    manager_id: row.manager_id ?? null,
    promoter_id: row.promoter_id ?? null,
    created_at: row.created_at ?? null,
    roles: Array.from(roles.values()),
  };
}

export async function listProfiles(): Promise<ProfileRow[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from('profiles')
    .select(PROFILE_LIST_SELECT)
    .order('display_name', { ascending: true });
  if (error) {
    const fallback = await sb
      .from('profiles')
      .select('id, email, display_name, username, role, manager_id, promoter_id, created_at')
      .order('display_name', { ascending: true });
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []).map((row: any) => normalizeRow({ ...row, active_role: null, user_roles: null }));
  }
  return (data ?? []).map(normalizeRow);
}
