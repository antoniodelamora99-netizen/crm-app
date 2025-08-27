

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

/* ============================================================
   Helpers
============================================================ */
function Field({label, children}:{label:string; children:React.ReactNode}) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-neutral-600">{label}</Label>
      {children}
    </div>
  );
}

const roleBadge: Record<UserRole, string> = {
  asesor: "bg-sky-100 text-sky-800",
  gerente: "bg-amber-100 text-amber-800",
  promotor: "bg-emerald-100 text-emerald-800",
};

function canCreate(current: User | null, roleToCreate: UserRole): boolean {
  if (!current) return false;
  if (current.role === "promotor") {
    return roleToCreate === "gerente" || roleToCreate === "asesor";
  }
  if (current.role === "gerente") {
    return roleToCreate === "asesor";
  }
  return false; // asesor no crea
}

function canEdit(current: User | null, target: User): boolean {
  if (!current) return false;
  if (current.role === "promotor") return true;
  if (current.role === "gerente") {
    return target.role === "asesor" && target.managerId === current.id;
  }
  return false;
}

function canDelete(current: User | null, target: User): boolean {
  // mismas reglas que editar
  return canEdit(current, target);
}

function visibleUsersFor(current: User | null, all: User[]): User[] {
  if (!current) return [];
  if (current.role === "promotor") {
    // puede ver todos los que tengan promoterId = current.id, y también otros promotores?
    // Requisito: promotor ve gerentes y asesores de su pirámide
    return all.filter(u => u.id === current.id || u.promoterId === current.id || u.managerId && all.find(m => m.id === u.managerId)?.promoterId === current.id || (u.role === "promotor" && u.id === current.id));
  }
  if (current.role === "gerente") {
    // gerente ve a sus asesores + a sí mismo
    return all.filter(u => u.id === current.id || u.managerId === current.id);
  }
  // asesor solo se ve a sí mismo
  return all.filter(u => u.id === current.id);
}

/* ============================================================
   Users Page
============================================================ */
export default function UsersPage() {
  const currentUser = getCurrentUser();

  const [rows, setRows] = useState<User[]>(getUsers());
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{open:boolean, user: User|null}>({open:false, user:null});
  const [newRole, setNewRole] = useState<UserRole>("asesor"); // default para el modal

  useEffect(()=> {
    saveUsers(rows);
  }, [rows]);

  const visible = useMemo(()=> {
    const base = visibleUsersFor(currentUser, rows);
    if (!q.trim()) return base;
    const t = q.toLowerCase();
    return base.filter(u => {
      return (
        (u.name || "").toLowerCase().includes(t) ||
        (u.username || "").toLowerCase().includes(t) ||
        (u.role || "").toLowerCase().includes(t)
      );
    });
  }, [rows, currentUser, q]);

  const managersOfCurrentPromoter = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "promotor") {
      return rows.filter(u => u.role === "gerente" && u.promoterId === currentUser.id);
    }
    if (currentUser.role === "gerente") {
      return rows.filter(u => u.id === currentUser.id);
    }
    return [];
  }, [rows, currentUser]);

  const promoters = useMemo(() => rows.filter(u => u.role === "promotor"), [rows]);

  const handleCreate = (u: User) => {
    setRows(prev => [u, ...prev]);
    setOpenNew(false);
  };
  const handleUpdate = (u: User) => {
    setRows(prev => prev.map(x => x.id === u.id ? u : x));
    setOpenEdit({open:false, user:null});
  };
  const handleDelete = (id: string) => {
    setRows(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Usuarios</h2>
        <div className="flex gap-2">
          <Input placeholder="Buscar por nombre, usuario o rol…" value={q} onChange={e=>setQ((e.target as HTMLInputElement).value)} className="w-64" />
          {(currentUser && (currentUser.role === "promotor" || currentUser.role === "gerente")) && (
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild><Button><Plus className="mr-2" size={16}/>Nuevo</Button></DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader><DialogTitle>Nuevo usuario</DialogTitle></DialogHeader>
                <NewUserForm
                  currentUser={currentUser}
                  managers={managersOfCurrentPromoter}
                  promoters={promoters}
                  roleDefault={newRole}
                  onRoleChange={setNewRole}
                  onSubmit={handleCreate}
                />
              </DialogContent>
            </Dialog>
          )}
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
              {visible.map(u=>{
                const manager = rows.find(x=>x.id === u.managerId);
                const promoter = rows.find(x=>x.id === u.promoterId);
                return (
                  <tr key={u.id} className="border-t">
                    <td className="p-3">{u.name}</td>
                    <td className="p-3">{u.username}</td>
                    <td className="p-3"><Badge className={roleBadge[u.role]}>{u.role}</Badge></td>
                    <td className="p-3">{u.startDate || "—"}</td>
                    <td className="p-3">{manager?.name || "—"}</td>
                    <td className="p-3">{promoter?.name || "—"}</td>
                    <td className="p-3 space-x-2">
                      {canEdit(currentUser, u) ? (
                        <Dialog open={openEdit.open && openEdit.user?.id === u.id} onOpenChange={(o)=> setOpenEdit({open:o, user: o? u : null})}>
                          <DialogTrigger asChild><Button variant="secondary" size="sm">Editar</Button></DialogTrigger>
                          <DialogContent className="max-w-xl">
                            <DialogHeader><DialogTitle>Editar usuario</DialogTitle></DialogHeader>
                            <EditUserForm
                              currentUser={currentUser!}
                              value={u}
                              managers={managersOfCurrentPromoter}
                              promoters={promoters}
                              onSubmit={handleUpdate}
                            />
                            <DialogFooter className="justify-between mt-2">
                              {canDelete(currentUser, u) && (
                                <Button
                                  variant="destructive"
                                  onClick={()=>{
                                    if (window.confirm("¿Eliminar este usuario? Esta acción no se puede deshacer.")) {
                                      handleDelete(u.id);
                                      setOpenEdit({open:false, user:null});
                                    }
                                  }}
                                >
                                  Eliminar usuario
                                </Button>
                              )}
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <span className="text-xs text-neutral-400">Sin permisos</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr><td className="p-4 text-sm text-muted-foreground" colSpan={7}>Sin usuarios visibles.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================================================
   Forms
============================================================ */

function NewUserForm({
  currentUser,
  managers,
  promoters,
  roleDefault,
  onRoleChange,
  onSubmit,
}:{
  currentUser: User;
  managers: User[];
  promoters: User[];
  roleDefault: UserRole;
  onRoleChange: (r:UserRole)=>void;
  onSubmit: (u:User)=>void;
}) {
  const [form, setForm] = useState<User>({
    id: Math.random().toString(36).slice(2,10),
    role: roleDefault,
    name: "",
    username: "",
    password: "",
    startDate: new Date().toISOString().slice(0,10),
    managerId: undefined,
    promoterId: undefined,
  });

  useEffect(()=> {
    setForm(prev => ({ ...prev, role: roleDefault }));
  }, [roleDefault]);

  const set = (k: keyof User, v:any)=> setForm(prev=> ({...prev, [k]: v }));

  // reglas de jerarquía por creador
  const canCreateGerente = canCreate(currentUser, "gerente");
  const canCreateAsesor  = canCreate(currentUser, "asesor");

  const roleOptions: UserRole[] = [
    ...(canCreateGerente ? (["gerente"] as UserRole[]) : []),
    ...(canCreateAsesor ? (["asesor"] as UserRole[]) : []),
  ];

  // Asignaciones automáticas
  useEffect(()=> {
    if (form.role === "gerente") {
      // gerente debe colgar de un promotor
      if (currentUser.role === "promotor") {
        setForm(prev => ({ ...prev, promoterId: currentUser.id, managerId: undefined }));
      } else {
        // Un gerente no puede crear gerentes (por regla canCreate), pero por si cambian reglas:
        setForm(prev => ({ ...prev, promoterId: undefined, managerId: undefined }));
      }
    }
    if (form.role === "asesor") {
      if (currentUser.role === "gerente") {
        setForm(prev => ({ ...prev, managerId: currentUser.id, promoterId: currentUser.promoterId }));
      } else if (currentUser.role === "promotor") {
        // promotor debe elegir a qué gerente cuelga
        // si solo hay uno, auto-seleccionarlo
        const first = managers[0];
        setForm(prev => ({ ...prev, managerId: prev.managerId ?? first?.id, promoterId: currentUser.id }));
      }
    }
  }, [form.role, currentUser, managers]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Rol">
        <Select value={form.role} onValueChange={(v)=> { onRoleChange(v as UserRole); set("role", v as UserRole); }}>
          <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
          <SelectContent>
            {roleOptions.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No tienes permisos para crear usuarios.</div>}
            {roleOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Nombre completo"><Input value={form.name} onChange={e=>set("name", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Usuario (login)"><Input value={form.username} onChange={e=>set("username", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Contraseña"><Input type="password" value={form.password} onChange={e=>set("password", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Fecha de inicio"><Input type="date" value={form.startDate || ""} onChange={e=>set("startDate", (e.target as HTMLInputElement).value)} /></Field>

      {form.role === "asesor" && currentUser.role === "promotor" && (
        <Field label="Gerente asignado">
          <Select value={form.managerId || ""} onValueChange={(v)=>set("managerId", v)}>
            <SelectTrigger><SelectValue placeholder="Selecciona gerente"/></SelectTrigger>
            <SelectContent>
              {managers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}

      <div className="col-span-2 mt-2">
        <Button
          className="w-full"
          onClick={()=>{
            if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
              alert("Nombre, usuario y contraseña son obligatorios.");
              return;
            }
            if (form.role === "asesor" && !form.managerId) {
              alert("Selecciona un gerente para el asesor.");
              return;
            }
            onSubmit(form);
          }}
        >
          Crear usuario
        </Button>
      </div>
    </div>
  );
}

function EditUserForm({
  currentUser,
  value,
  managers,
  promoters,
  onSubmit,
}:{
  currentUser: User;
  value: User;
  managers: User[];
  promoters: User[];
  onSubmit: (u:User)=>void;
}) {
  const [form, setForm] = useState<User>(value);
  useEffect(()=> { setForm(value); }, [value]);
  const set = (k: keyof User, v:any)=> setForm(prev=> ({...prev, [k]: v }));

  const canChangeRole = currentUser.role === "promotor" || (currentUser.role === "gerente" && value.role === "asesor");

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Nombre completo"><Input value={form.name} onChange={e=>set("name", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Usuario (login)"><Input value={form.username} onChange={e=>set("username", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Contraseña (opcional)"><Input type="password" value={form.password || ""} onChange={e=>set("password", (e.target as HTMLInputElement).value)} placeholder="Deja igual si no cambia" /></Field>
      <Field label="Fecha de inicio"><Input type="date" value={form.startDate || ""} onChange={e=>set("startDate", (e.target as HTMLInputElement).value)} /></Field>

      {canChangeRole && (
        <Field label="Rol">
          <Select value={form.role} onValueChange={(v)=>set("role", v as UserRole)}>
            <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
            <SelectContent>
              {currentUser.role === "promotor" && (
                <>
                  <SelectItem value="gerente">gerente</SelectItem>
                  <SelectItem value="asesor">asesor</SelectItem>
                  <SelectItem value="promotor">promotor</SelectItem>
                </>
              )}
              {currentUser.role === "gerente" && (
                <>
                  <SelectItem value="asesor">asesor</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </Field>
      )}

      {/* Solo visible para promotor */}
      {currentUser.role === "promotor" && (
        <Field label="Promotor asignado">
          <Select value={form.promoterId || ""} onValueChange={(v)=>set("promoterId", v)}>
            <SelectTrigger><SelectValue placeholder="Selecciona promotor"/></SelectTrigger>
            <SelectContent>
              {promoters.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}

      {/* Manager asignado (para asesores) */}
      {(form.role === "asesor") && (
        <Field label="Gerente asignado">
          <Select value={form.managerId || ""} onValueChange={(v)=>set("managerId", v)}>
            <SelectTrigger><SelectValue placeholder="Selecciona gerente"/></SelectTrigger>
            <SelectContent>
              {managers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      )}

      <div className="col-span-2 mt-2">
        <Button
          className="w-full"
          onClick={()=>{
            if (!form.name.trim() || !form.username.trim()) {
              alert("Nombre y usuario son obligatorios.");
              return;
            }
            if (form.role === "asesor" && !form.managerId) {
              alert("Selecciona un gerente para el asesor.");
              return;
            }
            onSubmit(form);
          }}
        >
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}