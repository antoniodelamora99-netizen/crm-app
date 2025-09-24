'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Activity } from '@/lib/types';
import { useSessionUser } from '@/lib/auth/useSessionUser';
import { listRemoteActivities, upsertRemoteActivity, deleteRemoteActivity } from '@/lib/data/activities';

type AsyncState<T> = { data: T; loading: boolean; error: string | null };

const initialState: AsyncState<Activity[]> = {
  data: [],
  loading: false,
  error: null,
};

export function useActivities() {
  const sessionUser = useSessionUser();
  const [{ data, loading, error }, setState] = useState(initialState);

  const refresh = useCallback(async () => {
    if (!sessionUser?.id) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const rows = await listRemoteActivities();
      setState({ data: rows, loading: false, error: null });
    } catch (e: any) {
      setState({ data: [], loading: false, error: e?.message || 'No se pudieron cargar actividades' });
    }
  }, [sessionUser?.id]);

  useEffect(() => {
    refresh().catch(() => null);
  }, [refresh]);

  const upsert = useCallback(async (activity: Activity) => {
    const saved = await upsertRemoteActivity(activity);
    if (!saved) return null;
    setState((prev) => {
      const exists = prev.data.find((a) => a.id === saved.id);
      const list = exists ? prev.data.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev.data];
      return { ...prev, data: list };
    });
    return saved;
  }, []);

  const remove = useCallback(async (id: string) => {
    const ok = await deleteRemoteActivity(id);
    if (ok) {
      setState((prev) => ({ ...prev, data: prev.data.filter((a) => a.id !== id) }));
    }
    return ok;
  }, []);

  return {
    activities: data,
    loading,
    error,
    refresh,
    upsert,
    remove,
  } as const;
}
