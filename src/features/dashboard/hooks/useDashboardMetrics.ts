'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSessionUser } from '@/lib/auth/useSessionUser';
import { useClients } from '@/features/clients/hooks/useClients';
import { usePolicies } from '@/features/policies/hooks/usePolicies';
import { useActivities } from '@/features/activities/hooks/useActivities';
import { calculateDashboardSnapshot } from '@/lib/data/dashboard';

export type RangeKey = 'week' | 'month' | 'q3' | 'all';

const DAILY_TARGET = 25;

export function useDashboardMetrics(range: RangeKey) {
  const sessionUser = useSessionUser();
  const { clients, loading: loadingClients } = useClients();
  const { policies, loading: loadingPolicies } = usePolicies();
  const { activities, loading: loadingActivities } = useActivities();

  const loading = loadingClients || loadingPolicies || loadingActivities;
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState({
    prospectosNuevos: 0,
    llamadasRealizadas: 0,
    citasAgendadas: 0,
    polizasIngresadas: 0,
    puntosDelDia: 0,
  });

  const computeRange = useCallback(() => {
    const now = new Date();
    if (range === 'week') {
      const from = new Date(now);
      from.setDate(now.getDate() - 7);
      return { from, to: now };
    }
    if (range === 'q3') {
      const from = new Date(now);
      from.setDate(now.getDate() - 90);
      return { from, to: now };
    }
    if (range === 'month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { from, to };
    }
    return { from: new Date(2000, 0, 1), to: now };
  }, [range]);

  useEffect(() => {
    if (!sessionUser?.id) {
      setSnapshot({
        prospectosNuevos: 0,
        llamadasRealizadas: 0,
        citasAgendadas: 0,
        polizasIngresadas: 0,
        puntosDelDia: 0,
      });
      return;
    }

    try {
      setError(null);
      const { from, to } = computeRange();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const snap = calculateDashboardSnapshot(clients, policies, activities, { from, to }, { start: todayStart, end: todayEnd });
      setSnapshot(snap);
    } catch (e: any) {
      setError(e?.message || 'Error calculando métricas');
    }
  }, [sessionUser?.id, clients, policies, activities, computeRange]);

  const progreso = useMemo(() => {
    if (!snapshot.puntosDelDia) return 0;
    return Math.min(1, snapshot.puntosDelDia / DAILY_TARGET);
  }, [snapshot.puntosDelDia]);

  return {
    loading,
    error,
    snapshot,
    progreso,
    DAILY_TARGET,
  } as const;
}
