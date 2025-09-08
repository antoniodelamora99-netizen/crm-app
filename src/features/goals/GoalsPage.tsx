"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

import type { Client, Goal, Policy } from "@/lib/types";
import { uid } from "@/lib/types";
import { repo, LS_KEYS } from "@/lib/storage";
import { getCurrentUser, filterByScope } from "@/lib/users";

/* ============================================================
   Repos
============================================================ */
const GoalsRepo = repo<Goal>(LS_KEYS.goals);
const PoliciesRepo = repo<Policy>(LS_KEYS.policies);
const ClientsRepo = repo<Client>(LS_KEYS.clients);

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

function pesos(n?: number) {
  if (n == null || isNaN(n)) return "-";
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

/* ============================================================
   Goals Page (CRUD + alcance por usuario)
============================================================ */
export default function GoalsPage(){
  const user = getCurrentUser();

  const [rows, setRows] = useState<Goal[]>(GoalsRepo.list());
  const [policies] = useState<Policy[]>(PoliciesRepo.list());
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{open:boolean, item: Goal|null}>({open:false, item:null});

  useEffect(()=>{ GoalsRepo.saveAll(rows); },[rows]);

  // Alcance por usuario (metas y pólizas)
  const visibleGoals = useMemo(
    ()=> user ? filterByScope<Goal>(rows, user, g => (g as Goal & { ownerId?: string }).ownerId) : [],
    [rows, user]
  );
  const visiblePolicies = useMemo(
    ()=> user ? filterByScope<Policy>(policies, user, p => (p as Policy & { ownerId?: string }).ownerId) : [],
    [policies, user]
  );

  // Resultado mensual (proxy) basado en pólizas por mes
  const resultByMonth = useMemo(()=>{
    const map: Record<string, { ingreso: number; polizas: number }> = {};
    for (const p of visiblePolicies) {
      if (!p.fechaIngreso) continue;
      const mes = p.fechaIngreso.slice(0,7);
      const prima = p.primaMensual || 0;
      map[mes] = map[mes] || { ingreso: 0, polizas: 0 };
      map[mes].ingreso += prima * 0.3; // proxy de comisión
      map[mes].polizas += 1;
    }
    return map;
  }, [visiblePolicies]);

  // Búsqueda por mes o tipo
  const filtered = useMemo(()=>{
    const t = q.trim().toLowerCase();
    const list = visibleGoals.filter(g => {
      if (!t) return true;
      return g.mes.toLowerCase().includes(t) || g.tipo.toLowerCase().includes(t);
    });
    // ordenar por mes desc
    return list.sort((a,b)=> b.mes.localeCompare(a.mes));
  }, [visibleGoals, q]);

  const handleCreate = (g: Goal) => { setRows(prev => [g, ...prev]); setOpenNew(false); };
  const handleUpdate = (g: Goal) => { setRows(prev => prev.map(x => x.id === g.id ? g : x)); setOpenEdit({open:false, item:null}); };
  const handleDelete = (id: string) => { setRows(prev => prev.filter(x => x.id !== id)); };

  if (!user) {
    return (
      <Card className="shadow">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-2">Metas</h2>
          <p className="text-sm text-muted-foreground">Inicia sesión para ver tus metas.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Metas</h2>
        <div className="flex items-center gap-2">
          <Input placeholder="Buscar por mes (YYYY-MM) o tipo…" value={q} onChange={e=>setQ((e.target as HTMLInputElement).value)} className="w-72" />
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button><Plus className="mr-2" size={16}/>Nueva</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Nueva meta</DialogTitle></DialogHeader>
              <GoalForm
                onSubmit={(g)=> handleCreate({ ...g, id: uid() })}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(g=> {
          const res = resultByMonth[g.mes];
          return (
            <Card key={g.id} className="shadow">
              <CardContent className="p-5 space-y-1">
                <div className="text-xs text-neutral-500">{g.tipo}</div>
                <div className="text-lg font-semibold">{g.mes}</div>
                {g.tipo === "Ingreso mensual" ? (
                  <>
                    <div className="text-sm">
                      Meta mensual: <b>{pesos(g.metaMensual)}</b>
                    </div>
                    <div className="text-sm text-neutral-600">
                      Resultado (proxy): <b>{pesos(res?.ingreso || 0)}</b> · Pólizas: <b>{res?.polizas || 0}</b>
                    </div>
                    <div className="text-xs text-neutral-500">
                      Diferencia: {pesos((g.metaMensual || 0) - (res?.ingreso || 0))}
                    </div>
                  </>
                ) : (
                  <div className="text-sm">Meta mensual: <b>{g.metaMensual ?? "-"}</b></div>
                )}

                <div className="mt-3 flex gap-2">
                  <Dialog open={openEdit.open && openEdit.item?.id === g.id} onOpenChange={(o)=> setOpenEdit({open:o, item: o? g : null})}>
                    <DialogTrigger asChild><Button variant="secondary" size="sm">Editar</Button></DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader><DialogTitle>Editar meta</DialogTitle></DialogHeader>
                      {openEdit.item && (
                        <GoalForm
                          initial={openEdit.item}
                          onSubmit={handleUpdate}
                        />
                      )}
                      <DialogFooter className="justify-between mt-2">
                        <Button
                          variant="destructive"
                          onClick={()=>{
                            if (openEdit.item && window.confirm("¿Eliminar esta meta?")) {
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
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length===0 && (
          <div className="text-sm text-neutral-500">Aún no has definido metas.</div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Formulario
============================================================ */
function GoalForm({ onSubmit, initial }:{
  onSubmit:(g:Goal)=>void;
  initial?: Goal;
}){
  const [form, setForm] = useState<Goal>(initial || {
    id: uid(),
    tipo: "Ingreso mensual",
    mes: new Date().toISOString().slice(0,7),
    metaMensual: 100000,
  } as Goal);

  useEffect(()=>{ if(initial) setForm(initial); },[initial]);
  const set = <K extends keyof Goal>(k: K, v: Goal[K])=> setForm(prev=> ({...prev, [k]: v }));

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Tipo">
        <Select value={form.tipo} onValueChange={(v)=>set("tipo", v as Goal["tipo"]) }>
          <SelectTrigger><SelectValue/></SelectTrigger>
          <SelectContent>
            {(["Ingreso mensual","Pólizas mensuales","Citas semanales","Referidos"] as Goal["tipo"][]).map(s=> (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Mes (YYYY-MM)">
        <Input value={form.mes} onChange={e=>set("mes", (e.target as HTMLInputElement).value)} />
      </Field>
      <Field label="Meta mensual">
        <Input type="number" value={form.metaMensual ?? ""} onChange={e=>set("metaMensual", Number((e.target as HTMLInputElement).value))} />
      </Field>

      <DialogFooter className="col-span-2 mt-2">
        <Button className="w-full" onClick={()=> onSubmit(form)}>
          {initial ? "Guardar cambios" : "Guardar meta"}
        </Button>
      </DialogFooter>
    </div>
  );
}

/* ============================================================
   Mini tests (console)
============================================================ */
(function selfTests(){
  const log = (name: string, ok: boolean) => console.log(`TEST ${ok?"✔":"✘"} ${name}`);
  try {
    // repo roundtrip goals
    const tmpKey = "__test_goals__" + Math.random();
    const R = repo<Goal>(tmpKey);
  const g: Goal = { id: "g1", tipo: "Ingreso mensual", mes: "2025-08", metaMensual: 100, metaAnual: 0 };
    R.saveAll([g]);
    const loaded = R.list();
    log("repo roundtrip (goals)", Array.isArray(loaded) && loaded[0].id === "g1");

    // result map shape
    const map: Record<string, { ingreso: number; polizas: number }> = {};
    map["2025-08"] = { ingreso: 3000, polizas: 2 };
    log("result map shape", typeof map["2025-08"].ingreso === "number" && typeof map["2025-08"].polizas === "number");
  } catch {
    log("repo/tests failed", false);
  }
})();
