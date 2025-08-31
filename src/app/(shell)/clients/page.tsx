"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { Plus } from "lucide-react";

import type { Client } from "@/lib/types";
import { uid } from "@/lib/types";
import { repo, LS_KEYS } from "@/lib/storage";
import { getCurrentUser, filterByScope } from "@/lib/users";
import { setContactado } from "@/features/clients/utils/contactado";

// Repos locales
const ClientsRepo = repo<Client>(LS_KEYS.clients);

// Helpers
const toAge = (iso?: string) => {
  if (!iso) return undefined;
  const d = new Date(iso);
  const diff = new Date(Date.now() - d.getTime());
  return Math.abs(diff.getUTCFullYear() - 1970);
};

const clientStatusClass: Record<NonNullable<Client["estatus"]>, string> = {
  Prospecto: "bg-sky-100 text-sky-800",
  Cliente: "bg-emerald-100 text-emerald-800",
  Inactivo: "bg-neutral-200 text-neutral-800",
  Referido: "bg-violet-100 text-violet-800",
};

// Formatea teléfono con espacios (ej. 55 1234 5678)
function fmtPhone(v?: string) {
  if (!v) return "";
  const digits = v.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `${digits.slice(0,2)} ${digits.slice(2)}`;
  return `${digits.slice(0,2)} ${digits.slice(2,6)} ${digits.slice(6,10)}`.trim();
}

// Página
function ClientsPage() {
  const current = getCurrentUser();
  const allowContactToggle = current?.role === "asesor"; // promotor/gerente disabled
  const [rows, setRows] = useState<Client[]>(() => ClientsRepo.list());
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"created" | "name" | "status">("created");
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{ open: boolean; client: Client | null }>({ open: false, client: null });

  // Persistencia
  useEffect(() => {
    ClientsRepo.saveAll(rows);
  }, [rows]);

  // Alcance por usuario (asesor/gerente/promotor)
  const scoped = useMemo(() => {
    const base = current ? filterByScope(rows, current, r => (r as Client).ownerId) : rows;
    return base;
  }, [rows, current]);

  // Búsqueda + orden
  const filtered = useMemo(() => {
    const bySearch = scoped.filter((r) =>
      (
        `${r.nombre} ${r.apellidoPaterno || ""} ${r.apellidoMaterno || ""}`.toLowerCase().includes(q.toLowerCase()) ||
        (r.email || "").toLowerCase().includes(q.toLowerCase()) ||
        (r.telefono || "").replace(/\s+/g, "").includes(q.replace(/\s+/g, ""))
      )
    );
    const sorted = [...bySearch].sort((a, b) => {
      if (sortBy === "created") {
        const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bd - ad; // recientes primero
      }
      if (sortBy === "name") {
        return `${a.nombre} ${a.apellidoPaterno || ""}`.localeCompare(
          `${b.nombre} ${b.apellidoPaterno || ""}`
        );
      }
      // status
      const sa = a.estatus || "Prospecto";
      const sb = b.estatus || "Prospecto";
      return sa.localeCompare(sb);
    });
    return sorted;
  }, [scoped, q, sortBy]);

  // Crear/Actualizar/Borrar
  const handleCreate = (c: Client) => {
    const ownerId = current?.id;
    const withMeta: Client = {
      ...c,
      ownerId,
      createdAt: c.createdAt || new Date().toISOString(),
    };
  // ensure contacto date when created as contactado
  if (withMeta.contactado && !withMeta.contactado_fecha) withMeta.contactado_fecha = new Date().toISOString();
    const updated = [withMeta, ...rows];
    ClientsRepo.saveAll(updated);
    setRows(updated);
    setOpenNew(false);
  };

  const handleUpdate = (c: Client) => {
    // normalize contactado_fecha
    const prev = ClientsRepo.list();
    const existing = prev.find(x => x.id === c.id);
    let merged: Client = { ...c };
    if (existing) {
      if (Boolean(existing.contactado) !== Boolean(c.contactado)) {
        // use helper to preserve/set contactado_fecha
        const updated = setContactado(c.id, Boolean(c.contactado));
        if (updated) {
          merged = { ...updated, ...c } as Client;
        }
      }
      // preserve metadata fields that should not get lost on edit
      merged.ownerId = existing.ownerId || merged.ownerId;
      merged.createdAt = existing.createdAt || merged.createdAt;
    }
    const newList = prev.map(x => x.id === c.id ? merged : x);
    ClientsRepo.saveAll(newList);
    setRows(newList);
    setOpenEdit({ open: false, client: null });
  };

  const handleDelete = (id: string) => {
    const newList = ClientsRepo.list().filter((x) => x.id !== id);
    ClientsRepo.saveAll(newList);
    setRows(newList);
    setOpenEdit({ open: false, client: null });
  };

  const toggleContactado = (id: string, val: boolean) => {
    const updated = setContactado(id, val);
    if (updated) {
      const list = ClientsRepo.list();
      setRows(list);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Clientes</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por nombre, email o teléfono…"
            value={q}
            onChange={(e) => setQ((e.target as HTMLInputElement).value)}
            className="w-64"
          />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Ordenar por"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Fecha de creación</SelectItem>
              <SelectItem value="name">Nombre (A-Z)</SelectItem>
              <SelectItem value="status">Estatus</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2" size={16}/>Nuevo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
              <ClientForm onSubmit={handleCreate} />
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
                <th className="text-left p-3">Teléfono</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Estatus</th>
                <th className="text-left p-3">Edad</th>
                <th className="text-left p-3">Creado</th>
                <th className="text-left p-3">Contactado</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3">{c.nombre} {c.apellidoPaterno} {c.apellidoMaterno}</td>
                  <td className="p-3">{fmtPhone(c.telefono)}</td>
                  <td className="p-3">{c.email}</td>
                  <td className="p-3">
                    <Badge className={clientStatusClass[(c.estatus || "Prospecto") as NonNullable<Client["estatus"]>]}> 
                      {c.estatus || "Prospecto"}
                    </Badge>
                  </td>
                  <td className="p-3">{toAge(c.fechaNacimiento) ?? "-"}</td>
                  <td className="p-3">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "-"}</td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={Boolean(c.contactado)}
                      disabled={!allowContactToggle}
                      onChange={(e)=> toggleContactado(c.id, e.currentTarget.checked)}
                    />
                  </td>
                  <td className="p-3 space-x-2">
                    <Button variant="secondary" size="sm" onClick={() => setOpenEdit({ open: true, client: c })}>Editar</Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-sm text-muted-foreground" colSpan={8}>Sin resultados</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={openEdit.open} onOpenChange={(o) => setOpenEdit({ open: o, client: o ? openEdit.client : null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
          {openEdit.client && (
            <ClientForm
              initial={openEdit.client}
              onSubmit={handleUpdate}
              onDelete={() => {
                if (openEdit.client && window.confirm("¿Eliminar cliente y todos sus datos asociados?")) {
                  handleDelete(openEdit.client.id);
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
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

function ClientForm({ initial, onSubmit, onDelete }: { initial?: Client | null; onSubmit: (c: Client) => void; onDelete?: () => void; }) {
  const user = getCurrentUser();
  const allowContactToggle = user?.role === "asesor"; // promotor/gerente disabled
  const schema = z.object({
    id: z.string().min(1),
    nombre: z.string().min(1, "Nombre requerido"),
    apellidoPaterno: z.string().optional().nullable(),
    apellidoMaterno: z.string().optional().nullable(),
    telefono: z.string().optional().nullable(),
  // Email NO obligatorio ni con formato estricto
  email: z.string().optional().nullable(),
    fechaNacimiento: z.string().optional().nullable(),
    sexo: z.enum(["Masculino","Femenino","Otro"]).optional().nullable(),
    estadoCivil: z.string().optional().nullable(),
    estadoResidencia: z.string().optional().nullable(),
    ocupacion: z.string().optional().nullable(),
    empresa: z.string().optional().nullable(),
    ingresoHogar: z.number().optional().nullable(),
    dependientes: z.number().optional().nullable(),
    fumador: z.boolean().optional().nullable(),
    fuente: z.string().optional().nullable(),
    estatus: z.enum(["Prospecto","Cliente","Inactivo","Referido"]).default("Prospecto"),
    ultimoContacto: z.string().optional().nullable(),
    anfRealizado: z.boolean().optional().nullable(),
    anfFecha: z.string().optional().nullable(),
    createdAt: z.string().optional().nullable(),
  contactado: z.boolean().default(false),
  contactado_fecha: z.date().nullable().optional(),
  });
  const [form, setForm] = useState<Client>(
    initial || { id: uid(), nombre: "", estatus: "Prospecto", createdAt: new Date().toISOString(), contactado: false }
  );
  useEffect(() => { if (initial) setForm(initial); }, [initial]);
  const set = (k: keyof Client, v: any) => setForm((prev) => ({ ...prev, [k]: v }));
  const isEdit = Boolean(initial);

  return (
    <div className="grid grid-cols-2 gap-3">
  <div className="col-span-2 grid grid-cols-2 gap-3">
        <Field label="Nombre"><Input value={form.nombre} onChange={(e) => set("nombre", (e.target as HTMLInputElement).value)} /></Field>
        <Field label="Apellido paterno"><Input value={form.apellidoPaterno || ""} onChange={(e) => set("apellidoPaterno", (e.target as HTMLInputElement).value)} /></Field>
        <Field label="Apellido materno"><Input value={form.apellidoMaterno || ""} onChange={(e) => set("apellidoMaterno", (e.target as HTMLInputElement).value)} /></Field>
        <Field label="Teléfono"><Input value={form.telefono || ""} onChange={(e) => set("telefono", (e.target as HTMLInputElement).value)} placeholder="55 1234 5678" /></Field>
        <Field label="Correo electrónico"><Input value={form.email || ""} onChange={(e) => set("email", (e.target as HTMLInputElement).value)} /></Field>
        <Field label="Fecha de nacimiento"><Input type="date" value={form.fechaNacimiento || ""} onChange={(e) => set("fechaNacimiento", (e.target as HTMLInputElement).value)} /></Field>
        <Field label="Sexo">
          <Select value={form.sexo} onValueChange={(v) => set("sexo", v as any)}>
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Masculino">Masculino</SelectItem>
              <SelectItem value="Femenino">Femenino</SelectItem>
              <SelectItem value="Otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Estado civil">
          <Select value={form.estadoCivil} onValueChange={(v) => set("estadoCivil", v as any)}>
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Soltero(a)">Soltero(a)</SelectItem>
              <SelectItem value="Casado(a)">Casado(a)</SelectItem>
              <SelectItem value="Unión libre">Unión libre</SelectItem>
              <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
              <SelectItem value="Viudo(a)">Viudo(a)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Estado de residencia"><Input value={form.estadoResidencia || ""} onChange={(e) => set("estadoResidencia", (e.target as HTMLInputElement).value)} /></Field>
        <Field label="Ocupación"><Input value={form.ocupacion || ""} onChange={(e) => set("ocupacion", (e.target as HTMLInputElement).value)} /></Field>
        <Field label="Empresa"><Input value={form.empresa || ""} onChange={(e) => set("empresa", (e.target as HTMLInputElement).value)} /></Field>
        <Field label="Ingreso total del hogar (MXN)"><Input type="number" value={form.ingresoHogar || ""} onChange={(e) => set("ingresoHogar", Number((e.target as HTMLInputElement).value))} /></Field>
        <Field label="Dependientes"><Input type="number" value={form.dependientes || ""} onChange={(e) => set("dependientes", Number((e.target as HTMLInputElement).value))} /></Field>
        <Field label="Fumador">
          <Select value={form.fumador ? "si" : "no"} onValueChange={(v) => set("fumador", v === "si")}> 
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="si">Sí</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Fuente de prospección">
          <Select value={form.fuente} onValueChange={(v) => set("fuente", v as any)}>
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              {["Mercado natural","Referido","Redes","Frío","Evento","COI","Otros"].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Estatus">
          <Select value={form.estatus} onValueChange={(v) => set("estatus", v as any)}>
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              {["Prospecto","Cliente","Inactivo","Referido"].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Último contacto"><Input type="date" value={form.ultimoContacto || ""} onChange={(e) => set("ultimoContacto", (e.target as HTMLInputElement).value)} /></Field>
        <Field label="ANF realizado">
          <Select value={form.anfRealizado ? "si" : "no"} onValueChange={(v) => set("anfRealizado", v === "si")}> 
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="si">Sí</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Fecha ANF"><Input type="date" value={form.anfFecha || ""} onChange={(e) => set("anfFecha", (e.target as HTMLInputElement).value)} /></Field>
        <Field label="Fecha de creación"><Input type="date" value={(form.createdAt ? form.createdAt.slice(0,10) : new Date().toISOString().slice(0,10))} onChange={(e) => set("createdAt", new Date((e.target as HTMLInputElement).value).toISOString())} /></Field>
        <Field label="Contactado">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.contactado}
              disabled={!allowContactToggle}
              onChange={(e) => {
                const checked = (e.target as HTMLInputElement).checked;
                set("contactado", checked);
                set("contactado_fecha", checked ? new Date() : null);
              }}
            />
            <span className="text-xs text-neutral-600">{form.contactado ? (form.contactado_fecha ? new Date(form.contactado_fecha as any).toLocaleString() : new Date().toLocaleString()) : "—"}</span>
          </div>
        </Field>
      </div>
      <DialogFooter className="col-span-2 mt-2 flex items-center justify-between gap-2">
        {isEdit && (
          <Button variant="destructive" type="button" onClick={() => onDelete && onDelete()}>Borrar cliente</Button>
        )}
    <Button onClick={async () => {
            // validate
      const parsed = schema.safeParse({ ...form, contactado_fecha: form.contactado ? (form.contactado_fecha ? new Date(form.contactado_fecha as any) : new Date()) : null });
            if (!parsed.success) {
              alert(parsed.error.issues.map(i=>i.message).join("\n"));
              return;
            }
      // Normaliza email vacío a null para evitar conflictos/validación
      const payload = { ...parsed.data } as Client;
      if (!payload.email || (payload.email as any).trim?.() === "") payload.email = null as any;
      // normalize contactado_fecha in local payload
      if (payload.contactado) payload.contactado_fecha = (payload as any).contactado_fecha || new Date();
      else payload.contactado_fecha = null;
            // optional Supabase upsert
      try {
              const sb = (await import("@/lib/supabaseClient")).getSupabase();
              if (sb) {
                // map fields to DB columns if needed
        const dbRow: any = {
          ...payload,
          email: payload.email || null,
          contactado_fecha: payload.contactado
            ? ((payload as any).contactado_fecha instanceof Date
                ? (payload as any).contactado_fecha.toISOString()
                : (payload as any).contactado_fecha || new Date().toISOString())
            : null,
        };
    const { data, error } = await sb.from("clients").upsert(dbRow, { onConflict: "id" }).select("id, contactado, contactado_fecha").single();
        if (error) console.warn("Supabase: upsert client error", error.message);
        else console.info("Supabase: upsert client ok", data);
              }
            } catch {}
            onSubmit(payload);
          }} className="ml-auto">{isEdit ? "Actualizar cliente" : "Guardar cliente"}</Button>
      </DialogFooter>
    </div>
  );
}

export default ClientsPage;
