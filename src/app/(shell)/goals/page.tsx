"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

import type { Goal } from "@/lib/types";
import { uid } from "@/lib/types";
import { useSessionUser } from "@/lib/auth/useSessionUser";
import { useGoals } from "@/features/goals/hooks/useGoals";

const GOAL_TYPES = [
  "Ingreso mensual",
  "Pólizas mensuales",
  "Citas semanales",
  "Referidos",
] as const;

type GoalType = (typeof GOAL_TYPES)[number];

function monthToday() {
  return new Date().toISOString().slice(0, 7);
}

export default function GoalsPage() {
  const sessionUser = useSessionUser();
  const {
    goals,
    loading,
    error,
    upsert,
    remove,
  } = useGoals();

  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{ open: boolean; goal: Goal | null }>({ open: false, goal: null });
  const [savingNew, setSavingNew] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = [...goals].sort((a, b) => (b.mes || "").localeCompare(a.mes || ""));
    if (!term) return base;
    return base.filter((g) => `${g.tipo} ${g.mes}`.toLowerCase().includes(term));
  }, [goals, q]);

  const handleCreate = async (goal: Goal) => {
    if (!sessionUser?.id) return;
    const payload: Goal = {
      ...goal,
      ownerId: sessionUser.id,
      createdAt: goal.createdAt || new Date().toISOString(),
    };
    setSavingNew(true);
    try {
      await upsert(payload);
      setOpenNew(false);
    } finally {
      setSavingNew(false);
    }
  };

  const handleUpdate = async (goal: Goal) => {
    const existing = goals.find((g) => g.id === goal.id);
    const payload: Goal = {
      ...goal,
      ownerId: existing?.ownerId || goal.ownerId,
      createdAt: existing?.createdAt || goal.createdAt,
    };
    setSavingEdit(true);
    try {
      await upsert(payload);
      setOpenEdit({ open: false, goal: null });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    setOpenEdit({ open: false, goal: null });
  };

  if (!sessionUser) {
    return <div className="p-6 text-sm text-neutral-500">Inicia sesión para gestionar metas.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Metas</h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar por tipo o mes (YYYY-MM)…"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            className="w-64"
          />
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button disabled={loading}><Plus className="mr-2" size={16} /> Nueva</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nueva meta</DialogTitle>
              </DialogHeader>
              <GoalForm onSubmit={handleCreate} submitting={savingNew} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading && (
          <Card className="shadow">
            <CardContent className="p-5 text-sm text-neutral-500">Cargando metas…</CardContent>
          </Card>
        )}

        {!loading && filtered.map((goal) => (
          <Card key={goal.id} className="shadow">
            <CardContent className="space-y-2 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{goal.tipo}</div>
                  <div className="text-xl font-semibold">{goal.mes}</div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setOpenEdit({ open: true, goal })}>
                  <Pencil className="mr-2" size={14} /> Editar
                </Button>
              </div>
              {typeof goal.metaMensual === "number" && (
                <div className="text-sm">
                  Meta mensual: <b>{goal.metaMensual.toLocaleString("es-MX")}</b>
                </div>
              )}
              {typeof goal.metaAnual === "number" && (
                <div className="text-xs text-neutral-500">
                  Meta anual: {goal.metaAnual.toLocaleString("es-MX")}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="text-sm text-muted-foreground">Sin metas registradas.</div>
        )}
      </div>

      <Dialog open={openEdit.open} onOpenChange={(o) => setOpenEdit({ open: o, goal: o ? openEdit.goal : null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar meta</DialogTitle>
          </DialogHeader>
          {openEdit.goal && (
            <GoalForm initial={openEdit.goal} onSubmit={handleUpdate} submitting={savingEdit} />
          )}
          {openEdit.goal && (
            <DialogFooter className="mt-2 justify-between">
              <Button
                variant="destructive"
                disabled={savingEdit}
                onClick={() => {
                  if (openEdit.goal && window.confirm("¿Eliminar esta meta permanentemente?")) {
                    handleDelete(openEdit.goal.id);
                  }
                }}
              >
                <Trash2 className="mr-2" size={16} /> Borrar meta
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type GoalFormProps = {
  initial?: Goal | null;
  onSubmit: (goal: Goal) => Promise<void> | void;
  submitting: boolean;
};

function GoalForm({ initial, onSubmit, submitting }: GoalFormProps) {
  const [form, setForm] = useState<Goal>(
    initial || {
      id: uid(),
      tipo: "Ingreso mensual",
      mes: monthToday(),
      metaMensual: 100000,
      metaAnual: undefined,
    }
  );

  React.useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  const set = <K extends keyof Goal>(key: K, value: Goal[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const isEdit = Boolean(initial);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Tipo">
        <Select value={form.tipo as GoalType} onValueChange={(v) => set("tipo", v as Goal["tipo"]) }>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {GOAL_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Mes">
        <Input type="month" value={form.mes || ""} onChange={(e) => set("mes", e.currentTarget.value)} />
      </Field>
      <Field label="Meta mensual">
        <Input
          type="number"
          value={form.metaMensual ?? ""}
          onChange={(e) => set("metaMensual", e.currentTarget.value ? Number(e.currentTarget.value) : undefined)}
        />
      </Field>
      <Field label="Meta anual">
        <Input
          type="number"
          value={form.metaAnual ?? ""}
          onChange={(e) => set("metaAnual", e.currentTarget.value ? Number(e.currentTarget.value) : undefined)}
        />
      </Field>
      <DialogFooter className="col-span-2 mt-2 flex items-center justify-between">
        <div />
              <Button disabled={submitting} onClick={() => onSubmit(form)}>
          {submitting ? 'Guardando…' : isEdit ? 'Actualizar meta' : 'Guardar meta'}
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
