'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export type Profile = {
  id: string;
  name?: string | null; // aliased from display_name in DB
  role: 'asesor' | 'gerente' | 'promotor' | 'admin';
  manager_id?: string | null;
  promoter_id?: string | null;
};

export function useProfile(userId?: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(!!userId);
  const [error, setError] = useState<string | null>(null);

  async function fetchProfile(id: string) {
    const sb = supabaseBrowser();
    const { data, error } = await sb
      .from('profiles')
      .select('id, name:display_name, role, manager_id, promoter_id')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Profile;
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
            if (active) setProfile(data);
          } catch {}
        })
        .subscribe();

      // Refresco al volver a la pestaña
      const onFocus = async () => {
        try {
          const data = await fetchProfile(userId);
          if (active) setProfile(data);
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
