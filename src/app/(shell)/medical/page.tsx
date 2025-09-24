"use client";

import React, { useMemo, useState } from "react";
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
import { useSessionUser } from "@/lib/auth/useSessionUser";
import { useClients } from "@/features/clients/hooks/useClients";
import { useMedicalForms } from "@/features/medical/hooks/useMedicalForms";

const uuid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // fallback RFC4122 v4-ish
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default function MedicalPage() {
  const session = useSessionUser();
  const { clients, loading: loadingClients } = useClients();
  const {
    medicalForms,
    loading: loadingForms,
    error,
    upsert,
    remove,
  } = useMedicalForms();

  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{ open: boolean; form: MedicalForm | null }>({ open: false, form: null });
  const [savingNew, setSavingNew] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const loading = loadingClients || loadingForms;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return medicalForms
      .filter((form) => {
        if (!term) return true;
        const client = clients.find((c) => c.id === form.clienteId);
        const nombre = client ? `${client.nombre} ${client.apellidoPaterno || ''} ${client.apellidoMaterno || ''}`.toLowerCase() : "";
        const fields = [form.enfermedades, form.medicamentos, form.cirugias, form.hospitalizacion, form.antecedentes, form.otros]
          .map((v) => (v || "").toLowerCase());
        return [nombre, ...fields].some((text) => text.includes(term));
      })
      .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  }, [medicalForms, q, clients]);

  const handleCreate = async (f: MedicalForm) => {
    if (!session?.id) return;
    setSavingNew(true);
    try {
      await upsert({ ...f, ownerId: session.id });
      setOpenNew(false);
    } finally {
      setSavingNew(false);
    }
  };

  const handleUpdate = async (f: MedicalForm) => {
    setSavingEdit(true);
    try {
      await upsert(f);
      setOpenEdit({ open: false, form: null });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    setOpenEdit({ open: false, form: null });
  };

  if (!session) {
    return (
      <Card className="shadow">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-2">Cuestionario Médico</h2>
          <p className="text-sm text-muted-foreground">Inicia sesión para ver tus cuestionarios.</p>
        </CardContent>
      </Card>
    );
  }

  const hasClients = clients.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Cuestionario Médico</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por cliente o padecimientos…"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            className="w-72"
          />
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button disabled={!hasClients || loading}>
                <Plus className="mr-2" size={16} /> Nuevo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Nuevo cuestionario</DialogTitle></DialogHeader>
              <MedicalFormEditor
                clients={clients}
                submitting={savingNew}
                onSubmit={(form) => handleCreate({ ...form, ownerId: session.id })}
              />
              {!hasClients && (
                <p className="text-xs text-amber-600">Necesitas al menos un cliente para registrar cuestionarios.</p>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <Card className="shadow">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-4 text-sm text-neutral-500">Cargando cuestionarios…</div>
          ) : (
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
                {filtered.map((form) => {
                  const client = clients.find((c) => c.id === form.clienteId);
                  const resumen = [form.enfermedades, form.medicamentos, form.cirugias]
                    .filter(Boolean)
                    .join(" | ") || "—";
                  return (
                    <tr key={form.id} className="border-t">
                      <td className="p-3">{client ? `${client.nombre} ${client.apellidoPaterno || ''}` : '—'}</td>
                      <td className="p-3">{form.fecha || '—'}</td>
                      <td className="p-3">
                        <Badge variant="secondary" className="mr-2">Resumen</Badge>
                        {resumen}
                      </td>
                      <td className="p-3 space-x-2">
                        <Dialog open={openEdit.open && openEdit.form?.id === form.id} onOpenChange={(open) => setOpenEdit({ open, form: open ? form : null })}>
                          <DialogTrigger asChild><Button size="sm" variant="secondary">Editar</Button></DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader><DialogTitle>Editar cuestionario</DialogTitle></DialogHeader>
                            {openEdit.form && (
                              <MedicalFormEditor
                                initial={openEdit.form}
                                clients={clients}
                                submitting={savingEdit}
                                onSubmit={handleUpdate}
                              />
                            )}
                            <DialogFooter className="justify-between mt-2">
                              <Button
                                variant="destructive"
                                disabled={savingEdit}
                                onClick={() => {
                                  if (openEdit.form && window.confirm('¿Eliminar este cuestionario médico?')) {
                                    void handleDelete(openEdit.form.id);
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
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td className="p-4 text-sm text-muted-foreground" colSpan={4}>
                      Sin cuestionarios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type MedicalFormEditorProps = {
  clients: Client[];
  onSubmit: (form: MedicalForm) => void;
  initial?: MedicalForm | null;
  submitting: boolean;
};

function MedicalFormEditor({ clients, onSubmit, initial, submitting }: MedicalFormEditorProps) {
  const [form, setForm] = useState<MedicalForm>(
    initial || {
      id: uuid(),
      clienteId: clients[0]?.id || "",
      fecha: new Date().toISOString().slice(0, 10),
      enfermedades: "",
      hospitalizacion: "",
      medicamentos: "",
      cirugias: "",
      antecedentes: "",
      otros: "",
      pdfUrl: undefined,
    }
  );

  React.useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  const set = <K extends keyof MedicalForm>(key: K, value: MedicalForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Cliente">
        <Select value={form.clienteId} onValueChange={(v) => set('clienteId', v)}>
          <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{`${c.nombre} ${c.apellidoPaterno || ''}`.trim()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Fecha">
        <Input type="date" value={form.fecha} onChange={(e) => set('fecha', e.currentTarget.value)} />
      </Field>
      <Field label="Enfermedades">
        <Textarea value={form.enfermedades || ""} onChange={(e) => set('enfermedades', e.currentTarget.value)} />
      </Field>
      <Field label="Hospitalización">
        <Textarea value={form.hospitalizacion || ""} onChange={(e) => set('hospitalizacion', e.currentTarget.value)} />
      </Field>
      <Field label="Medicamentos">
        <Textarea value={form.medicamentos || ""} onChange={(e) => set('medicamentos', e.currentTarget.value)} />
      </Field>
      <Field label="Cirugías">
        <Textarea value={form.cirugias || ""} onChange={(e) => set('cirugias', e.currentTarget.value)} />
      </Field>
      <Field label="Antecedentes">
        <Textarea value={form.antecedentes || ""} onChange={(e) => set('antecedentes', e.currentTarget.value)} />
      </Field>
      <Field label="Otros">
        <Textarea value={form.otros || ""} onChange={(e) => set('otros', e.currentTarget.value)} />
      </Field>
      <Field label="URL PDF (opcional)">
        <Input value={form.pdfUrl || ""} onChange={(e) => set('pdfUrl', e.currentTarget.value || undefined)} placeholder="https://..." />
      </Field>
      <DialogFooter className="col-span-2 mt-2">
        <Button disabled={submitting || !form.clienteId} className="ml-auto" onClick={() => onSubmit(form)}>
          {submitting ? 'Guardando…' : (initial ? 'Actualizar' : 'Guardar')}
        </Button>
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
