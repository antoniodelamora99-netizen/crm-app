'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Policy } from '@/lib/types';
import { useSessionUser } from '@/lib/auth/useSessionUser';
import { useProfile } from '@/lib/auth/useProfile';
import {
  listRemotePolicies,
  upsertRemotePolicy,
  deleteRemotePolicy,
} from '@/lib/data/policies';

type AsyncState<T> = { data: T; loading: boolean; error: string | null };

const initialState: AsyncState<Policy[]> = {
  data: [],
  loading: false,
  error: null,
};

export function usePolicies() {
  const sessionUser = useSessionUser();
  const { profile } = useProfile(sessionUser?.id);
  const [{ data: policies, loading, error }, setState] = useState(initialState);

  const refresh = useCallback(async () => {
    if (!sessionUser?.id) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const rows = await listRemotePolicies();
      setState({ data: rows, loading: false, error: null });
    } catch (e: any) {
      setState({ data: [], loading: false, error: e?.message || 'No se pudieron cargar pólizas' });
    }
  }, [sessionUser?.id]);

  useEffect(() => {
    refresh().catch(() => null);
  }, [refresh]);

  const upsert = useCallback(async (policy: Policy) => {
    const saved = await upsertRemotePolicy(policy);
    if (!saved) return null;
    setState((prev) => {
      const exists = prev.data.find((p) => p.id === saved.id);
      const data = exists ? prev.data.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev.data];
      return { ...prev, data };
    });
    return saved;
  }, []);

  const remove = useCallback(async (id: string) => {
    const ok = await deleteRemotePolicy(id);
    if (ok) {
      setState((prev) => ({ ...prev, data: prev.data.filter((p) => p.id !== id) }));
    }
    return ok;
  }, []);

  const canEdit = useMemo(() => {
    const role = profile?.activeRole || profile?.role;
    return role === 'asesor' || role === 'gerente' || role === 'promotor' || role === 'admin';
  }, [profile?.activeRole, profile?.role]);

  return {
    policies,
    loading,
    error,
    refresh,
    upsert,
    remove,
    canEdit,
  } as const;
}
