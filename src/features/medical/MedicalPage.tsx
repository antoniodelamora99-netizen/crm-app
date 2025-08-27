

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

import type { Client, MedicalForm } from "@/lib/types";
import { uid } from "@/lib/types";
import { repo, LS_KEYS } from "@/lib/storage";
import { getCurrentUser, filterByScope } from "@/lib/users";

/* ============================================================
   Repos
============================================================ */
const ClientsRepo = repo<Client>(LS_KEYS.clients);
const MedicalRepo = repo<MedicalForm>(LS_KEYS.medical);

/* ============================================================
   Helpers
============================================================ */
function Field({label, children}:{label:string; children:React.ReactNode}){
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-neutral-600">{label}</Label>
      {children}
    </div>
  );
}

/* ============================================================
   Medical Page (CRUD con alcance por usuario)
============================================================ */
export default function MedicalPage(){
  const user = getCurrentUser();

  const [clients] = useState<Client[]>(ClientsRepo.list());
  const [rows, setRows] = useState<MedicalForm[]>(MedicalRepo.list());
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{open:boolean, item: MedicalForm|null}>({open:false, item:null});

  useEffect(()=> { MedicalRepo.saveAll(rows); }, [rows]);

  // Alcance por usuario
  const visibleClients = useMemo(
    ()=> user ? filterByScope(clients, user, c => (c as Client).ownerId) : [],
    [clients, user]
  );
  const visibleForms = useMemo(
    ()=> user ? filterByScope(rows, user, r => (r as MedicalForm).ownerId) : [],
    [rows, user]
  );

  // Búsqueda por cliente y campos
  const filtered = useMemo(()=>{
    const t = q.trim().toLowerCase();
    const list = visibleForms.filter(m=>{
      if (!t) return true;
      const c = visibleClients.find(x=>x.id===m.clienteId);
      const nombre = c ? `${c.nombre} ${c.apellidoPaterno||""} ${c.apellidoMaterno||""}`.toLowerCase() : "";
      return (
        nombre.includes(t) ||
        (m.enfermedades||"").toLowerCase().includes(t) ||
        (m.medicamentos||"").toLowerCase().includes(t) ||
        (m.cirugias||"").toLowerCase().includes(t)
      );
    });
    // más reciente primero
    return list.sort((a,b)=> (b.fecha || "").localeCompare(a.fecha || ""));
  },[visibleForms, q, visibleClients]);

  const handleCreate = (m: MedicalForm) => { setRows(prev => [m, ...prev]); setOpenNew(false); };
  const handleUpdate = (m: MedicalForm) => { setRows(prev => prev.map(x => x.id === m.id ? m : x)); setOpenEdit({open:false, item:null}); };
  const handleDelete = (id: string) => { setRows(prev => prev.filter(x => x.id !== id)); };

  if (!user) {
    return (
      <Card className="shadow">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-2">Cuestionario Médico</h2>
          <p className="text-sm text-muted-foreground">Inicia sesión para ver tus cuestionarios.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Cuestionario Médico</h2>
        <div className="flex gap-2">
          <Input placeholder="Buscar por cliente o padecimientos…" value={q} onChange={e=>setQ((e.target as HTMLInputElement).value)} className="w-64" />
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button><Plus className="mr-2" size={16}/>Nuevo</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Nuevo cuestionario</DialogTitle></DialogHeader>
              <MedicalFormEditor
                clients={visibleClients}
                onSubmit={(m)=> handleCreate({ ...m, ownerId: user.id })}
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
                <th className="text-left p-3">Fecha</th>
                <th className="text-left p-3">Resumen</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r=>{
                const c = visibleClients.find(x=>x.id===r.clienteId);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{c? `${c.nombre} ${c.apellidoPaterno||""}`: "—"}</td>
                    <td className="p-3">{r.fecha}</td>
                    <td className="p-3">{[r.enfermedades, r.medicamentos, r.cirugias].filter(Boolean).join(" | ") || "—"}</td>
                    <td className="p-3 space-x-2">
                      <Dialog open={openEdit.open && openEdit.item?.id === r.id} onOpenChange={(o)=> setOpenEdit({open:o, item: o? r : null})}>
                        <DialogTrigger asChild><Button variant="secondary" size="sm">Editar</Button></DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader><DialogTitle>Editar cuestionario</DialogTitle></DialogHeader>
                          {openEdit.item && (
                            <MedicalFormEditor
                              initial={openEdit.item}
                              clients={visibleClients}
                              onSubmit={handleUpdate}
                            />
                          )}
                          <DialogFooter className="justify-between mt-2">
                            <Button
                              variant="destructive"
                              onClick={()=>{
                                if (openEdit.item && window.confirm("¿Eliminar este cuestionario médico?")) {
                                  handleDelete(openEdit.item.id);
                                  setOpenEdit({open:false, item:null});
                                }
                              }}
                            >
                              Eliminar
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0 && (
                <tr><td className="p-4 text-sm text-muted-foreground" colSpan={4}>Sin cuestionarios.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================================================
   Formulario
============================================================ */
function MedicalFormEditor({
  clients,
  onSubmit,
  initial
}:{ clients: Client[]; onSubmit: (m: MedicalForm) => void; initial?: MedicalForm }){

  const [form, setForm] = useState<MedicalForm>(initial || {
    id: uid(),
    clienteId: clients[0]?.id || "",
    fecha: new Date().toISOString().slice(0,10),
    enfermedades: "",
    hospitalizacion: "",
    medicamentos: "",
    cirugias: "",
    antecedentes: "",
    otros: "",
    pdfUrl: "",
  });

  useEffect(()=>{ if(initial) setForm(initial); },[initial]);
  const set = (k: keyof MedicalForm, v:any)=> setForm(prev => ({...prev, [k]: v}));

  const isEdit = Boolean(initial);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Cliente">
        <Select value={form.clienteId} onValueChange={(v)=>set("clienteId", v)}>
          <SelectTrigger><SelectValue placeholder="Selecciona"/></SelectTrigger>
          <SelectContent>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre} {c.apellidoPaterno||""}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Fecha">
        <Input type="date" value={form.fecha || ""} onChange={e=>set("fecha", (e.target as HTMLInputElement).value)} />
      </Field>

      <Field label="Enfermedades"><Textarea value={form.enfermedades || ""} onChange={e=>set("enfermedades", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Hospitalización"><Textarea value={form.hospitalizacion || ""} onChange={e=>set("hospitalizacion", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Medicamentos"><Textarea value={form.medicamentos || ""} onChange={e=>set("medicamentos", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Cirugías"><Textarea value={form.cirugias || ""} onChange={e=>set("cirugias", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Antecedentes"><Textarea value={form.antecedentes || ""} onChange={e=>set("antecedentes", (e.target as HTMLInputElement).value)} /></Field>
      <Field label="Otros"><Textarea value={form.otros || ""} onChange={e=>set("otros", (e.target as HTMLInputElement).value)} /></Field>

      <Field label="URL del PDF (opcional)">
        <Input placeholder="https://..." value={form.pdfUrl || ""} onChange={e=>set("pdfUrl", (e.target as HTMLInputElement).value)} />
      </Field>

      <div className="col-span-2 mt-2">
        <Button className="w-full" onClick={()=> onSubmit(form)}>{isEdit ? "Actualizar" : "Guardar"}</Button>
      </div>
    </div>
  );
}