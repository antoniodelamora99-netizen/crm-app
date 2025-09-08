"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge"; // (Tal vez ya no se usa tras refactor)
import { Label } from "@/components/ui/label"; // needed for external form components if any label referenced here
import { Plus } from "lucide-react";

import { Client, Policy, uid, User } from "@/lib/types";
import { repo, LS_KEYS } from "@/lib/storage";
import { getCurrentUser, filterByScope, getUsers } from "@/lib/users";
import { PolicyForm } from "@/features/policies/components/PolicyForm";
import { PoliciesTable } from "@/features/policies/components/PoliciesTable";

// Repos locales (SSR-safe)
const ClientsRepo = repo<Client>(LS_KEYS.clients);
const PoliciesRepo = repo<Policy>(LS_KEYS.policies);

// Helpers de estilo para estados de póliza
const policyStatusClass: Record<Policy["estado"], string> = {
  Vigente: "bg-emerald-100 text-emerald-800",
  Propuesta: "bg-amber-100 text-amber-800",
  Rechazada: "bg-red-100 text-red-800",
  "En proceso": "bg-blue-100 text-blue-800",
};

// Utilidad para mostrar solo el primer nombre del cliente
const firstName = (full?: string) => (full ? full.split(" ")[0] : "-");

export default function PoliciesPage() {
  const user = getCurrentUser();
  const role = user?.role || "asesor";
  const users: User[] = getUsers ? getUsers() : [];

  // Datos base
  const [clients, setClients] = useState<Client[]>(ClientsRepo.list());
  const [rows, setRows] = useState<Policy[]>(PoliciesRepo.list());

  // Persistencia
  useEffect(() => { PoliciesRepo.saveAll(rows); }, [rows]);

  // Filtro por alcance (promotor/gerente ven lo de su scope; asesor solo lo suyo)
  const visiblePolicies = useMemo<Policy[]>(() => {
    if (!user) return [];
    return filterByScope<Policy>(rows, user, (p) => p.ownerId);
  }, [rows, user]);

  const visibleClients = useMemo<Client[]>(() => {
    if (!user) return [];
    return filterByScope<Client>(clients, user, (c) => c.ownerId);
  }, [clients, user]);

  // Búsqueda y orden
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<"createdAt" | "plan" | "cliente" | "prima">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const lc = q.toLowerCase();
    const list = visiblePolicies.filter((p) => {
      const c = visibleClients.find((x) => x.id === p.clienteId);
      const hay = [
        p.plan,
        p.numeroPoliza,
        c?.nombre,
        c?.apellidoPaterno,
        c?.apellidoMaterno,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(lc);
    });

    const sorted = [...list].sort((a, b) => {
      if (sortKey === "createdAt") {
        const A = a.createdAt || "";
        const B = b.createdAt || "";
        return sortDir === "asc" ? A.localeCompare(B) : B.localeCompare(A);
      }
      if (sortKey === "plan") {
        return sortDir === "asc" ? a.plan.localeCompare(b.plan) : b.plan.localeCompare(a.plan);
      }
      if (sortKey === "cliente") {
        const ca = visibleClients.find((x) => x.id === a.clienteId)?.nombre || "";
        const cb = visibleClients.find((x) => x.id === b.clienteId)?.nombre || "";
        return sortDir === "asc" ? ca.localeCompare(cb) : cb.localeCompare(ca);
      }
      // prima
      const pa = a.primaMensual || 0;
      const pb = b.primaMensual || 0;
      return sortDir === "asc" ? pa - pb : pb - pa;
    });

    return sorted;
  }, [q, visiblePolicies, visibleClients, sortKey, sortDir]);

  // Estado de modales (solo asesores pueden crear/editar/borrar)
  const allowEdit = role === "asesor";
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{ open: boolean; policy: Policy | null }>({ open: false, policy: null });

  const handleCreate = (p: Policy) => {
    if (!user) return;
    const withMeta: Policy = { ...p, ownerId: user.id, createdAt: p.createdAt || new Date().toISOString() } as Policy;
    setRows([withMeta, ...rows]);
    setOpenNew(false);
  };

  const handleUpdate = (p: Policy) => {
    setRows((prev) => prev.map((x) => (x.id === p.id ? p : x)));
    setOpenEdit({ open: false, policy: null });
  };

  const handleDelete = (id: string) => {
    setRows((prev) => prev.filter((x) => x.id !== id));
  };

  // Usuario/advisor/manager flexible (puede venir de distintos modelos previos)
  interface Personish {
    id?: string;
    name?: string;
    username?: string;
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    fullName?: string;
    managerId?: string;
    gerenteId?: string;
    promoterId?: string;
    promotorId?: string;
    gerenciaId?: string;
  }
  const displayUser = (u?: Personish) => {
    if (!u) return "-";
    const n =
      (u.nombre ? `${u.nombre} ${u.apellidoPaterno || ""}`.trim() : null) ||
      u.name ||
      u.fullName ||
      u.username;
    return n || "-";
  };
  const displayGerenciaFor = (advisor?: Personish) => {
    if (!advisor) return "-";
    // Try common manager keys
  const managerId = advisor.managerId || advisor.gerenteId || advisor.promotorId || advisor.gerenciaId;
    const manager =
      (managerId && users.find((x) => x.id === managerId)) ||
      null;
  return displayUser(manager || undefined);
  };

  const baseCols = 8; // cliente, plan, estado, prima, moneda, ingreso, pago, emisión
  const extraCols = role !== "asesor" ? 2 : 0; // asesor, gerencia
  const totalCols = baseCols + extraCols + (allowEdit ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Pólizas</h2>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Buscar por plan / cliente / # póliza…"
            value={q}
            onChange={(e) => setQ((e.target as HTMLInputElement).value)}
            className="w-64"
          />
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Orden"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Fecha de creación</SelectItem>
              <SelectItem value="plan">Plan (A–Z)</SelectItem>
              <SelectItem value="cliente">Cliente (A–Z)</SelectItem>
              <SelectItem value="prima">Prima</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortDir} onValueChange={(v) => setSortDir(v as typeof sortDir)}>
            <SelectTrigger className="w-28"><SelectValue placeholder="Dirección"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Asc</SelectItem>
              <SelectItem value="desc">Desc</SelectItem>
            </SelectContent>
          </Select>
          {allowEdit && (
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2" size={16}/>Nueva</Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader><DialogTitle>Nueva póliza</DialogTitle></DialogHeader>
                <PolicyForm clients={visibleClients} onSubmit={handleCreate} />
              </DialogContent>
            </Dialog>
          )}
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
                <th className="text-left p-3">Prima</th>
                <th className="text-left p-3">Moneda</th>
                <th className="text-left p-3">Ingreso</th>
                <th className="text-left p-3">Pago</th>
                <th className="text-left p-3">Emisión</th>
                {role !== "asesor" && <th className="text-left p-3">Asesor</th>}
                {role !== "asesor" && <th className="text-left p-3">Gerencia</th>}
                {allowEdit && <th className="text-left p-3">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const c = visibleClients.find((x) => x.id === r.clienteId);
                const clienteNombre = (user?.role === "asesor")
                  ? `${c?.nombre ?? "-"} ${c?.apellidoPaterno ?? ""}`.trim()
                  : firstName(c?.nombre);
                const advisor = users.find((u) => u.id === r.ownerId);
                const asesorNombre = displayUser(advisor);
                const gerenciaNombre = displayGerenciaFor(advisor);
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{clienteNombre || "-"}</td>
                    <td className="p-3">{r.plan}</td>
                    <td className="p-3"><Badge className={policyStatusClass[r.estado]}>{r.estado}</Badge></td>
                    <td className="p-3">{r.primaMensual ? r.primaMensual.toLocaleString("es-MX", { style: "currency", currency: r.moneda || "MXN" }) : "-"}</td>
                    <td className="p-3">{r.moneda || "MXN"}</td>
                    <td className="p-3">{r.fechaIngreso || "-"}</td>
                    <td className="p-3">{r.fechaPago || "-"}</td>
                    <td className="p-3">{r.fechaEntrega || "-"}</td>
                    {role !== "asesor" && <td className="p-3">{asesorNombre}</td>}
                    {role !== "asesor" && <td className="p-3">{gerenciaNombre}</td>}
                    {allowEdit && (
                      <td className="p-3 space-x-2">
                        <Button variant="secondary" size="sm" onClick={() => setOpenEdit({ open: true, policy: r })}>Editar</Button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-sm text-muted-foreground" colSpan={totalCols}>
                    Sin pólizas para mostrar
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modal de edición (solo asesores) */}
      {allowEdit && (
        <Dialog open={openEdit.open} onOpenChange={(o) => setOpenEdit({ open: o, policy: o ? openEdit.policy : null })}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Editar póliza</DialogTitle></DialogHeader>
            {openEdit.policy && (
              <PolicyForm initial={openEdit.policy} clients={visibleClients} onSubmit={handleUpdate} />
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
      )}
    </div>
  );
}

