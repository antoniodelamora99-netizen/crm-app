"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { Client, uid } from "@/lib/types";
import { repo, LS_KEYS } from "@/lib/storage";
import { getCurrentUser, filterByScope } from "@/lib/users";
import { setContactado } from "@/features/clients/utils/contactado";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// --- contactado flag helpers -----------------------------------------

// --- helpers / constants (local) -----------------------------------------
const MEX_STATES = [
  "Aguascalientes","Baja California","Baja California Sur","Campeche","Coahuila","Colima",
  "Chiapas","Chihuahua","Ciudad de México","Durango","Guanajuato","Guerrero","Hidalgo",
  "Jalisco","Estado de México","Michoacán","Morelos","Nayarit","Nuevo León","Oaxaca",
  "Puebla","Querétaro","Quintana Roo","San Luis Potosí","Sinaloa","Sonora","Tabasco",
  "Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas"
];

function formatMXPhone(raw: string){
  const d = (raw||"").replace(/\D/g, "");
  // 10 dígitos mx: 2-4-4 (ej: 55 1234 5678)
  if(d.length <= 2) return d;
  if(d.length <= 6) return `${d.slice(0,2)} ${d.slice(2)}`.trim();
  return `${d.slice(0,2)} ${d.slice(2,6)} ${d.slice(6,10)}`.trim();
}

// --- status helpers/options -----------------------------------------
const STATUS_OPTIONS = ["Prospecto","Cliente","Inactivo","Referido"] as const;
function statusClasses(s?: string){
  const key = (s||"Prospecto").toLowerCase();
  switch(key){
    case "cliente": return "bg-green-100 text-green-700";
    case "inactivo": return "bg-gray-200 text-gray-700";
    case "referido": return "bg-purple-100 text-purple-700";
    default: return "bg-blue-100 text-blue-700"; // Prospecto
  }
}

const ClientsRepo = repo<Client>(LS_KEYS.clients);

export function ClientsPage() {
  const me = getCurrentUser();
  const user = me ?? ({ id: "__anon__", role: "asesor", name: "Invitado" } as any);

  // 1) Cargar y hacer backfill de ownerId si falta
  const [rows, setRows] = useState<Client[]>(() => {
    const list = ClientsRepo.list();
    let changed = false;
    const fixed = list.map((c) => {
      const withOwner = ("ownerId" in c && c.ownerId) ? c : { ...c, ownerId: user.id };
      if (!("createdAt" in withOwner) || !withOwner.createdAt) {
        changed = true;
        return { ...withOwner, createdAt: new Date().toISOString() } as Client;
      }
      return withOwner as Client;
    });
    if (changed || fixed.some(cc => cc.ownerId !== (list.find(x=>x.id===cc.id)?.ownerId))) {
      ClientsRepo.saveAll(fixed);
    }
    return fixed;
  });

  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{open:boolean, client: Client | null}>({open:false, client:null});

  // Ordenamiento
  type SortKey = "new" | "old" | "name_az" | "name_za" | "status";
  const [sortBy, setSortBy] = useState<SortKey>("new");

  // prioridad de estatus
  const statusOrder: Record<string, number> = {
    prospecto: 1,
    cliente: 2,
    referido: 3,
    inactivo: 4,
  };

  const handleCreate = (c: Client) => {
    const withOwner: Client = { ...c, ownerId: user.id, createdAt: c.createdAt || new Date().toISOString(), ...("contactado" in (c as any) ? {} : { contactado: false } as any) } as any;
    // persist
    const list = ClientsRepo.list();
    ClientsRepo.saveAll([withOwner, ...list]);
    setRows(prev => [withOwner, ...prev]);
    setOpenNew(false);
  };
  const handleUpdate = (c: Client) => {
  // If contactado changed, use helper to preserve contactado_fecha
    const prev = ClientsRepo.list();
    const exists = prev.find(x => x.id === c.id);
    if (exists && Boolean(exists.contactado) !== Boolean(c.contactado)) {
      const updated = setContactado(c.id, Boolean(c.contactado));
      if (updated) {
        // merge other fields
        const merged = { ...updated, ...c } as Client;
        const rest = prev.map(x => x.id === c.id ? merged : x);
        ClientsRepo.saveAll(rest);
        setRows(rest);
      }
    } else {
      // simple replace
      const updated = prev.map(x => x.id === c.id ? c : x);
      ClientsRepo.saveAll(updated);
      setRows(updated);
    }
    setOpenEdit({open:false, client:null});
  };
  const handleDelete = (id: string) => {
    setRows(prev => prev.filter(x => x.id !== id));
    setOpenEdit({ open: false, client: null });
  };

  const toggleContactado = (id: string, val: boolean) => {
    const updated = setContactado(id, val);
    if (updated) {
      setRows(prev => prev.map(x => (x.id === id ? updated : x)));
    }
  };

  useEffect(() => { ClientsRepo.saveAll(rows); }, [rows]);

  // 2) Búsqueda simple
  const [q, setQ] = useState("");
  const visible = useMemo(
    () => filterByScope(rows, user, c => c.ownerId),
    [rows, user]
  );
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return visible;
    return visible.filter(c =>
      `${c.nombre || ""} ${(c.apellidoPaterno || "")} ${(c.apellidoMaterno || "")}`
        .toLowerCase()
        .includes(term)
    );
  }, [visible, q]);

  const sorted = useMemo(() => {
    const base = [...filtered];
    if (sortBy === "name_az" || sortBy === "name_za") {
      base.sort((a,b)=>{
        const an = `${a.nombre||""} ${a.apellidoPaterno||""} ${a.apellidoMaterno||""}`.trim().toLowerCase();
        const bn = `${b.nombre||""} ${b.apellidoPaterno||""} ${b.apellidoMaterno||""}`.trim().toLowerCase();
        return an.localeCompare(bn);
      });
      return sortBy === "name_za" ? base.reverse() : base;
    }
    if (sortBy === "status") {
      return base.sort((a,b)=> (statusOrder[(a.estatus||"Prospecto").toLowerCase()]||99) - (statusOrder[(b.estatus||"Prospecto").toLowerCase()]||99));
    }
    // default by createdAt (new/old)
    return base.sort((a,b)=>{
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortBy === "old" ? at - bt : bt - at;
    });
  }, [filtered, sortBy]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Clientes</h2>
        <div className="flex gap-2">
          <Input placeholder="Buscar…" className="w-56" value={q} onChange={e => setQ((e.target as HTMLInputElement).value)} />
          <Select value={sortBy} onValueChange={(v)=> setSortBy(v as any)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Ordenar por"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">Agregado: recientes</SelectItem>
              <SelectItem value="old">Agregado: antiguos</SelectItem>
              <SelectItem value="name_az">Nombre: A → Z</SelectItem>
              <SelectItem value="name_za">Nombre: Z → A</SelectItem>
              <SelectItem value="status">Estatus</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button>Nuevo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nuevo cliente</DialogTitle>
              </DialogHeader>
              <ClientForm allClients={rows} onSubmit={handleCreate} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-neutral-700">
              <tr>
                <th className="text-left p-3">Nombre ▾</th>
                <th className="text-left p-3">Teléfono</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Estatus ▾</th>
                <th className="text-left p-3">Contactado</th>
                <th className="text-left p-3">Fuente</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => (
                <tr key={c.id} className="border-t">
                  <td className="p-3">{c.nombre} {c.apellidoPaterno || ""} {c.apellidoMaterno || ""}</td>
                  <td className="p-3">{c.telefono || "-"}</td>
                  <td className="p-3">{c.email || "-"}</td>
                  <td className="p-3">
                    <Badge className={statusClasses(c.estatus)}>
                      {c.estatus || "Prospecto"}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={Boolean((c as any).contactado)}
                      onChange={(e) => toggleContactado(c.id, e.currentTarget.checked)}
                    />
                  </td>
                  <td className="p-3">{c.fuente || "-"}</td>
                  <td className="p-3">
                    <Button variant="secondary" size="sm" onClick={() => setOpenEdit({open:true, client:c})}>Editar</Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td className="p-4 text-sm text-muted-foreground" colSpan={7}>Sin clientes para tu usuario.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={openEdit.open} onOpenChange={(o)=> setOpenEdit({open:o, client: o ? openEdit.client : null})}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          {openEdit.client && (
            <ClientForm allClients={rows} initial={openEdit.client} onSubmit={handleUpdate} onDelete={handleDelete} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({label, children}:{label:string; children:React.ReactNode}){
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-neutral-600">{label}</Label>
      {children}
    </div>
  );
}

function ClientForm({ initial, onSubmit, allClients, onDelete }: { initial?: Client | null; onSubmit: (c: Client) => void; allClients: Client[]; onDelete?: (id: string) => void }) {
  const [form, setForm] = useState<Client>(initial || {
    id: uid(),
    nombre: "",
    estatus: "Prospecto",
    ownerId: initial?.ownerId,
    telefono: "",
    email: "",
    fechaNacimiento: "",
    sexo: undefined,
    estadoCivil: undefined,
    estadoResidencia: undefined,
    ocupacion: "",
    empresa: "",
    ingresoHogar: undefined,
    dependientes: undefined,
    fumador: false,
    necesidades: [],
    referidoPorId: undefined,
    asesor: "",
    ultimoContacto: "",
    anfRealizado: false,
    anfFecha: "",
    createdAt: initial?.createdAt ?? new Date().toISOString(),
  });
  useEffect(()=>{ if(initial) setForm(initial); },[initial]);
  const set = (k: keyof Client, v:any)=> setForm(prev=> ({...prev, [k]: v }));
  const isEdit = Boolean(initial);
  const [contactado, setContactado] = useState<boolean>(Boolean((initial as any)?.contactado));

  const commaJoin = (arr?: string[]) => (arr || []).join(", ");

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Nombre"><Input value={form.nombre} onChange={e=>set("nombre", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Apellido paterno"><Input value={form.apellidoPaterno||""} onChange={e=>set("apellidoPaterno", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Apellido materno"><Input value={form.apellidoMaterno||""} onChange={e=>set("apellidoMaterno", (e.target as HTMLInputElement).value)} /></Field>

      <Field label="Teléfono">
        <Input value={form.telefono||""} onChange={e=> set("telefono", formatMXPhone((e.target as HTMLInputElement).value))} />
      </Field>
      <Field label="Correo electrónico"><Input value={form.email||""} onChange={e=>set("email", (e.target as HTMLInputElement).value)} /></Field>

      <Field label="Fecha de nacimiento"><Input type="date" value={form.fechaNacimiento||""} onChange={e=>set("fechaNacimiento", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Sexo">
        <Select value={form.sexo as any} onValueChange={(v)=>set("sexo", v as any)}>
          <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="Masculino">Masculino</SelectItem>
            <SelectItem value="Femenino">Femenino</SelectItem>
            <SelectItem value="Otro">Otro</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Estado civil">
        <Select value={form.estadoCivil as any} onValueChange={(v)=>set("estadoCivil", v as any)}>
          <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="Soltero(a)">Soltero(a)</SelectItem>
            <SelectItem value="Casado(a)">Casado(a)</SelectItem>
            <SelectItem value="Unión libre">Unión libre</SelectItem>
            <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
            <SelectItem value="Viudo(a)">Viudo(a)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Estado de residencia">
        <Select value={form.estadoResidencia || ""} onValueChange={(v)=>set("estadoResidencia", v)}>
          <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
          <SelectContent>
            {MEX_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Ocupación"><Input value={form.ocupacion||""} onChange={e=>set("ocupacion", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Empresa"><Input value={form.empresa||""} onChange={e=>set("empresa", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Ingreso total del hogar (MXN)"><Input type="number" value={form.ingresoHogar ?? ""} onChange={e=>set("ingresoHogar", Number((e.target as HTMLInputElement).value)||undefined)} /></Field>
      <Field label="Dependientes"><Input type="number" value={form.dependientes ?? ""} onChange={e=>set("dependientes", Number((e.target as HTMLInputElement).value)||undefined)} /></Field>

      <Field label="Fumador">
        <Select value={form.fumador?"si":"no"} onValueChange={(v)=>set("fumador", v==="si") }>
          <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="si">Sí</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Fuente">
        <Select value={form.fuente as any} onValueChange={(v)=>set("fuente", v as any)}>
          <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="Mercado natural">Mercado natural</SelectItem>
            <SelectItem value="Referido">Referido</SelectItem>
            <SelectItem value="Redes">Redes</SelectItem>
            <SelectItem value="Frío">Frío</SelectItem>
            <SelectItem value="Evento">Evento</SelectItem>
            <SelectItem value="COI">COI</SelectItem>
            <SelectItem value="Otros">Otros</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Estatus">
        <Select value={form.estatus as any} onValueChange={(v)=>set("estatus", v as any)}>
          <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Referido por">
        <Select
          value={form.referidoPorId ?? "__none__"}
          onValueChange={(v)=> set("referidoPorId", v === "__none__" ? undefined : v)}
        >
          <SelectTrigger><SelectValue placeholder="Nadie"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Nadie</SelectItem>
            {allClients.filter(c=>c.id!==form.id).map(c=> (
              <SelectItem key={c.id} value={c.id}>{`${c.nombre||""} ${c.apellidoPaterno||""}`.trim()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Necesidades (separadas por coma)">
        <Input value={commaJoin(form.necesidades)} onChange={e=> set("necesidades", ((e.target as HTMLInputElement).value || "").split(/,\s*/).filter(Boolean))} />
      </Field>
      <Field label="Asesor / ejecutivo"><Input value={form.asesor||""} onChange={e=>set("asesor", (e.target as HTMLInputElement).value)} /></Field>

      <Field label="Último contacto"><Input type="date" value={form.ultimoContacto||""} onChange={e=>set("ultimoContacto", (e.target as HTMLInputElement).value)} /></Field>

      <Field label="¿Ya fue contactado?">
        <input
          type="checkbox"
          checked={contactado}
          onChange={(e)=> setContactado(e.currentTarget.checked)}
        />
      </Field>

      <Field label="ANF realizado">
        <Select value={form.anfRealizado?"si":"no"} onValueChange={(v)=>set("anfRealizado", v==="si")}>
          <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="si">Sí</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Fecha ANF"><Input type="date" value={form.anfFecha||""} onChange={e=>set("anfFecha", (e.target as HTMLInputElement).value)} /></Field>

      <Field label="Fecha de creación">
        <Input
          type="date"
          value={form.createdAt ? form.createdAt.slice(0,10) : ""}
          onChange={(e)=> {
            const v = (e.target as HTMLInputElement).value;
            // Guard: if empty, keep previous value; otherwise set ISO at 00:00Z
            if (v) set("createdAt", new Date(v).toISOString());
          }}
        />
      </Field>

      <div className="col-span-2 mt-2">
        <DialogFooter className="w-full flex gap-2">
          {isEdit && onDelete && (
            <Button
              type="button"
              variant="destructive"
              className="w-1/3"
              onClick={() => {
                if (window.confirm("¿Eliminar este cliente? Esta acción no se puede deshacer.")) {
                  onDelete(form.id);
                }
              }}
            >
              Eliminar
            </Button>
          )}
          <Button className="flex-1" onClick={() => onSubmit({ ...(form as any), contactado } as Client)}>
            {isEdit ? 'Actualizar cliente' : 'Guardar cliente'}
          </Button>
        </DialogFooter>
      </div>
    </div>
  );
}

export default ClientsPage;