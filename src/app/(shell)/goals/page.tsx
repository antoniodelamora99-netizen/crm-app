"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Pencil, Trash2 } from "lucide-react";

import type { Goal } from "@/lib/types";
import { uid } from "@/lib/types";
import { repo, LS_KEYS } from "@/lib/storage";
import { getCurrentUser, filterByScope } from "@/lib/users";

// Goal con ownerId para persistencia local
interface GoalExtended extends Goal { ownerId: string }
const GoalsRepo = repo<GoalExtended>(LS_KEYS.goals);

function monthToday() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export default function GoalsPage() {
  const [rows, setRows] = useState<GoalExtended[]>(GoalsRepo.list());
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{ open: boolean; goal: GoalExtended | null }>({ open: false, goal: null });
  const me = getCurrentUser();

  // persist
  useEffect(() => {
    GoalsRepo.saveAll(rows);
  }, [rows]);

  const scoped = useMemo<GoalExtended[]>(() => {
    if (!me) return [];
    return filterByScope<GoalExtended>(rows, me, (g) => g.ownerId);
  }, [rows, me]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return scoped;
    return scoped.filter((g) => `${g.tipo} ${g.mes}`.toLowerCase().includes(term));
  }, [scoped, q]);

  const canCreate = Boolean(me); // anyone logged in can create their own goals
  const canEdit = (g: GoalExtended) => !!me && g.ownerId === me.id;

  const handleCreate = (g: Goal) => {
    if (!me) return;
    const extended: GoalExtended = { ...g, ownerId: me.id };
    setRows([extended, ...rows]);
    setOpenNew(false);
  };

  const handleUpdate = (g: GoalExtended) => {
    setRows((prev) => prev.map((x) => (x.id === g.id ? g : x)));
    setOpenEdit({ open: false, goal: null });
  };

  const handleDelete = (id: string) => {
    setRows((prev) => prev.filter((x) => x.id !== id));
    setOpenEdit({ open: false, goal: null });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Metas</h2>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Buscar por tipo o mes (YYYY-MM)…"
            value={q}
            onChange={(e) => setQ((e.target as HTMLInputElement).value)}
            className="w-64"
          />
          {canCreate && (
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2" size={16} /> Nueva
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nueva meta</DialogTitle>
                </DialogHeader>
                <GoalForm onSubmit={handleCreate} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((g) => (
          <Card key={g.id} className="shadow">
            <CardContent className="p-5 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">{g.tipo}</div>
                  <div className="text-xl font-semibold">{g.mes}</div>
                </div>
                {canEdit(g) && (
                  <Button size="sm" variant="secondary" onClick={() => setOpenEdit({ open: true, goal: g })}>
                    <Pencil className="mr-2" size={14} /> Editar
                  </Button>
                )}
              </div>
              {typeof g.metaMensual === "number" && (
                <div className="text-sm">
                  Meta mensual: <b>{g.metaMensual}</b>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-sm text-muted-foreground">Sin metas en tu alcance.</div>
        )}
      </div>

      <Dialog
        open={openEdit.open}
        onOpenChange={(o) => setOpenEdit({ open: o, goal: o ? openEdit.goal : null })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar meta</DialogTitle>
          </DialogHeader>
          {openEdit.goal && (
            <GoalForm initial={openEdit.goal} onSubmit={(g) => handleUpdate(g as GoalExtended)} />
          )}
          {openEdit.goal && canEdit(openEdit.goal) && (
            <DialogFooter className="justify-between mt-2">
              <Button
                variant="destructive"
                onClick={() => {
                  if (window.confirm("¿Eliminar esta meta permanentemente?")) {
                    if (openEdit.goal) handleDelete(openEdit.goal.id);
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

const GOAL_TYPES = [
  "Ingreso mensual",
  "Pólizas mensuales",
  "Citas semanales",
  "Referidos"
] as const;
type GoalType = typeof GOAL_TYPES[number];

type GoalFormShape = Goal & { ownerId?: string } & { tipo: GoalType };

function GoalForm({ initial, onSubmit }: { initial?: GoalFormShape | null; onSubmit: (g: GoalFormShape) => void }) {
  const [form, setForm] = useState<GoalFormShape>(
    (initial as GoalFormShape) || { id: uid(), tipo: "Ingreso mensual", mes: monthToday(), metaMensual: 100000 }
  );
  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);
  const set = <K extends keyof GoalFormShape>(k: K, v: GoalFormShape[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));
  const isEdit = Boolean(initial);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Tipo">
  <Select value={form.tipo} onValueChange={(v) => set("tipo", v as GoalType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GOAL_TYPES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Mes">
        <Input
          type="month"
          value={form.mes}
          onChange={(e) => set("mes", (e.target as HTMLInputElement).value)}
        />
      </Field>
      <Field label="Meta mensual">
        <Input
          type="number"
          value={form.metaMensual ?? ""}
          onChange={(e) => set("metaMensual", Number((e.target as HTMLInputElement).value) || 0)}
        />
      </Field>

      <DialogFooter className="col-span-2 mt-2">
        <Button className="w-full" onClick={() => onSubmit(form)}>
          {isEdit ? "Actualizar meta" : "Guardar meta"}
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