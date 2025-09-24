"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useSessionUser } from "@/lib/auth/useSessionUser";
import { useProfile } from "@/lib/auth/useProfile";
import { listProfiles, type ProfileRow } from "@/lib/data/profiles";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AccountPage() {
  const session = useSessionUser();
  const { profile, loading } = useProfile(session?.id);
  const [rows, setRows] = useState<ProfileRow[] | null>(null);
  const [form, setForm] = useState<{ name: string; username: string; role: ProfileRow['role'] | ''; manager_id: string | null; promoter_id: string | null }>({
    name: '', username: '', role: '', manager_id: null, promoter_id: null
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try { const data = await listProfiles(); if (live) setRows(data); } catch {}
    })();
    return () => { live = false };
  }, []);

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name || '',
      username: (profile as any).username || '',
      role: ((profile.activeRole || profile.role) as ProfileRow['role']) ?? 'asesor',
      manager_id: (profile as any).manager_id ?? null,
      promoter_id: (profile as any).promoter_id ?? null,
    });
  }, [profile]);

  const promoters = useMemo(
    () => (rows || []).filter(r => r.role === 'promotor' || r.roles?.includes('promotor')),
    [rows]
  );
  const managers = useMemo(
    () => (rows || []).filter(r => r.role === 'gerente' || r.roles?.includes('gerente')),
    [rows]
  );

  const isAdmin = profile?.role === 'admin';

  if (!session) return <div className="p-6 text-sm text-neutral-500">Inicia sesión para editar tu cuenta.</div>;
  if (loading) return <div className="p-6 text-sm text-neutral-500">Cargando…</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Configuración de la cuenta</h2>
      <Card className="shadow">
        <CardContent className="p-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Correo electrónico</label>
            <Input value={session.email || ''} disabled />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Nombre visible</label>
            <Input value={form.name} onChange={e=>setForm(f=>({ ...f, name: (e.target as HTMLInputElement).value }))} placeholder="Tu nombre" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Nombre de usuario</label>
            <Input value={form.username} onChange={e=>setForm(f=>({ ...f, username: (e.target as HTMLInputElement).value }))} placeholder="usuario (opcional)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Rol</label>
            <Select value={form.role || ''} onValueChange={(v)=> setForm(f=>({ ...f, role: v as ProfileRow['role'] }))}>
              <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
              <SelectContent>
                {(isAdmin ? (['asesor','gerente','promotor','admin'] as const) : (['asesor','gerente','promotor'] as const)).map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Promotor</label>
            <Select value={form.promoter_id || ''} onValueChange={(v)=> setForm(f=>({ ...f, promoter_id: v || null }))}>
              <SelectTrigger><SelectValue placeholder="Selecciona (opcional)"/></SelectTrigger>
              <SelectContent>
                {promoters.map(p => (<SelectItem key={p.id} value={p.id}>{p.name || p.email || p.id}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Gerente</label>
            <Select value={form.manager_id || ''} onValueChange={(v)=> setForm(f=>({ ...f, manager_id: v || null }))}>
              <SelectTrigger><SelectValue placeholder="Selecciona (opcional)"/></SelectTrigger>
              <SelectContent>
                {managers.map(m => (<SelectItem key={m.id} value={m.id}>{m.name || m.email || m.id}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {err && <div className="md:col-span-2 text-sm text-rose-600">{err}</div>}
          {msg && <div className="md:col-span-2 text-sm text-emerald-600">{msg}</div>}
          <div className="md:col-span-2">
            <Button
              disabled={saving}
              onClick={async ()=>{
                setErr(null); setMsg(null); setSaving(true);
                try {
                  const accessToken = (await supabaseBrowser().auth.getSession()).data.session?.access_token;
                  if (!accessToken) throw new Error('Sesión inválida');
                  const res = await fetch('/api/profile/update', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', Authorization: `Bearer ${accessToken}` },
                    body: JSON.stringify({
                      name: form.name?.trim() || null,
                      username: form.username?.trim() || null,
                      role: form.role || null,
                      manager_id: form.manager_id || null,
                      promoter_id: form.promoter_id || null,
                    })
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json?.error || 'No se pudo guardar');
                  setMsg('Guardado');
                  // Fuerza refresco del perfil para reflejar rol/nombre/username
                  try {
                    // El hook useProfile re-fetch con focus; aquí hacemos un refetch activo
                    await new Promise(r => setTimeout(r, 200));
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new Event('focus'));
                    }
                  } catch {}
                } catch (e:any) {
                  setErr(e?.message || 'Error al guardar');
                } finally { setSaving(false) }
              }}
            >{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
