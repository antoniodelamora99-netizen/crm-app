"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

import type { Client, Policy } from "@/lib/types";
import { useSessionUser } from "@/lib/auth/useSessionUser";
import { useProfile } from "@/lib/auth/useProfile";
import { useClients } from "@/features/clients/hooks/useClients";
import { usePolicies } from "@/features/policies/hooks/usePolicies";
import { useProfilesList } from "@/features/users/hooks/useProfilesList";
import { PolicyForm } from "@/features/policies/components/PolicyForm";
import { PoliciesTable } from "@/features/policies/components/PoliciesTable";

export default function PoliciesPage() {
  const sessionUser = useSessionUser();
  const { profile } = useProfile(sessionUser?.id);
  const role = profile?.activeRole || profile?.role || "asesor";

  const {
    clients,
    loading: loadingClients,
  } = useClients();
  const {
    policies,
    loading: loadingPolicies,
    upsert,
    remove,
  } = usePolicies();
  const {
    profiles,
    loading: loadingProfiles,
  } = useProfilesList();

  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<"createdAt" | "plan" | "cliente" | "prima">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState<{ open: boolean; policy: Policy | null }>({ open: false, policy: null });

  const filtered = useMemo(() => {
    const lc = q.toLowerCase();
    const list = policies.filter((p) => {
      const c = clients.find((x) => x.id === p.clienteId);
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
        const ca = clients.find((x) => x.id === a.clienteId)?.nombre || "";
        const cb = clients.find((x) => x.id === b.clienteId)?.nombre || "";
        return sortDir === "asc" ? ca.localeCompare(cb) : cb.localeCompare(ca);
      }
      const pa = a.primaMensual || 0;
      const pb = b.primaMensual || 0;
      return sortDir === "asc" ? pa - pb : pb - pa;
    });

    return sorted;
  }, [q, policies, clients, sortKey, sortDir]);

  const allowCrud = role === "asesor" || role === "admin" || role === "promotor";
  const allowEdit = role === "asesor";

  const handleCreate = async (policy: Policy) => {
    if (!sessionUser?.id) return;
    const payload: Policy = {
      ...policy,
      ownerId: sessionUser.id,
      createdAt: policy.createdAt || new Date().toISOString(),
    };
    await upsert(payload);
    setOpenNew(false);
  };

  const handleUpdate = async (policy: Policy) => {
    const existing = policies.find((p) => p.id === policy.id);
    const payload: Policy = {
      ...policy,
      ownerId: existing?.ownerId || policy.ownerId,
      createdAt: existing?.createdAt || policy.createdAt,
    };
    await upsert(payload);
    setOpenEdit({ open: false, policy: null });
  };

  const handleDelete = async (id: string) => {
    await remove(id);
  };

  const loadingTable = loadingPolicies || loadingClients || loadingProfiles;

  const policyProfiles = profiles.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    manager_id: p.manager_id,
    promoter_id: p.promoter_id,
  }));

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
          {allowCrud && (
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2" size={16}/>Nueva</Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader><DialogTitle>Nueva póliza</DialogTitle></DialogHeader>
                <PolicyForm clients={clients} onSubmit={handleCreate} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card className="shadow">
        <CardContent className="p-0 overflow-x-auto">
          {loadingTable ? (
            <div className="p-4 text-sm text-neutral-500">Cargando pólizas…</div>
          ) : (
            <PoliciesTable
              policies={filtered}
              clients={clients}
              profiles={policyProfiles}
              role={role}
              allowEdit={allowEdit}
              onEdit={(policy) => setOpenEdit({ open: true, policy })}
            />
          )}
        </CardContent>
      </Card>

      {allowEdit && (
        <Dialog open={openEdit.open} onOpenChange={(o) => setOpenEdit({ open: o, policy: o ? openEdit.policy : null })}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Editar póliza</DialogTitle></DialogHeader>
            {openEdit.policy && (
              <PolicyForm initial={openEdit.policy} clients={clients} onSubmit={handleUpdate} />
            )}
            <DialogFooter className="justify-between mt-2">
              <Button
                variant="destructive"
                onClick={() => {
                  if (openEdit.policy && window.confirm("¿Eliminar esta póliza?")) {
                    handleDelete(openEdit.policy.id).then(() => setOpenEdit({ open: false, policy: null }));
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
