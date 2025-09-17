'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function useSessionUser() {
  const [user, setUser] = useState<null | { id: string }>(null);
  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getUser().then(({ data }) => setUser(data.user ? { id: data.user.id } : null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ? { id: s.user.id } : null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);
  return user;
}
