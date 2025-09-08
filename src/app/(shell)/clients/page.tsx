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
import { Plus, ArrowUpDown } from "lucide-react";

import type { Client, Policy } from "@/lib/types";
import { uid } from "@/lib/types";
import { repo, LS_KEYS } from "@/lib/storage"; // mantiene policies locales temporalmente
import { getCurrentUser, filterByScope, visibleOwnerIdsFor } from "@/lib/users";
import { setContactado } from "@/features/clients/utils/contactado"; // aún usado para lógica de fecha local
import { listRemoteClients, upsertRemoteClient, deleteRemoteClient, toggleRemoteContactado } from "@/lib/data/clients";

// Repos locales (policies y fallback de clients mientras migramos)
const PoliciesRepo = repo<Policy>(LS_KEYS.policies);
const LocalClientsRepo = repo<Client>(LS_KEYS.clients);

// Helpers
const toAge = (iso?: string) => {
  if (!iso) return undefined;
  const d = new Date(iso);
  const diff = new Date(Date.now() - d.getTime());
  return Math.abs(diff.getUTCFullYear() - 1970);
};

const clientStatusClass: Record<NonNullable<Client["estatus"]>, string> = {
  Prospecto: "bg-sky-100 text-sky-800",
  Interesado: "bg-amber-100 text-amber-800",
  Cliente: "bg-emerald-100 text-emerald-800",
  Inactivo: "bg-neutral-200 text-neutral-800",
  Referido: "bg-neutral-200 text-neutral-800",
  "No interesado": "bg-rose-100 text-rose-800",
};

// Mapeo para upsert en Supabase (normaliza nullables y fechas)
interface ClientDBRow extends Omit<Client, "email" | "contactado_fecha"> {
  email: string | null;
  contactado_fecha: string | null;
}

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
  const [rows, setRows] = useState<Client[]>([]);
  const [source, setSource] = useState<'remote' | 'local'>('remote');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"created" | "name" | "status" | "contact">("created");
  const [invert, setInvert] = useState(false);
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{ open: boolean; client: Client | null }>({ open: false, client: null });

  // Carga inicial desde Supabase (si está configurado)
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const remote = await listRemoteClients();
        if (!active) return;
        if (remote.length) {
          setRows(remote);
          setSource('remote');
        } else {
          // Fallback a clientes locales si supabase no configurado o vacío
          const local = LocalClientsRepo.list();
          if (local.length) {
            setRows(local);
            setSource('local');
          } else {
            setRows([]);
            setSource('remote');
          }
        }
      } catch (e) {
        // Intentamos fallback local si existe
        const local = LocalClientsRepo.list();
        if (local.length) {
          setRows(local);
          setSource('local');
        }
        setLoadError("No se pudo cargar clientes remotos");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Alcance por usuario (asesor/gerente/promotor)
  // Filtro de alcance que permite registros sin ownerId (anteriores a migración)
  const scoped = useMemo<Client[]>(() => {
    if (!current) return rows;
    const allowed = new Set(visibleOwnerIdsFor(current));
    return rows.filter(r => {
      if (!r.ownerId) return true; // mostrar huérfanos para poder asignarlos luego
      return allowed.has(r.ownerId);
    });
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
      if (sortBy === "contact") {
        const ac = Number(Boolean(a.contactado));
        const bc = Number(Boolean(b.contactado));
        if (ac !== bc) return ac - bc; // 0 (no contactado) primero
        // tie-breaker: recent created first
        const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bd - ad;
      }
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
    return invert ? sorted.reverse() : sorted;
  }, [scoped, q, sortBy, invert]);

  // Crear/Actualizar/Borrar
  const handleCreate = async (c: Client) => {
    if (!current) return;
    const withMeta: Client = {
      ...c,
      ownerId: current.id,
      createdAt: c.createdAt || new Date().toISOString(),
    };
    if (withMeta.contactado && !withMeta.contactado_fecha) withMeta.contactado_fecha = new Date();
    const saved = await upsertRemoteClient(withMeta);
    if (saved) {
      setRows(prev => [saved, ...prev]);
      setOpenNew(false);
    }
  };

  const handleUpdate = async (c: Client) => {
    // Mantiene owner/createdAt originales si existen en estado actual
    const existing = rows.find(x => x.id === c.id);
    let merged: Client = { ...c };
    if (existing) {
      merged.ownerId = existing.ownerId || merged.ownerId;
      merged.createdAt = existing.createdAt || merged.createdAt;
      if (Boolean(existing.contactado) !== Boolean(c.contactado)) {
        // fecha de contacto si cambia estado
        merged.contactado_fecha = c.contactado ? new Date() : null;
      }
    }
    const saved = await upsertRemoteClient(merged);
    if (saved) {
      setRows(prev => prev.map(x => x.id === saved.id ? saved : x));
      setOpenEdit({ open: false, client: null });
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteRemoteClient(id);
    if (ok) {
      setRows(prev => prev.filter(x => x.id !== id));
      setOpenEdit({ open: false, client: null });
    }
  };

  const toggleContactado = async (id: string, val: boolean) => {
    const target = rows.find(r => r.id === id);
    if (!target) return;
    const saved = await toggleRemoteContactado(target, val);
    if (saved) setRows(prev => prev.map(x => x.id === id ? saved : x));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Clientes</h2>
        {source === 'local' && (
          <span className="text-[11px] px-2 py-1 rounded bg-amber-100 text-amber-800 font-medium" title="Mostrando datos locales porque no se obtuvieron clientes remotos">LOCAL</span>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por nombre, email o teléfono…"
            value={q}
            onChange={(e) => setQ((e.target as HTMLInputElement).value)}
            className="w-64"
          />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Ordenar por"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Fecha de creación</SelectItem>
              <SelectItem value="name">Nombre (A-Z)</SelectItem>
              <SelectItem value="status">Estatus</SelectItem>
              <SelectItem value="contact">Contactados</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={invert ? "secondary" : "outline"}
            onClick={() => setInvert((v) => !v)}
            title="Invertir orden"
            className="px-2"
          >
            <ArrowUpDown size={16} />
          </Button>
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
          {loading && (
            <div className="p-4 text-sm text-neutral-500">Cargando clientes…</div>
          )}
          {loadError && !loading && (
            <div className="p-4 text-sm text-red-600">{loadError}</div>
          )}
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-neutral-700">
              <tr>
                <th className="text-left p-3">Nombre</th>
                <th className="text-left p-3 hidden md:table-cell">Teléfono</th>
                <th className="text-left p-3 hidden md:table-cell">Email</th>
                <th className="text-left p-3">Estatus</th>
                <th className="text-left p-3">Pólizas</th>
                <th className="text-left p-3 hidden md:table-cell">Edad</th>
                <th className="text-left p-3 hidden md:table-cell">Creado</th>
                <th className="text-left p-3">Contactado</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.map((c) => (
                <tr key={c.id} className="border-t align-top">
                  <td className="p-3 align-top">
                    <div className="font-medium">{c.nombre} {c.apellidoPaterno} {c.apellidoMaterno}</div>
                    <div className="md:hidden mt-1 text-xs text-neutral-500 space-y-0.5">
                      {c.telefono && <div>{fmtPhone(c.telefono)}</div>}
                      {c.email && <div className="truncate max-w-[160px]">{c.email}</div>}
                    </div>
                  </td>
                  <td className="p-3 hidden md:table-cell whitespace-nowrap">{fmtPhone(c.telefono)}</td>
                  <td className="p-3 hidden md:table-cell">{c.email}</td>
                  <td className="p-3 whitespace-nowrap">
                    <Badge className={clientStatusClass[(c.estatus || "Prospecto") as NonNullable<Client["estatus"]>]}> 
                      {c.estatus || "Prospecto"}
                    </Badge>
                  </td>
                  <td className="p-3"><PoliciesSummaryHover clientId={c.id} /></td>
                  <td className="p-3 hidden md:table-cell">{toAge(c.fechaNacimiento) ?? "-"}</td>
                  <td className="p-3 hidden md:table-cell">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "-"}</td>
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
              {!loading && filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-sm text-muted-foreground" colSpan={9}>Sin resultados</td>
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
  estatus: z.enum(["Prospecto","Interesado","Cliente","Inactivo","Referido","No interesado"]).default("Prospecto"),
    ultimoContacto: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
    anfRealizado: z.boolean().optional().nullable(),
    anfFecha: z.string().optional().nullable(),
    createdAt: z.string().optional().nullable(),
  contactado: z.boolean().default(false),
  // A nivel de formulario manejamos Date; en el modelo puede almacenarse Date o string
  contactado_fecha: z.date().nullable().optional(),
  });
  const [form, setForm] = useState<Client>(
    initial || { id: uid(), nombre: "", estatus: "Prospecto", createdAt: new Date().toISOString(), contactado: false, notas: "" }
  );
  useEffect(() => { if (initial) setForm(initial); }, [initial]);
  const set = <K extends keyof Client>(k: K, v: Client[K]) => setForm((prev) => ({ ...prev, [k]: v }));
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
          <Select value={form.sexo} onValueChange={(v) => set("sexo", v as Client["sexo"])}>
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Masculino">Masculino</SelectItem>
              <SelectItem value="Femenino">Femenino</SelectItem>
              <SelectItem value="Otro">Otro</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Estado civil">
          <Select value={form.estadoCivil} onValueChange={(v) => set("estadoCivil", v as Client["estadoCivil"])}>
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
          <Select value={form.fuente} onValueChange={(v) => set("fuente", v as Client["fuente"])}>
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
              {["Mercado natural","Referido","Redes","Frío","Evento","COI","Otros"].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Estatus">
          <Select value={form.estatus} onValueChange={(v) => set("estatus", v as Client["estatus"])}>
            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
            <SelectContent>
                { ["Prospecto","Interesado","Cliente","Inactivo","Referido","No interesado"].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Último contacto"><Input type="date" value={form.ultimoContacto || ""} onChange={(e) => set("ultimoContacto", (e.target as HTMLInputElement).value)} /></Field>
        <div className="col-span-2">
          <Field label="Notas">
            <Textarea value={form.notas || ""} onChange={(e) => set("notas", (e.target as HTMLTextAreaElement).value)} />
          </Field>
        </div>
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
            <span className="text-xs text-neutral-600">
              {form.contactado
                ? (() => {
                    const raw = form.contactado_fecha;
                    const d = raw ? (raw instanceof Date ? raw : new Date(raw)) : null;
                    return d ? d.toLocaleString() : new Date().toLocaleString();
                  })()
                : "—"}
            </span>
          </div>
        </Field>
      </div>
      <DialogFooter className="col-span-2 mt-2 flex items-center justify-between gap-2">
        {isEdit && (
          <Button variant="destructive" type="button" onClick={() => onDelete && onDelete()}>Borrar cliente</Button>
        )}
  <Button onClick={async () => {
            // Normaliza fecha de contacto para validación (Date o null)
            const contactadoFechaForValidation = form.contactado
              ? (form.contactado_fecha
                  ? (form.contactado_fecha instanceof Date
                      ? form.contactado_fecha
                      : new Date(form.contactado_fecha))
                  : new Date())
              : null;
            const parsed = schema.safeParse({ ...form, contactado_fecha: contactadoFechaForValidation });
            if (!parsed.success) {
              alert(parsed.error.issues.map(i=>i.message).join("\n"));
              return;
            }
            type ClientFormSchema = z.infer<typeof schema>;
            const base: ClientFormSchema = parsed.data;
            // Convertimos null -> undefined para campos opcionales del dominio
            const normalizeNullable = <T,>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);
            const payload: Client = {
              id: base.id,
              nombre: base.nombre,
              apellidoPaterno: normalizeNullable(base.apellidoPaterno || undefined),
              apellidoMaterno: normalizeNullable(base.apellidoMaterno || undefined),
              telefono: normalizeNullable(base.telefono || undefined),
              email: normalizeNullable(base.email || undefined),
              fechaNacimiento: normalizeNullable(base.fechaNacimiento || undefined),
              sexo: normalizeNullable(base.sexo || undefined),
              estadoCivil: normalizeNullable(base.estadoCivil as Client["estadoCivil"] | null | undefined),
              estadoResidencia: normalizeNullable(base.estadoResidencia || undefined),
              ocupacion: normalizeNullable(base.ocupacion || undefined),
              empresa: normalizeNullable(base.empresa || undefined),
              ingresoHogar: normalizeNullable(base.ingresoHogar || undefined),
              dependientes: normalizeNullable(base.dependientes || undefined),
              fumador: normalizeNullable(base.fumador || undefined),
              fuente: normalizeNullable(base.fuente as Client["fuente"] | null | undefined),
              estatus: base.estatus,
              ultimoContacto: normalizeNullable(base.ultimoContacto || undefined),
              notas: normalizeNullable(base.notas || undefined),
              anfRealizado: normalizeNullable(base.anfRealizado || undefined),
              anfFecha: normalizeNullable(base.anfFecha || undefined),
              createdAt: normalizeNullable(base.createdAt || undefined),
              contactado: base.contactado,
              contactado_fecha: base.contactado_fecha || undefined,
            };
            if (!payload.email || payload.email.trim() === "") payload.email = undefined;
            if (payload.contactado) {
              // asegura instancia Date
              payload.contactado_fecha = payload.contactado_fecha
                ? (payload.contactado_fecha instanceof Date
                    ? payload.contactado_fecha
                    : new Date(payload.contactado_fecha))
                : new Date();
            } else {
              payload.contactado_fecha = null;
            }
            onSubmit(payload);
          }} className="ml-auto">{isEdit ? "Actualizar cliente" : "Guardar cliente"}</Button>
      </DialogFooter>
    </div>
  );
}

export default ClientsPage;

// --- Hover resumen de pólizas -------------------------------------------
function PoliciesSummaryHover({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = () => {
    if (policies.length) return; // cache simple
    const all = PoliciesRepo.list();
    setPolicies(all.filter(p => p.clienteId === clientId));
  };
  const show = () => { timerRef.current = setTimeout(() => { load(); setOpen(true); }, 350); };
  const hide = () => { if (timerRef.current) clearTimeout(timerRef.current); setOpen(false); };

  const fmtDate = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  };
  const totalPrima = policies.reduce((acc, p) => acc + (p.primaMensual || 0), 0);

  return (
    <div className="relative inline-block"
         onMouseEnter={show} onMouseLeave={hide}
         onFocus={show} onBlur={hide}>
      <span className="cursor-help underline decoration-dotted">
        {policies.length}
      </span>
      {open && (
        <div className="absolute z-30 left-0 mt-2 w-80 max-h-80 overflow-hidden bg-white border shadow-lg rounded-md p-2 text-xs animate-in fade-in-0 zoom-in-95">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-semibold text-neutral-600">Pólizas: {policies.length}</span>
            {policies.length > 0 && (
              <span className="text-[11px] text-neutral-500">Total {totalPrima.toLocaleString("es-MX", { style: "currency", currency: (policies[0]?.moneda)||"MXN" })}</span>
            )}
          </div>
          {policies.length === 0 && <div className="text-neutral-500 py-1">Sin pólizas</div>}
          {policies.length > 0 && (
            <div className="divide-y overflow-auto max-h-64 pr-1">
              {policies.map(p => {
                const prima = p.primaMensual ? p.primaMensual.toLocaleString("es-MX", { style: "currency", currency: p.moneda || "MXN" }) : "-";
                const renov = fmtDate(p.fechaPago || p.fechaEntrega || p.createdAt);
                return (
                  <div key={p.id} className="py-2 space-y-1">
                    <div className="font-medium text-neutral-800 leading-snug">{p.plan || "(Plan)"}</div>
                    <div className="flex justify-between gap-2">
                      <span className="text-neutral-500">Renovación:</span>
                      <span>{renov}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-neutral-500">Prima:</span>
                      <span>{prima}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-neutral-500">Moneda:</span>
                      <span>{p.moneda || "MXN"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
