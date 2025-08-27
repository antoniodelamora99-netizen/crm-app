"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

// Simple, user-scoped storage (per user if you pass ownerId)
function loadChecklist(ownerId: string) {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(`tools_client_checklist_${ownerId}`) || "null"); } catch { return null; }
}
function saveChecklist(ownerId: string, data: any) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`tools_client_checklist_${ownerId}`, JSON.stringify(data));
}

export type ChecklistItem = {
  id: string;
  label: string;
  notes?: string;
  done: boolean;
};
export type ChecklistSection = {
  id: string;
  title: string;
  items: ChecklistItem[];
};

const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_SECTIONS: ChecklistSection[] = [
  {
    id: "preventa",
    title: "Preventa",
    items: [
      { id: uid(), label: "ANF realizado", done: false },
      { id: uid(), label: "Documentos de identidad", done: false },
      { id: uid(), label: "Referidos obtenidos", done: false },
    ],
  },
  {
    id: "cotizacion",
    title: "Cotización",
    items: [
      { id: uid(), label: "Plan elegido", done: false },
      { id: uid(), label: "Moneda definida", done: false },
      { id: uid(), label: "Prima presentada", done: false },
    ],
  },
  {
    id: "contratacion",
    title: "Contratación",
    items: [
      { id: uid(), label: "Solicitud llena", done: false },
      { id: uid(), label: "Cuestionario médico", done: false },
      { id: uid(), label: "Examen médico agendado", done: false },
    ],
  },
  {
    id: "postventa",
    title: "Postventa",
    items: [
      { id: uid(), label: "Pago recibido", done: false },
      { id: uid(), label: "Póliza entregada", done: false },
      { id: uid(), label: "Seguimiento a 30 días", done: false },
    ],
  },
];

export default function ClientChecklistPage({ ownerId = "global" }: { ownerId?: string }) {
  const [sections, setSections] = useState<ChecklistSection[]>(() => loadChecklist(ownerId) ?? DEFAULT_SECTIONS);
  const [newItemLabel, setNewItemLabel] = useState("");
  const [newItemSection, setNewItemSection] = useState("preventa");

  useEffect(() => { saveChecklist(ownerId, sections); }, [ownerId, sections]);

  const progress = useMemo(() => {
    const totals = sections.reduce(
      (acc, s) => {
        const t = s.items.length;
        const d = s.items.filter(i => i.done).length;
        acc.total += t; acc.done += d; acc.bySection[s.id] = { total: t, done: d, title: s.title };
        return acc;
      },
      { total: 0, done: 0, bySection: {} as Record<string, { total: number; done: number; title: string }>} 
    );
    return totals;
  }, [sections]);

  const toggle = (sid: string, iid: string) => {
    setSections(prev => prev.map(s => s.id !== sid ? s : ({
      ...s,
      items: s.items.map(i => i.id === iid ? { ...i, done: !i.done } : i)
    })));
  };

  const updateNotes = (sid: string, iid: string, notes: string) => {
    setSections(prev => prev.map(s => s.id !== sid ? s : ({
      ...s,
      items: s.items.map(i => i.id === iid ? { ...i, notes } : i)
    })));
  };

  const addItem = () => {
    const label = newItemLabel.trim();
    if (!label) return;
    setSections(prev => prev.map(s => s.id !== newItemSection ? s : ({
      ...s,
      items: [{ id: uid(), label, done: false }, ...s.items],
    })));
    setNewItemLabel("");
  };

  const removeItem = (sid: string, iid: string) => {
    setSections(prev => prev.map(s => s.id !== sid ? s : ({
      ...s,
      items: s.items.filter(i => i.id !== iid)
    })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Checklist del Cliente</h2>
          <p className="text-sm text-muted-foreground">Marca los pasos realizados por etapa y agrega tus propios puntos.</p>
        </div>
        <div className="flex gap-2 items-end">
          <div className="grid gap-1">
            <Label className="text-xs">Nueva tarea</Label>
            <Input value={newItemLabel} onChange={(e)=>setNewItemLabel((e.target as HTMLInputElement).value)} placeholder="Ej. Confirmar datos de contacto" />
          </div>
          <div className="grid gap-1 w-40">
            <Label className="text-xs">Agregar en</Label>
            <Select value={newItemSection} onValueChange={setNewItemSection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {sections.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addItem}><Plus className="mr-2" size={16}/>Agregar</Button>
        </div>
      </div>

      {/* Resumen */}
      <Card className="shadow">
        <CardContent className="p-4">
          <div className="text-sm">Progreso total: <b>{progress.done}</b> / {progress.total}</div>
          <div className="grid md:grid-cols-4 gap-3 mt-3">
            {Object.entries(progress.bySection).map(([id, s]) => (
              <div key={id} className="rounded border p-3">
                <div className="text-xs text-muted-foreground">{s.title}</div>
                <div className="text-lg font-semibold">{s.done} / {s.total}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Secciones */}
      <div className="grid md:grid-cols-2 gap-4">
        {sections.map(section => (
          <Card key={section.id} className="shadow">
            <CardContent className="p-4 space-y-3">
              <div className="text-sm font-semibold">{section.title}</div>
              <div className="space-y-2">
                {section.items.map(item => (
                  <div key={item.id} className="flex items-start gap-3 p-2 rounded border">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={item.done}
                      onChange={() => toggle(section.id, item.id)}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{item.label}</div>
                      <Textarea
                        className="mt-1"
                        placeholder="Notas…"
                        value={item.notes || ""}
                        onChange={(e)=>updateNotes(section.id, item.id, (e.target as HTMLTextAreaElement).value)}
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={()=>removeItem(section.id, item.id)} title="Eliminar">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                {section.items.length === 0 && (
                  <div className="text-xs text-muted-foreground">No hay tareas en esta sección.</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
