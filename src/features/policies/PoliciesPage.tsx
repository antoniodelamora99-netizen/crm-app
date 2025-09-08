"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel } from "@/components/ui/select"; // keep other selects
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

import { Client, Policy, uid } from "@/lib/types";
import { repo, LS_KEYS } from "@/lib/storage";
import { getCurrentUser, filterByScope } from "@/lib/users";

/* ===== Repos (localStorage) ===== */
const ClientsRepo = repo<Client>(LS_KEYS.clients);
const PoliciesRepo = repo<Policy>(LS_KEYS.policies);

/* ===== Helpers ===== */
function Field({label, children}:{label:string; children:React.ReactNode}){
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-neutral-600">{label}</Label>
      {children}
    </div>
  );
}

const policyStatusClass: Record<Policy["estado"], string> = {
  Vigente: "bg-emerald-100 text-emerald-800",
  Propuesta: "bg-amber-100 text-amber-800",
  Rechazada: "bg-red-100 text-red-800",
  "En proceso": "bg-blue-100 text-blue-800",
};

// === Opciones de planes (con subgrupos) ===
const PLAN_GROUPS: { label?: string; items: string[] }[] = [
  { label: "Gastos médicos", items: ["Gastos médicos flex", "Gastos médicos tradicional"] },
  {
    label: "Imagina Ser",
    items: [
      "Imagina ser pago único",
      "Imagina ser 65",
      "Imagina ser 15 pagos",
      "Imagina ser 10 pagos",
    ],
  },
  { items: ["Nuevo plenitud", "Realiza", "Orbi 99", "Star Dotal", "Star Temporal"] },
];
const KNOWN_PLANS = new Set(PLAN_GROUPS.flatMap((g) => g.items));


type SortKey = "new" | "old" | "planAZ" | "planZA" | "clientAZ" | "clientZA";

// Formatea montos considerando UDIS (no es un código ISO y revienta Intl.NumberFormat)
const fmtMoney = (value?: number, currency?: Policy["moneda"]) => {
  if (value == null) return "-";
  const c = currency || "MXN";
  if (c === "UDIS") {
    return `${value.toLocaleString("es-MX", { maximumFractionDigits: 2 })} UDIS`;
  }
  try {
    return value.toLocaleString("es-MX", { style: "currency", currency: c });
  } catch {
    // fallback por si llega un código inválido
    return value.toLocaleString("es-MX", { maximumFractionDigits: 2 }) + ` ${c}`;
  }
};

export default function PoliciesPage(){
  const currentUser = getCurrentUser();
  const user = currentUser ?? { id: "__anon__", role: "asesor", name: "Invitado", username: "", password: "" };

  const [rows, setRows] = useState<Policy[]>(PoliciesRepo.list());
  const [clients] = useState<Client[]>(ClientsRepo.list());
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{open:boolean, policy: Policy|null}>({open:false, policy:null});

  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("new");

  useEffect(()=>{ PoliciesRepo.saveAll(rows); },[rows]);

  // Alcance por usuario (promotor/gerente/asesor)
  const visibleClients = useMemo(()=> filterByScope<Client>(clients, user, c => c.ownerId), [clients, user]);
  const visibleRows = useMemo(()=> filterByScope<Policy>(rows, user, r => r.ownerId), [rows, user]);

  // Búsqueda
  const filtered = useMemo(()=>{
    const term = q.trim().toLowerCase();
    const list = visibleRows.filter(p=>{
      if (!term) return true;
      const cliente = visibleClients.find(c=>c.id===p.clienteId);
      const clienteNombre = cliente ? `${cliente.nombre} ${cliente.apellidoPaterno||""} ${cliente.apellidoMaterno||""}`.toLowerCase() : "";
      return (
        (p.plan||"").toLowerCase().includes(term) ||
        (p.numeroPoliza||"").toLowerCase().includes(term) ||
        clienteNombre.includes(term)
      );
    });

    const byCreatedAt = (a: Policy, b: Policy) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    };
    const byName = (s: string) => (s || "").toLowerCase();
    const clientName = (p: Policy) => {
      const c = visibleClients.find(x=>x.id===p.clienteId);
      return c ? `${c.nombre} ${c.apellidoPaterno||""} ${c.apellidoMaterno||""}` : "";
    };

    return list.sort((a,b)=>{
      if (sortBy==="new") return byCreatedAt(a,b);
      if (sortBy==="old") return byCreatedAt(b,a);
      if (sortBy==="planAZ") return byName(a.plan).localeCompare(byName(b.plan), "es");
      if (sortBy==="planZA") return byName(b.plan).localeCompare(byName(a.plan), "es");
      if (sortBy==="clientAZ") return byName(clientName(a)).localeCompare(byName(clientName(b)), "es");
      if (sortBy==="clientZA") return byName(clientName(b)).localeCompare(byName(clientName(a)), "es");
      return 0;
    });
  },[visibleRows, q, sortBy, visibleClients]);

  const handleCreate = (p: Policy) => { setRows([p, ...rows]); setOpenNew(false); };
  const handleUpdate = (p: Policy) => {
    setRows((prev) => prev.map((x) => (x.id === p.id ? p : x)));
    setOpenEdit({ open: false, policy: null });
  };

  const handleDelete = (id: string) => {
    setRows((prev) => prev.filter((x) => x.id !== id));
  };

  if (!currentUser) {
    return (
      <Card className="shadow">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-2">Pólizas</h2>
          <p className="text-sm text-muted-foreground">Inicia sesión para ver tus pólizas.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Pólizas</h2>
        <div className="flex gap-2">
          <Input placeholder="Buscar por plan, cliente o # de póliza…" value={q} onChange={e=>setQ((e.target as HTMLInputElement).value)} className="w-64" />
          <Select value={sortBy} onValueChange={(v)=>setSortBy(v as SortKey)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">Agregadas (recientes primero)</SelectItem>
              <SelectItem value="old">Agregadas (antiguas primero)</SelectItem>
              <SelectItem value="planAZ">Plan (A→Z)</SelectItem>
              <SelectItem value="planZA">Plan (Z→A)</SelectItem>
              <SelectItem value="clientAZ">Cliente (A→Z)</SelectItem>
              <SelectItem value="clientZA">Cliente (Z→A)</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button><Plus className="mr-2" size={16}/>Nueva</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Nueva póliza</DialogTitle></DialogHeader>
              <PolicyForm
                clients={visibleClients.length ? visibleClients : clients}
                onSubmit={(p)=> {
                  const created = { ...p, ownerId: user.id, createdAt: new Date().toISOString() };
                  handleCreate(created);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="shadow">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-neutral-700">
              <tr>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Plan</th>
                <th className="text-left p-3">Estado</th>
                <th className="text-left p-3">Prima mensual</th>
                <th className="text-left p-3">Suma asegurada</th>
                <th className="text-left p-3"># Póliza</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r=>{
                const c = visibleClients.find(x=>x.id===r.clienteId) || clients.find(x=>x.id===r.clienteId);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{c? `${c.nombre} ${c.apellidoPaterno||""}`: "-"}</td>
                    <td className="p-3">{r.plan}</td>
                    <td className="p-3"><Badge className={policyStatusClass[r.estado]}>{r.estado}</Badge></td>
                    <td className="p-3">{fmtMoney(r.primaMensual, r.moneda)}</td>
                    <td className="p-3">{fmtMoney(r.sumaAsegurada, r.moneda)}</td>
                    <td className="p-3">{r.numeroPoliza || "-"}</td>
                    <td className="p-3 space-x-2">
                      <Button variant="secondary" size="sm" onClick={()=> setOpenEdit({open:true, policy:r})}>Editar</Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0 && (<tr><td className="p-4 text-sm text-muted-foreground" colSpan={7}>Sin pólizas</td></tr>)}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Editar / Eliminar dentro del diálogo */}
      <Dialog open={openEdit.open} onOpenChange={(o)=> setOpenEdit({open:o, policy: o? openEdit.policy : null})}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Editar póliza</DialogTitle></DialogHeader>
          {openEdit.policy && (
            <PolicyForm
              initial={openEdit.policy}
              clients={visibleClients.length ? visibleClients : clients}
              onSubmit={(p)=> handleUpdate(p)}
            />
          )}
          <DialogFooter className="justify-between mt-2">
            <Button
              variant="destructive"
              onClick={() => {
                if (openEdit.policy && window.confirm("¿Eliminar esta póliza?")) {
                  handleDelete(openEdit.policy.id);
                  setOpenEdit({ open: false, policy: null });
                }
              }}
            >
              Borrar póliza
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ===== Formulario ===== */
function PolicyForm({
  clients, onSubmit, initial
}:{ clients: Client[]; onSubmit: (p: Policy) => void; initial?: Policy }){

  const [form, setForm] = useState<Policy>(initial || {
    id: uid(),
    clienteId: clients[0]?.id || "",
    plan: "",
    estado: "Propuesta",
    createdAt: new Date().toISOString(),
    moneda: "MXN",
    msi: false,
  });

  useEffect(()=>{ if(initial) setForm(initial); },[initial]);
  const set = <K extends keyof Policy>(k: K, v: Policy[K])=> setForm(prev=> ({...prev, [k]: v }));

  const isEdit = Boolean(initial);

  const [useCustomPlan, setUseCustomPlan] = useState(false);

  useEffect(() => {
    setUseCustomPlan(!!form.plan && !KNOWN_PLANS.has(form.plan));
  }, [form.plan]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Cliente (escribe para buscar)">
        <ClientQuickSelect
          clients={clients}
          value={form.clienteId}
          onChange={(v)=> set("clienteId", v)}
        />
      </Field>

      <Field label="Plan">
        <div className="grid gap-2">
          <Select
            value={useCustomPlan ? "__other__" : (form.plan || "")}
            onValueChange={(v) => {
              if (v === "__other__") {
                setUseCustomPlan(true);
                set("plan", "");
              } else {
                setUseCustomPlan(false);
                set("plan", v);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un plan" />
            </SelectTrigger>
            <SelectContent>
              {PLAN_GROUPS.map((g, i) =>
                g.label ? (
                  <SelectGroup key={g.label + i}>
                    <SelectLabel className="text-xs text-neutral-500">{g.label}</SelectLabel>
                    {g.items.map((it) => (
                      <SelectItem key={it} value={it}>
                        {it}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : (
                  g.items.map((it) => (
                    <SelectItem key={it} value={it}>
                      {it}
                    </SelectItem>
                  ))
                )
              )}
              <SelectItem value="__other__">Otro…</SelectItem>
            </SelectContent>
          </Select>

          {useCustomPlan && (
            <Input
              placeholder="Escribe el nombre del plan"
              value={form.plan || ""}
              onChange={(e) => set("plan", (e.target as HTMLInputElement).value)}
            />
          )}
        </div>
      </Field>
      <Field label="Número de póliza"><Input value={form.numeroPoliza||""} onChange={e=>set("numeroPoliza", (e.target as HTMLInputElement).value)} /></Field>

      <Field label="Estado">
  <Select value={form.estado} onValueChange={(v)=>set("estado", v as Policy["estado"])}>
          <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
          <SelectContent>
            {(["Vigente","Propuesta","Rechazada","En proceso"] as const).map(s=> <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Suma asegurada (MXN)">
        <Input type="number" value={form.sumaAsegurada||""} onChange={e=>set("sumaAsegurada", Number((e.target as HTMLInputElement).value))} />
      </Field>

      <Field label="Prima mensual">
        <Input type="number" value={form.primaMensual||""} onChange={e=>set("primaMensual", Number((e.target as HTMLInputElement).value))} />
      </Field>

      <Field label="Moneda">
  <Select value={form.moneda || "MXN"} onValueChange={(v)=>set("moneda", v as Policy["moneda"])}>
          <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="MXN">MXN</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="UDIS">UDIS</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="MSI (meses sin intereses)">
  <Select value={form.msi ? "si" : "no"} onValueChange={(v)=>set("msi", v==="si")}>
          <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="no">No</SelectItem>
            <SelectItem value="si">Sí</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Fecha de ingreso">
        <Input type="date" value={form.fechaIngreso||""} onChange={e=>set("fechaIngreso", (e.target as HTMLInputElement).value)} />
      </Field>

      <Field label="Fecha examen médico">
        <Input type="date" value={form.fechaExamenMedico||""} onChange={e=>set("fechaExamenMedico", (e.target as HTMLInputElement).value)} />
      </Field>

      <Field label="Forma de pago">
  <Select value={form.formaPago || "Mensual"} onValueChange={(v)=>set("formaPago", v as Policy["formaPago"])}>
          <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="Mensual">Mensual</SelectItem>
            <SelectItem value="Trimestral">Trimestral</SelectItem>
            <SelectItem value="Semestral">Semestral</SelectItem>
            <SelectItem value="Anual">Anual</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Fecha de pago (día base)">
        <Input type="date" value={form.fechaPago||""} onChange={e=>set("fechaPago", (e.target as HTMLInputElement).value)} />
      </Field>

      <Field label="Fecha de entrega">
        <Input type="date" value={form.fechaEntrega||""} onChange={e=>set("fechaEntrega", (e.target as HTMLInputElement).value)} />
      </Field>

      <Field label="Comisión estimada">
        <Input type="number" value={form.comisionEstimada||""} onChange={e=>set("comisionEstimada", Number((e.target as HTMLInputElement).value))} />
      </Field>

      <Field label="Necesidades futuras">
        <Textarea value={form.necesidadesFuturas||""} onChange={e=>set("necesidadesFuturas", (e.target as HTMLTextAreaElement).value)} />
      </Field>

      <Field label="Próximo seguimiento">
        <Input type="date" value={form.proximoSeguimiento||""} onChange={e=>set("proximoSeguimiento", (e.target as HTMLInputElement).value)} />
      </Field>

      <div className="col-span-2 mt-2">
        <Button className="w-full" onClick={()=> onSubmit(form)}>{isEdit? 'Actualizar póliza' : 'Guardar póliza'}</Button>
      </div>
    </div>
  );
}

// --- ClientQuickSelect: buscador rápido de clientes ----------------------
function ClientQuickSelect({ clients, value, onChange }: { clients: Client[]; value?: string; onChange: (id: string) => void; }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = React.useRef<HTMLDivElement|null>(null);

  const selected = clients.find(c => c.id === value);
  const display = selected ? `${selected.nombre} ${selected.apellidoPaterno||""}`.trim() : "";

  const filtered = useMemo(()=>{
    const q = query.trim().toLowerCase();
    if(!q) return clients.slice(0,30);
    return clients.filter(c => `${c.nombre} ${c.apellidoPaterno||""} ${c.apellidoMaterno||""}`.toLowerCase().includes(q)).slice(0,30);
  },[clients, query]);

  useEffect(()=>{
    const onDoc = (e: MouseEvent) => {
      if(!containerRef.current) return;
      if(!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return ()=> document.removeEventListener("mousedown", onDoc);
  },[]);

  return (
    <div ref={containerRef} className="relative">
      <Input
        placeholder="Nombre del cliente"
        value={open ? query : (display || query)}
        onFocus={()=> { setOpen(true); setQuery(display); }}
        onChange={e=> { setQuery((e.target as HTMLInputElement).value); setOpen(true); }}
        className="pr-8"
      />
      {selected && !open && (
        <button
          type="button"
            onClick={()=> { onChange(""); setQuery(""); setOpen(true); }}
          className="absolute right-1 top-1 text-neutral-400 hover:text-neutral-600 text-xs px-1"
          aria-label="Limpiar selección"
        >×</button>
      )}
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border rounded-md shadow-lg max-h-64 overflow-auto text-sm">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-neutral-500 text-xs">Sin coincidencias</div>
          )}
          {filtered.map(c => {
            const full = `${c.nombre} ${c.apellidoPaterno||""} ${c.apellidoMaterno||""}`.trim();
            return (
              <button
                type="button"
                key={c.id}
                onClick={()=> { onChange(c.id); setOpen(false); setQuery(full); }}
                className={`block w-full text-left px-3 py-2 hover:bg-neutral-100 ${c.id===value? 'bg-neutral-50 font-medium':''}`}
              >{full}</button>
            );
          })}
          {clients.length > 30 && !query && (
            <div className="px-3 py-1 text-[10px] text-neutral-400">Mostrando primeros 30. Escribe para filtrar.</div>
          )}
        </div>
      )}
    </div>
  );
}