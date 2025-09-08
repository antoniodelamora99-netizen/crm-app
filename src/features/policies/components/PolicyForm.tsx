"use client";
import React, { useEffect, useState } from "react";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Client, Policy } from "@/lib/types";
import { uid } from "@/lib/types";
import { ClientQuickSelect } from "@/features/clients/components/ClientQuickSelect";

// Schema de validación (reglas simples y rápidas)
const policySchema = z.object({
  id: z.string(),
  clienteId: z.string().min(1, "Selecciona un cliente"),
  plan: z.string().trim().min(3, "Plan muy corto"),
  numeroPoliza: z.string().optional(),
  estado: z.enum(["Vigente", "Propuesta", "Rechazada", "En proceso"]),
  primaMensual: z.number().nonnegative("Prima inválida").optional(),
  moneda: z.enum(["MXN", "USD", "UDIS"]).optional(),
  formaPago: z.enum(["Mensual", "Trimestral", "Semestral", "Anual"]).optional(),
  fechaIngreso: z.string().optional(),
  fechaPago: z.string().optional(),
  fechaEntrega: z.string().optional(),
  msi: z.boolean().optional(),
  createdAt: z.string().optional(),
});

export function PolicyForm({ clients, initial, onSubmit }: { clients: Client[]; initial?: Policy; onSubmit: (p: Policy) => void; }) {
  const [form, setForm] = useState<Policy>(initial || {
    id: uid(),
    clienteId: clients[0]?.id || "",
    plan: "",
    estado: "Propuesta",
    moneda: "MXN",
    createdAt: new Date().toISOString(),
  });
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  useEffect(()=> { if(initial) setForm(initial); }, [initial]);
  const set = <K extends keyof Policy>(k: K, v: Policy[K]) => setForm(prev => ({ ...prev, [k]: v }));
  const isEdit = Boolean(initial);

  const validate = (draft: Policy) => {
    const parse = policySchema.safeParse(draft);
    if (parse.success) { setErrors({}); return true; }
    const fieldErrors: Record<string,string> = {};
    for (const issue of parse.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    setErrors(fieldErrors);
    return false;
  };

  const handleSubmit = () => {
    setTouched({ clienteId: true, plan: true, estado: true, primaMensual: true });
    const ok = validate(form);
    if (!ok) return;
    setSubmitting(true);
    try { onSubmit(form); } finally { setSubmitting(false); }
  };

  const showError = (field: string) => (touched[field] && errors[field]) ? (
    <p className="text-xs text-red-600 mt-0.5">{errors[field]}</p>
  ) : null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Cliente (escribe para buscar)">
        <ClientQuickSelect clients={clients} value={form.clienteId} onChange={(id)=> { set("clienteId", id); setTouched(t=>({...t, clienteId:true})); validate({ ...form, clienteId: id }); }} />
        {showError("clienteId")}
      </Field>
      <Field label="Plan">
        <Input value={form.plan} onBlur={()=> { setTouched(t=>({...t, plan:true})); validate(form); }} onChange={e=> { const v=e.currentTarget.value; set("plan", v); if(touched.plan) validate({ ...form, plan: v }); }} placeholder="Ej. Gastos Médicos Flex" />
        {showError("plan")}
      </Field>
      <Field label="Número de póliza">
        <Input value={form.numeroPoliza||""} onChange={e=>set("numeroPoliza", e.currentTarget.value)} />
      </Field>
      <Field label="Estado">
  <Select value={form.estado} onValueChange={v=> { set("estado", v as Policy["estado"]); setTouched(t=>({...t, estado:true})); if(touched.estado) validate({ ...form, estado: v as Policy["estado"] }); }}>
          <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
          <SelectContent>
            {(["Vigente","Propuesta","Rechazada","En proceso"]).map(s=> <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {showError("estado")}
      </Field>
      <Field label="Prima mensual">
  <Input type="number" value={form.primaMensual||""} onBlur={()=> { setTouched(t=>({...t, primaMensual:true})); validate(form); }} onChange={e=> { const val = e.currentTarget.value; const num = val === '' ? undefined : Number(val); set("primaMensual", (Number.isNaN(num) ? undefined : num) as Policy["primaMensual"]); if(touched.primaMensual) validate({ ...form, primaMensual: (Number.isNaN(num) ? undefined : num) }); }} />
        {showError("primaMensual")}
      </Field>
      <Field label="Moneda">
        <Select value={form.moneda||"MXN"} onValueChange={v=>set("moneda", v as Policy["moneda"])}>
          <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MXN">MXN</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
            <SelectItem value="UDIS">UDIS</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Forma de pago">
        <Select value={form.formaPago||"Mensual"} onValueChange={v=>set("formaPago", v as Policy["formaPago"])}>
          <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Mensual">Mensual</SelectItem>
            <SelectItem value="Trimestral">Trimestral</SelectItem>
            <SelectItem value="Semestral">Semestral</SelectItem>
            <SelectItem value="Anual">Anual</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Fecha de ingreso">
        <Input type="date" value={form.fechaIngreso||""} onChange={e=>set("fechaIngreso", e.currentTarget.value)} />
      </Field>
      <Field label="Fecha de pago">
        <Input type="date" value={form.fechaPago||""} onChange={e=>set("fechaPago", e.currentTarget.value)} />
      </Field>
      <Field label="Fecha de emisión">
        <Input type="date" value={form.fechaEntrega||""} onChange={e=>set("fechaEntrega", e.currentTarget.value)} />
      </Field>
      <div className="col-span-2 flex items-center gap-2">
        <input id="msi" type="checkbox" checked={Boolean(form.msi)} onChange={e=>set("msi", e.currentTarget.checked)} />
        <Label htmlFor="msi">Meses sin intereses (MSI)</Label>
      </div>
      <div className="col-span-2 mt-2 space-y-2">
        {Object.keys(errors).length > 0 && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
            Revisa los campos marcados.
          </div>
        )}
        <Button disabled={submitting} className="w-full disabled:opacity-60" onClick={handleSubmit}>{submitting? 'Guardando…' : isEdit? "Actualizar póliza" : "Guardar póliza"}</Button>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-neutral-600">{label}</Label>
      {children}
    </div>
  );
}
