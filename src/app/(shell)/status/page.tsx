"use client";
import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useSessionUser } from '@/lib/auth/useSessionUser';
import { useProfile } from '@/lib/auth/useProfile';

export default function StatusPage() {
  const session = useSessionUser();
  const { profile } = useProfile(session?.id);
  const [health, setHealth] = useState<{ ok: boolean; env: Record<string, any> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        const json = await res.json();
        if (alive) setHealth(json);
      } catch (e: any) {
        if (alive) setError(e?.message || 'No se pudo cargar /api/health');
      }
    })();
    return () => { alive = false };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Estado</h1>
      <Card className="shadow">
        <CardContent className="p-4">
          <div className="text-sm font-medium mb-2">Sesión</div>
          <div className="text-sm text-neutral-700 space-y-1">
            <div><span className="text-neutral-500">Email:</span> {session?.email || '—'}</div>
            <div><span className="text-neutral-500">User ID:</span> {session?.id || '—'}</div>
            <div><span className="text-neutral-500">Nombre:</span> {profile?.name || '—'}</div>
            <div><span className="text-neutral-500">Rol:</span> {profile?.role || '—'}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow">
        <CardContent className="p-4">
          <div className="text-sm font-medium mb-2">Variables de entorno</div>
          {error && <div className="text-sm text-rose-600">{error}</div>}
          {!error && !health && <div className="text-sm text-neutral-500">Cargando…</div>}
          {health && (
            <ul className="text-sm text-neutral-700 grid grid-cols-1 sm:grid-cols-2 gap-y-1">
              {Object.entries(health.env).map(([k, v]) => (
                <li key={k}><span className="text-neutral-500">{k}:</span> {String(v)}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
