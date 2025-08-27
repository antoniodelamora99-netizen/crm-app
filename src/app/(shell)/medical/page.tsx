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
import { Plus } from "lucide-react";

import type { Client, MedicalForm } from "@/lib/types";
import { repo, LS_KEYS } from "@/lib/storage";
import { getCurrentUser, filterByScope } from "@/lib/users";

// Repos locales (localStorage safe)
const ClientsRepo = repo<Client>(LS_KEYS.clients);
const MedicalRepo = repo<MedicalForm>(LS_KEYS.medical);

function toClientLabel(c: Client) {
  return `${c.nombre}${c.apellidoPaterno ? ` ${c.apellidoPaterno}` : ""}`.trim();
}

export default function MedicalPage() {
  const me = getCurrentUser();
  const [allClients, setAllClients] = useState<Client[]>(ClientsRepo.list());
  const [rows, setRows] = useState<MedicalForm[]>(MedicalRepo.list());
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{ open: boolean; row: MedicalForm | null }>({
    open: false,
    row: null,
  });
  const [q, setQ] = useState("");

  // scope filtering (promotor/gerente/asesor)
  const clients = useMemo(() => {
    if (!me) return [] as Client[];
    return filterByScope(allClients, me, (c) => (c as Client).ownerId);
  }, [allClients, me]);

  const forms = useMemo(() => {
    if (!me) return [] as MedicalForm[];
    const scoped = filterByScope(rows, me, (r) => (r as MedicalForm).ownerId);
    return scoped.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  }, [rows, me]);

  const filtered = useMemo(() => {
    if (!q.trim()) return forms;
    const ql = q.toLowerCase();
    return forms.filter((r) => {
      const client = clients.find((c) => c.id === r.clienteId);
      const name = client ? toClientLabel(client).toLowerCase() : "";
      return (
        name.includes(ql) ||
        (r.enfermedades || "").toLowerCase().includes(ql) ||
        (r.medicamentos || "").toLowerCase().includes(ql) ||
        (r.cirugias || "").toLowerCase().includes(ql)
      );
    });
  }, [forms, clients, q]);

  useEffect(() => {
    // persist
    MedicalRepo.saveAll(rows);
  }, [rows]);

  useEffect(() => {
    // keep clients in sync if changed elsewhere
    setAllClients(ClientsRepo.list());
  }, []);

  const handleCreate = (m: MedicalForm) => {
    setRows((prev) => [m, ...prev]);
    setOpenNew(false);
  };

  const handleUpdate = (m: MedicalForm) => {
    setRows((prev) => prev.map((x) => (x.id === m.id ? m : x)));
    setOpenEdit({ open: false, row: null });
  };

  const handleDelete = (id: string) => {
    setRows((prev) => prev.filter((x) => x.id !== id));
    setOpenEdit({ open: false, row: null });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Cuestionario Médico</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por cliente o término…"
            value={q}
            onChange={(e) => setQ((e.target as HTMLInputElement).value)}
            className="w-64"
          />
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2" size={16} /> Nuevo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nuevo cuestionario</DialogTitle>
              </DialogHeader>
              <MedicalFormEditor
                clients={clients}
                currentUserId={me?.id}
                onSubmit={handleCreate}
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
              {filtered.map((r) => {
                const c = clients.find((x) => x.id === r.clienteId);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{c ? toClientLabel(c) : "-"}</td>
                    <td className="p-3">{r.fecha}</td>
                    <td className="p-3">
                      {[
                        r.enfermedades,
                        r.medicamentos,
                        r.cirugias,
                        r.hospitalizacion,
                      ]
                        .filter(Boolean)
                        .join(" | ") || "—"}
                    </td>
                    <td className="p-3 space-x-2">
                      <Dialog
                        open={openEdit.open && openEdit.row?.id === r.id}
                        onOpenChange={(o) =>
                          setOpenEdit({ open: o, row: o ? r : null })
                        }
                      >
                        <DialogTrigger asChild>
                          <Button variant="secondary" size="sm">
                            Editar
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Editar cuestionario</DialogTitle>
                          </DialogHeader>
                          <MedicalFormEditor
                            clients={clients}
                            currentUserId={me?.id}
                            initial={openEdit.row || r}
                            onSubmit={handleUpdate}
                          />
                          <DialogFooter className="justify-between mt-2">
                            <Button
                              variant="destructive"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "¿Eliminar este cuestionario médico?"
                                  )
                                ) {
                                  handleDelete(r.id);
                                }
                              }}
                            >
                              Borrar cuestionario
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      {r.pdfUrl && (
                        <a
                          href={r.pdfUrl}
                          download={`cuestionario_${r.id}.pdf`}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Descargar PDF
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-sm text-muted-foreground" colSpan={4}>
                    Sin cuestionarios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
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

function MedicalFormEditor({
  clients,
  onSubmit,
  initial,
  currentUserId,
}: {
  clients: Client[];
  onSubmit: (m: MedicalForm) => void;
  initial?: MedicalForm;
  currentUserId?: string;
}) {
  const [form, setForm] = useState<MedicalForm>(
    initial || {
      id: Math.random().toString(36).slice(2, 10),
      clienteId: clients[0]?.id || "",
      fecha: new Date().toISOString().slice(0, 10),
      ownerId: currentUserId,
    }
  );

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  const set = (k: keyof MedicalForm, v: any) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("pdfUrl", String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Cliente">
        <Select
          value={form.clienteId}
          onValueChange={(v) => set("clienteId", v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {toClientLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Fecha">
        <Input
          type="date"
          value={form.fecha || ""}
          onChange={(e) => set("fecha", (e.target as HTMLInputElement).value)}
        />
      </Field>
      <Field label="Enfermedades">
        <Textarea
          value={form.enfermedades || ""}
          onChange={(e) => set("enfermedades", (e.target as HTMLTextAreaElement).value)}
        />
      </Field>
      <Field label="Hospitalización">
        <Textarea
          value={form.hospitalizacion || ""}
          onChange={(e) => set("hospitalizacion", (e.target as HTMLTextAreaElement).value)}
        />
      </Field>
      <Field label="Medicamentos">
        <Textarea
          value={form.medicamentos || ""}
          onChange={(e) => set("medicamentos", (e.target as HTMLTextAreaElement).value)}
        />
      </Field>
      <Field label="Cirugías">
        <Textarea
          value={form.cirugias || ""}
          onChange={(e) => set("cirugias", (e.target as HTMLTextAreaElement).value)}
        />
      </Field>
      <Field label="Antecedentes">
        <Textarea
          value={form.antecedentes || ""}
          onChange={(e) => set("antecedentes", (e.target as HTMLTextAreaElement).value)}
        />
      </Field>
      <Field label="Otros">
        <Textarea
          value={form.otros || ""}
          onChange={(e) => set("otros", (e.target as HTMLTextAreaElement).value)}
        />
      </Field>
      <Field label="PDF (opcional)">
        <Input type="file" accept="application/pdf" onChange={onFileChange} />
        {form.pdfUrl && (
          <span className="text-xs text-neutral-500 mt-1">PDF adjunto</span>
        )}
      </Field>
      <DialogFooter className="col-span-2 mt-2">
        <Button className="w-full" onClick={() => onSubmit(form)}>
          {initial ? "Actualizar cuestionario" : "Guardar cuestionario"}
        </Button>
      </DialogFooter>
    </div>
  );
}
