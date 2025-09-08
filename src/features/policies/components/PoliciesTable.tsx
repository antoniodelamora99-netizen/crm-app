"use client";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Client, Policy, User } from "@/lib/types";

const policyStatusClass: Record<Policy["estado"], string> = {
  Vigente: "bg-emerald-100 text-emerald-800",
  Propuesta: "bg-amber-100 text-amber-800",
  Rechazada: "bg-red-100 text-red-800",
  "En proceso": "bg-blue-100 text-blue-800",
};

export function PoliciesTable({
  policies,
  clients,
  users,
  role,
  allowEdit,
  onEdit,
}: {
  policies: Policy[];
  clients: Client[];
  users: User[];
  role: string;
  allowEdit: boolean;
  onEdit: (p: Policy) => void;
}) {
  return (
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
        {policies.map((r) => {
          const c = clients.find((x) => x.id === r.clienteId);
          const advisor = users.find((u) => u.id === r.ownerId);
          const clienteNombre = `${c?.nombre ?? "-"} ${c?.apellidoPaterno ?? ""}`.trim();
          const asesorNombre = advisor?.name || "-";
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
              {role !== "asesor" && <td className="p-3">—</td>}
              {allowEdit && (
                <td className="p-3 space-x-2">
                  <Button variant="secondary" size="sm" onClick={() => onEdit(r)}>Editar</Button>
                </td>
              )}
            </tr>
          );
        })}
        {policies.length === 0 && (
          <tr>
            <td colSpan={role !== "asesor" ? 11 : 9} className="p-4 text-sm text-muted-foreground">Sin pólizas para mostrar</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
