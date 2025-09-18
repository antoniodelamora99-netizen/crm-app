"use client";
import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { listProfiles, type ProfileRow } from "@/lib/data/profiles";
import { useSessionUser } from "@/lib/auth/useSessionUser";
import { useProfile } from "@/lib/auth/useProfile";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function UsersPage() {
  const session = useSessionUser();
  const { profile, loading: loadingProfile } = useProfile(session?.id);
  const [rows, setRows] = useState<ProfileRow[] | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [form, setForm] = useState<{ email: string; name: string; password: string; role: ProfileRow['role']; manager_id: string | null; promoter_id: string | null }>({
    email: '', name: '', password: '', role: 'asesor', manager_id: null, promoter_id: null
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await listProfiles();
        if (alive) setRows(data);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? 'No se pudo cargar usuarios');
      }
    })();
    return () => { alive = false };
  }, []);

  const canView = !!profile && (profile.role === 'gerente' || profile.role === 'promotor' || profile.role === 'admin');
  const isAdmin = profile?.role === 'admin';
  if (loadingProfile || !rows) {
    return <div className="p-6 text-sm text-neutral-500">Cargando usuarios…</div>
  }
  if (!canView) {
    return (
      <Card className="shadow">
        <CardContent className="p-6 text-sm text-neutral-600">
          No tienes permisos para ver esta página.
        </CardContent>
      </Card>
    );
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(u =>
      [u.name, u.email, u.role].some(v => String(v || "").toLowerCase().includes(term))
    );
  }, [q, rows]);

  const roleBadge: Record<ProfileRow['role'], string> = {
    asesor: "bg-sky-100 text-sky-800",
    gerente: "bg-amber-100 text-amber-800",
    promotor: "bg-emerald-100 text-emerald-800",
    admin: "bg-violet-100 text-violet-800",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Usuarios</h2>
        <div className="flex gap-2">
          <Input placeholder="Buscar por nombre, email o rol…" value={q} onChange={e => setQ((e.target as HTMLInputElement).value)} className="w-64" />
          {isAdmin && (
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button>Nuevo</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Crear usuario</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Correo electrónico (login)</label>
                    <Input type="email" value={form.email} onChange={e=>setForm(f=>({ ...f, email: (e.target as HTMLInputElement).value }))} placeholder="tucorreo@empresa.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Nombre completo (opcional)</label>
                    <Input value={form.name} onChange={e=>setForm(f=>({ ...f, name: (e.target as HTMLInputElement).value }))} placeholder="Nombre visible" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Contraseña</label>
                    <Input type="password" value={form.password} onChange={e=>setForm(f=>({ ...f, password: (e.target as HTMLInputElement).value }))} placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Rol</label>
                    <Select value={form.role} onValueChange={(v)=>setForm(f=>({ ...f, role: v as ProfileRow['role'] }))}>
                      <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
                      <SelectContent>
                        {(['asesor','gerente','promotor','admin'] as ProfileRow['role'][]).map(r => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Jerarquía */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Promotor</label>
                      <Select value={form.promoter_id || ''} onValueChange={(v)=>setForm(f=>({ ...f, promoter_id: v || null }))}>
                        <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
                        <SelectContent>
                          {(rows || []).filter(r=>r.role==='promotor').map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name || p.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Gerente</label>
                      <Select value={form.manager_id || ''} onValueChange={(v)=>setForm(f=>({ ...f, manager_id: v || null }))}>
                        <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
                        <SelectContent>
                          {(rows || []).filter(r=>r.role==='gerente').map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.name || g.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {createErr && <div className="text-sm text-rose-600">{createErr}</div>}
                </div>
                <DialogFooter>
                  <Button
                    disabled={creating}
                    onClick={async ()=>{
                      setCreateErr(null); setCreating(true);
                      try {
                        const em = form.email.trim();
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error('Email inválido');
                        if (form.password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
                        const accessToken = (await supabaseBrowser().auth.getSession()).data.session?.access_token;
                        const res = await fetch('/api/admin/users/create', {
                          method: 'POST', headers: { 'content-type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
                          body: JSON.stringify({ email: em, password: form.password, name: form.name.trim() || undefined, role: form.role, manager_id: form.manager_id, promoter_id: form.promoter_id })
                        });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json?.error || 'Error creando usuario');
                        // refrescar listado
                        const fresh = await listProfiles();
                        setRows(fresh);
                        setOpenNew(false);
                        setForm({ email: '', name: '', password: '', role: 'asesor', manager_id: null, promoter_id: null });
                      } catch (e:any) {
                        setCreateErr(e?.message || 'No se pudo crear');
                      } finally { setCreating(false); }
                    }}
                  >{creating ? 'Creando…' : 'Crear usuario'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card className="shadow">
        <CardContent className="p-0 overflow-x-auto">
          {err && <div className="p-3 text-sm text-rose-600">{err}</div>}
      <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-neutral-700">
              <tr>
                <th className="text-left p-3">Nombre</th>
                <th className="text-left p-3">Correo electrónico</th>
                <th className="text-left p-3">Rol</th>
                <th className="text-left p-3">Gerente</th>
                <th className="text-left p-3">Promotor</th>
                <th className="text-left p-3">ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const manager = rows.find(r => r.id === u.manager_id)
                const promoter = rows.find(r => r.id === u.promoter_id)
                return (
                  <tr key={u.id} className="border-t">
                    <td className="p-3">{u.name || '—'}</td>
                    <td className="p-3">{u.email || '—'}</td>
                    <td className="p-3"><Badge className={roleBadge[u.role]}>{u.role}</Badge></td>
                    <td className="p-3">{manager?.name || '—'}</td>
                    <td className="p-3">{promoter?.name || '—'}</td>
                    <td className="p-3 text-xs text-neutral-500">{u.id}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
  <tr><td className="p-4 text-sm text-neutral-500" colSpan={6}>Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <p className="text-xs text-neutral-500">La visibilidad la controla RLS jerárquico en Supabase.</p>
    </div>
  );
}
