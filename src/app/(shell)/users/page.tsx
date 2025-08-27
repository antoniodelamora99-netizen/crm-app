"use client";
import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

import type { User, UserRole } from "@/lib/types";
import { getUsers, saveUsers, getCurrentUser } from "@/lib/users";

// Helper
const ROLES: UserRole[] = ["asesor", "gerente", "promotor"];

export default function UsersPage() {
  const me = getCurrentUser();
  const [rows, setRows] = useState<User[]>(getUsers());
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });

  // Persist
  useEffect(() => { saveUsers(rows); }, [rows]);

  // Access control: asesores NO pueden ver esta página
  if (!me) return null;
  const canManage = me.role === "promotor" || me.role === "gerente";
  if (!canManage) {
    return (
      <Card className="shadow">
        <CardContent className="p-6 text-sm text-muted-foreground">
          No tienes permisos para administrar usuarios. Contacta a tu gerente/promotor.
        </CardContent>
      </Card>
    );
  }

  // Scope: promotor ve todos; gerente ve solo sus asesores; (ambos se pueden editar según reglas)
  const visible = useMemo(() => {
    if (me.role === "promotor") return rows;
    // gerente
    return rows.filter(u => u.role === "asesor" && u.managerId === me.id);
  }, [rows, me]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return visible;
    return visible.filter(u =>
      [u.name, u.username, u.role].some(v => String(v || "").toLowerCase().includes(term))
    );
  }, [q, visible]);

  const canCreateRole = (role: UserRole) => {
    if (me.role === "promotor") return true; // puede crear todos
    if (me.role === "gerente") return role === "asesor"; // solo asesores
    return false;
  };

  const handleCreate = (u: User) => { setRows(prev => [u, ...prev]); setOpenNew(false); };
  const handleUpdate = (u: User) => { setRows(prev => prev.map(x => x.id === u.id ? u : x)); setOpenEdit({ open: false, user: null }); };
  const handleDelete = (id: string) => { setRows(prev => prev.filter(x => x.id !== id)); };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Usuarios</h2>
        <div className="flex gap-2">
          <Input placeholder="Buscar nombre/usuario/rol…" value={q} onChange={e => setQ((e.target as HTMLInputElement).value)} className="w-64" />
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button disabled={!canManage}><Plus className="mr-2" size={16}/>Nuevo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Nuevo usuario</DialogTitle></DialogHeader>
              <UserForm me={me} onSubmit={handleCreate} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-neutral-700">
              <tr>
                <th className="text-left p-3">Nombre</th>
                <th className="text-left p-3">Usuario</th>
                <th className="text-left p-3">Rol</th>
                <th className="text-left p-3">Inicio</th>
                <th className="text-left p-3">Gerente</th>
                <th className="text-left p-3">Promotor</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-t">
                  <td className="p-3">{u.name}</td>
                  <td className="p-3">{u.username}</td>
                  <td className="p-3">
                    <Badge className={u.role === "promotor" ? "bg-violet-100 text-violet-800" : u.role === "gerente" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="p-3">{u.startDate || "—"}</td>
                  <td className="p-3">{rows.find(x => x.id === u.managerId)?.name || "—"}</td>
                  <td className="p-3">{rows.find(x => x.id === u.promoterId)?.name || (u.role === "promotor" ? u.name : "—")}</td>
                  <td className="p-3 space-x-2">
                    <Button size="sm" variant="secondary" onClick={() => setOpenEdit({ open: true, user: u })}>Editar</Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td className="p-4 text-sm text-muted-foreground" colSpan={7}>Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={openEdit.open} onOpenChange={(o) => setOpenEdit({ open: o, user: o ? openEdit.user : null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar usuario</DialogTitle></DialogHeader>
          {openEdit.user && (
            <UserForm
              me={me}
              initial={openEdit.user}
              onSubmit={handleUpdate}
            />
          )}
          {openEdit.user && (
            <DialogFooter className="justify-between mt-2">
              <Button
                variant="destructive"
                onClick={() => {
                  if (window.confirm("¿Eliminar este usuario? Esta acción no se puede deshacer.")) {
                    handleDelete(openEdit.user!.id);
                    setOpenEdit({ open: false, user: null });
                  }
                }}
              >
                Borrar usuario
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserForm({ me, initial, onSubmit }: { me: User; initial?: User | null; onSubmit: (u: User) => void }) {
  const [rows] = useState<User[]>(getUsers());
  const [form, setForm] = useState<User>(initial || {
    id: Math.random().toString(36).slice(2, 10),
    name: "",
    username: "",
    password: "",
    role: me.role === "gerente" ? "asesor" : "asesor",
    startDate: new Date().toISOString().slice(0, 10),
    managerId: me.role === "gerente" ? me.id : undefined,
    promoterId: me.role === "promotor" ? me.id : me.promoterId,
  });

  useEffect(() => { if (initial) setForm(initial); }, [initial]);
  const set = (k: keyof User, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  // Opciones por rol
  const managers = useMemo(() => rows.filter(u => u.role === "gerente" && (me.role === "promotor" ? u.promoterId === me.id : u.id === me.id)), [rows, me]);
  const promoters = useMemo(() => rows.filter(u => u.role === "promotor"), [rows]);

  // Reglas al cambiar rol
  const onChangeRole = (r: UserRole) => {
    if (me.role === "gerente" && r !== "asesor") return; // gerente no puede promover
    if (r === "promotor") {
      set("role", r);
      set("promoterId", undefined); // es él mismo
      set("managerId", undefined);
    } else if (r === "gerente") {
      set("role", r);
      set("managerId", undefined);
      set("promoterId", me.role === "promotor" ? me.id : form.promoterId);
    } else { // asesor
      set("role", r);
      // mantener manager/promoter si ya existen
      if (!form.managerId) set("managerId", me.role === "gerente" ? me.id : undefined);
      if (!form.promoterId) set("promoterId", me.role === "promotor" ? me.id : form.promoterId);
    }
  };

  const canPickRole = (target: UserRole) => {
    if (me.role === "promotor") return true;
    if (me.role === "gerente") return target === "asesor";
    return false;
  };

  const submit = () => {
    // Validaciones básicas
    if (!form.name || !form.username || !form.password) {
      alert("Nombre, usuario y contraseña son obligatorios.");
      return;
    }
    if (form.role === "asesor" && (!form.managerId || !form.promoterId)) {
      alert("Selecciona gerente y promotor para el asesor.");
      return;
    }
    if (form.role === "gerente" && !form.promoterId) {
      alert("Selecciona promotor para el gerente.");
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Nombre completo">
        <Input value={form.name} onChange={e => set("name", (e.target as HTMLInputElement).value)} />
      </Field>
      <Field label="Usuario (login)">
        <Input value={form.username} onChange={e => set("username", (e.target as HTMLInputElement).value)} />
      </Field>
      <Field label="Contraseña">
        <Input type="password" value={form.password} onChange={e => set("password", (e.target as HTMLInputElement).value)} />
      </Field>
      <Field label="Rol">
        <Select value={form.role} onValueChange={onChangeRole}>
          <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
          <SelectContent>
            {ROLES.filter(canPickRole).map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Fecha de inicio">
        <Input type="date" value={form.startDate || ""} onChange={e => set("startDate", (e.target as HTMLInputElement).value)} />
      </Field>

      {form.role !== "promotor" && (
        <>
          <Field label="Promotor">
            <Select value={form.promoterId || ""} onValueChange={(v) => set("promoterId", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
              <SelectContent>
                {promoters.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {form.role === "asesor" && (
            <Field label="Gerente">
              <Select value={form.managerId || ""} onValueChange={(v) => set("managerId", v)}>
                <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
                <SelectContent>
                  {managers.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </>
      )}

      <DialogFooter className="col-span-2 mt-2">
        <Button onClick={submit} className="w-full">{initial ? "Actualizar usuario" : "Crear usuario"}</Button>
      </DialogFooter>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-neutral-600">{label}</Label>
      {children}
    </div>
  );
}
