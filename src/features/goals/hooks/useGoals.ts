'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Goal } from '@/lib/types';
import { useSessionUser } from '@/lib/auth/useSessionUser';
import { listRemoteGoals, upsertRemoteGoal, deleteRemoteGoal } from '@/lib/data/goals';

type AsyncState<T> = { data: T; loading: boolean; error: string | null };

const initialState: AsyncState<Goal[]> = {
  data: [],
  loading: false,
  error: null,
};

export function useGoals() {
  const sessionUser = useSessionUser();
  const [{ data, loading, error }, setState] = useState(initialState);

  const refresh = useCallback(async () => {
    if (!sessionUser?.id) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const rows = await listRemoteGoals();
      setState({ data: rows, loading: false, error: null });
    } catch (e: any) {
      setState({ data: [], loading: false, error: e?.message || 'No se pudieron cargar metas' });
    }
  }, [sessionUser?.id]);

  useEffect(() => {
    refresh().catch(() => null);
  }, [refresh]);

  const upsert = useCallback(async (goal: Goal & { ownerId?: string }) => {
    const saved = await upsertRemoteGoal(goal);
    if (!saved) return null;
    setState((prev) => {
      const exists = prev.data.find((g) => g.id === saved.id);
      const list = exists ? prev.data.map((g) => (g.id === saved.id ? saved : g)) : [saved, ...prev.data];
      return { ...prev, data: list };
    });
    return saved;
  }, []);

  const remove = useCallback(async (id: string) => {
    const ok = await deleteRemoteGoal(id);
    if (ok) {
      setState((prev) => ({ ...prev, data: prev.data.filter((g) => g.id !== id) }));
    }
    return ok;
  }, []);

  return {
    goals: data,
    loading,
    error,
    refresh,
    upsert,
    remove,
  } as const;
}
