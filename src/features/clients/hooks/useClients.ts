'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Client } from '@/lib/types';
import { useSessionUser } from '@/lib/auth/useSessionUser';
import { useProfile } from '@/lib/auth/useProfile';
import {
  listRemoteClients,
  upsertRemoteClient,
  deleteRemoteClient,
  toggleRemoteContactado as toggleRemoteContactadoFn,
} from '@/lib/data/clients';

type AsyncState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

const initialState: AsyncState<Client[]> = {
  data: [],
  loading: false,
  error: null,
};

export function useClients() {
  const sessionUser = useSessionUser();
  const { profile } = useProfile(sessionUser?.id);
  const [{ data: clients, loading, error }, setState] = useState(initialState);

  const refresh = useCallback(async () => {
    if (!sessionUser?.id) {
      setState((prev) => ({ ...prev, data: [], loading: false, error: null }));
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const rows = await listRemoteClients();
      setState({ data: rows, loading: false, error: null });
    } catch (e: any) {
      setState({ data: [], loading: false, error: e?.message || 'No se pudieron cargar clientes' });
    }
  }, [sessionUser?.id]);

  useEffect(() => {
    refresh().catch(() => null);
  }, [refresh]);

  const upsert = useCallback(async (client: Client) => {
    const saved = await upsertRemoteClient(client);
    if (!saved) return null;
    setState((prev) => {
      const exists = prev.data.find((c) => c.id === saved.id);
      const data = exists
        ? prev.data.map((c) => (c.id === saved.id ? saved : c))
        : [saved, ...prev.data];
      return { ...prev, data };
    });
    return saved;
  }, []);

  const remove = useCallback(async (id: string) => {
    const ok = await deleteRemoteClient(id);
    if (ok) {
      setState((prev) => ({ ...prev, data: prev.data.filter((c) => c.id !== id) }));
    }
    return ok;
  }, []);

  const toggleContactado = useCallback(async (client: Client, value: boolean) => {
    const saved = await toggleRemoteContactadoFn(client, value);
    if (!saved) return null;
    setState((prev) => ({
      ...prev,
      data: prev.data.map((c) => (c.id === saved.id ? saved : c)),
    }));
    return saved;
  }, []);

  const canCreate = useMemo(() => Boolean(sessionUser?.id && profile), [sessionUser?.id, profile]);

  return {
    clients,
    loading,
    error,
    refresh,
    upsert,
    remove,
    toggleContactado,
    canCreate,
  } as const;
}
