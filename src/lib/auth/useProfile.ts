'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

type RoleSlug = 'asesor' | 'gerente' | 'promotor' | 'admin';

export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  role: RoleSlug | null; // backwards compatible alias
  activeRole: RoleSlug | null;
  roles: RoleSlug[];
  managerId: string | null;
  promoterId: string | null;
  manager_id: string | null;
  promoter_id: string | null;
  username: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  manager_id: string | null;
  promoter_id: string | null;
  active_role_id: string | null;
  legacy_role?: RoleSlug | null;
  active_role?: { id: string; slug: RoleSlug | null } | null;
  user_roles?: Array<{ role?: { slug: RoleSlug | null } | null }> | null;
};

const PROFILE_SELECT = `
  id,
  email,
  display_name,
  username,
  manager_id,
  promoter_id,
  active_role_id,
  legacy_role:role,
  active_role:roles!profiles_active_role_id_fkey ( id, slug ),
  user_roles:user_roles ( role:roles ( slug ) )
`;

function mapRow(row: ProfileRow): Profile {
  const pool = new Set<RoleSlug>();
  row.user_roles?.forEach((r) => {
    const slug = r?.role?.slug;
    if (slug) pool.add(slug);
  });
  if (row.legacy_role) pool.add(row.legacy_role);
  const active = (row.active_role?.slug || row.legacy_role || null) as RoleSlug | null;
  if (active) pool.add(active);
  const roles = Array.from(pool.values());
  if (active) {
    roles.sort((a, b) => (a === active ? -1 : b === active ? 1 : a.localeCompare(b)));
  } else {
    roles.sort((a, b) => a.localeCompare(b));
  }
  return {
    id: row.id,
    email: row.email,
    name: row.display_name,
    username: row.username,
    managerId: row.manager_id,
    promoterId: row.promoter_id,
    manager_id: row.manager_id,
    promoter_id: row.promoter_id,
    activeRole: active,
    role: active,
    roles,
  };
}

export function useProfile(userId?: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(!!userId);
  const [error, setError] = useState<string | null>(null);

  async function fetchProfile(id: string) {
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', id)
      .maybeSingle<ProfileRow>();
    if (error) throw error;
    if (!data) return null;
    return mapRow(data);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) { setProfile(null); setLoading(false); return; }
      setLoading(true); setError(null);
      try {
        const data = await fetchProfile(userId);
        if (!active) return;
        setProfile(data);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || 'Failed to load profile');
        setProfile(null);
      } finally {
        if (active) setLoading(false);
      }

      // Suscripción a cambios en tiempo real del propio perfil
      const sb = supabaseBrowser();
      const chan = sb
        .channel(`profile-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, async () => {
          try {
            const data = await fetchProfile(userId);
            if (!active) return;
            setProfile(data);
          } catch {}
        })
        .subscribe();

      // Refresco al volver a la pestaña
      const onFocus = async () => {
        try {
          const data = await fetchProfile(userId);
          if (!active) return;
          setProfile(data);
        } catch {}
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
      }

      return () => {
        active = false;
        try { sb.removeChannel(chan); } catch {}
        if (typeof window !== 'undefined') {
          window.removeEventListener('focus', onFocus);
          document.removeEventListener('visibilitychange', onFocus);
        }
      };
    })();
    return () => { active = false; };
  }, [userId]);

  return { profile, loading, error } as const;
}
