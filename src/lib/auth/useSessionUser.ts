'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function useSessionUser() {
  const [user, setUser] = useState<null | { id: string; email: string | null }>(null);
  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getUser().then(({ data }) => setUser(data.user ? { id: data.user.id, email: data.user.email ?? null } : null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ? { id: s.user.id, email: s.user.email ?? null } : null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);
  return user;
}
