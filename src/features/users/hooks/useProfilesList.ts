'use client';

import { useCallback, useEffect, useState } from 'react';

import { listProfiles, type ProfileRow } from '@/lib/data/profiles';

type AsyncState<T> = { data: T; loading: boolean; error: string | null };

const initialState: AsyncState<ProfileRow[]> = {
  data: [],
  loading: false,
  error: null,
};

export function useProfilesList() {
  const [{ data, loading, error }, setState] = useState(initialState);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const rows = await listProfiles();
      setState({ data: rows, loading: false, error: null });
    } catch (e: any) {
      setState({ data: [], loading: false, error: e?.message || 'No se pudieron cargar perfiles' });
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => null);
  }, [refresh]);

  return {
    profiles: data,
    loading,
    error,
    refresh,
  } as const;
}
