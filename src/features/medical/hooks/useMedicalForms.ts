'use client';

import { useCallback, useEffect, useState } from 'react';

import type { MedicalForm } from '@/lib/types';
import { useSessionUser } from '@/lib/auth/useSessionUser';
import {
  listRemoteMedicalForms,
  upsertRemoteMedicalForm,
  deleteRemoteMedicalForm,
} from '@/lib/data/medical';

type AsyncState<T> = { data: T; loading: boolean; error: string | null };

const initialState: AsyncState<MedicalForm[]> = {
  data: [],
  loading: false,
  error: null,
};

export function useMedicalForms() {
  const sessionUser = useSessionUser();
  const [{ data, loading, error }, setState] = useState(initialState);

  const refresh = useCallback(async () => {
    if (!sessionUser?.id) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const rows = await listRemoteMedicalForms();
      setState({ data: rows, loading: false, error: null });
    } catch (e: any) {
      setState({ data: [], loading: false, error: e?.message || 'No se pudieron cargar cuestionarios médicos' });
    }
  }, [sessionUser?.id]);

  useEffect(() => {
    refresh().catch(() => null);
  }, [refresh]);

  const upsert = useCallback(async (form: MedicalForm & { ownerId?: string }) => {
    const saved = await upsertRemoteMedicalForm(form);
    if (!saved) return null;
    setState((prev) => {
      const exists = prev.data.find((f) => f.id === saved.id);
      const list = exists ? prev.data.map((f) => (f.id === saved.id ? saved : f)) : [saved, ...prev.data];
      return { ...prev, data: list };
    });
    return saved;
  }, []);

  const remove = useCallback(async (id: string) => {
    const ok = await deleteRemoteMedicalForm(id);
    if (ok) {
      setState((prev) => ({ ...prev, data: prev.data.filter((f) => f.id !== id) }));
    }
    return ok;
  }, []);

  return {
    medicalForms: data,
    loading,
    error,
    refresh,
    upsert,
    remove,
  } as const;
}
