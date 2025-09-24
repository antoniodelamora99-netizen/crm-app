'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { KBSection, KBFile } from '@/lib/types';
import { useSessionUser } from '@/lib/auth/useSessionUser';
import {
  listRemoteKBSections,
  upsertRemoteKBSection,
  deleteRemoteKBSection,
  addRemoteKBFiles,
  deleteRemoteKBFile,
} from '@/lib/data/kb';

type AsyncState<T> = { data: T; loading: boolean; error: string | null };

const initialState: AsyncState<KBSection[]> = { data: [], loading: false, error: null };

export function useKB() {
  const sessionUser = useSessionUser();
  const [{ data, loading, error }, setState] = useState(initialState);

  const refresh = useCallback(async () => {
    if (!sessionUser?.id) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const rows = await listRemoteKBSections();
      setState({ data: rows, loading: false, error: null });
    } catch (e: any) {
      setState({ data: [], loading: false, error: e?.message || 'No se pudo cargar la base de conocimiento' });
    }
  }, [sessionUser?.id]);

  useEffect(() => {
    refresh().catch(() => null);
  }, [refresh]);

  const upsert = useCallback(async (section: KBSection) => {
    const saved = await upsertRemoteKBSection(section);
    if (!saved) return null;
    setState((prev) => {
      const exists = prev.data.find((s) => s.id === saved.id);
      const list = exists ? prev.data.map((s) => (s.id === saved.id ? saved : s)) : [saved, ...prev.data];
      return { ...prev, data: list };
    });
    return saved;
  }, []);

  const remove = useCallback(async (id: string) => {
    const ok = await deleteRemoteKBSection(id);
    if (ok) setState((prev) => ({ ...prev, data: prev.data.filter((s) => s.id !== id) }));
    return ok;
  }, []);

  const addFiles = useCallback(async (sectionId: string, files: KBFile[]) => {
    const saved = await addRemoteKBFiles(sectionId, files, sessionUser?.id);
    if (saved.length) await refresh();
    return saved;
  }, [refresh, sessionUser?.id]);

  const removeFile = useCallback(async (fileId: string) => {
    const ok = await deleteRemoteKBFile(fileId);
    if (ok) await refresh();
    return ok;
  }, [refresh]);

  const count = useMemo(() => data.reduce((acc, s) => acc + (s.files?.length || 0), 0), [data]);

  return { sections: data, loading, error, refresh, upsert, remove, addFiles, removeFile, filesCount: count } as const;
}
