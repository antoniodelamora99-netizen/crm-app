"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { repo, LS_KEYS } from "@/lib/storage";
import { getCurrentUser, filterByScope } from "@/lib/users";
import type { Client, Policy, Activity } from "@/lib/types";

// Helpers -------------------------------------------------------------
const ClientsRepo = repo<Client>(LS_KEYS.clients);
const PoliciesRepo = repo<Policy>(LS_KEYS.policies);
const ActivitiesRepo = repo<Activity>(LS_KEYS.activities);

function inRange(dateIso: string | undefined, start: Date) {
  if (!dateIso) return false;
  const d = new Date(dateIso);
  return d >= start;
}

function startFor(range: "week" | "month" | "quarter" | "all") {
  const now = new Date();
  if (range === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (range === "quarter") {
    const d = new Date(now);
    d.setDate(d.getDate() - 90);
    return d;
  }
  if (range === "all") return new Date(0);
  // month
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default function Dashboard() {
  const [range, setRange] = useState<"week" | "month" | "quarter" | "all">("month");
  const rangeStart = useMemo(() => startFor(range), [range]);

  // scope by current user
  const me = getCurrentUser();
  const allClients = ClientsRepo.list();
  const allPolicies = PoliciesRepo.list();
  const allActivities = ActivitiesRepo.list();

  const clients = me ? filterByScope(allClients, me, (c) => (c as Client).ownerId) : allClients;
  const policies = me ? filterByScope(allPolicies, me, (p) => (p as Policy).ownerId) : allPolicies;
  const activities = me ? filterByScope(allActivities, me, (a) => (a as Activity).ownerId) : allActivities;

  // Derived metrics ---------------------------------------------------
  const nuevosProspectos = clients.filter((c) => inRange(c.createdAt, rangeStart)).length;

  const llamadasRealizadas = activities.filter(
    (a) => a.tipo === "Llamada" && a.realizada && inRange(a.fechaHora, rangeStart)
  ).length;

  const citasObtenidas = activities.filter(
    (a) => a.tipo.startsWith("Cita") && inRange(a.fechaHora, rangeStart)
  ).length;

  const entrevistasCierre = activities.filter(
    (a) => a.tipo === "Cita Cierre" && a.realizada && inRange(a.fechaHora, rangeStart)
  ).length;

  const referidosObtenidos = activities.filter(
    (a) => a.obtuvoReferidos && inRange(a.fechaHora, rangeStart)
  ).length;

  const cuestionariosANF = clients.filter(
    (c) => c.anfRealizado && (c.anfFecha ? inRange(c.anfFecha, rangeStart) : true)
  ).length;

  // Tasa de cierre (cierres / realizadas)
  const realizadasTotales = activities.filter(
    (a) => a.realizada && inRange(a.fechaHora, rangeStart)
  ).length;
  const tasaCierre = realizadasTotales ? Math.round((entrevistasCierre / realizadasTotales) * 100) : 0;

  // Funnel (period) ---------------------------------------------------
  const funnel = {
    llamadas: llamadasRealizadas,
    citas: activities.filter((a) => a.tipo.startsWith("Cita") && inRange(a.fechaHora, rangeStart)).length,
    cierres: activities.filter((a) => a.tipo === "Cita Cierre" && inRange(a.fechaHora, rangeStart)).length,
    emitidas: policies.filter((p) => inRange(p.fechaIngreso || p.fechaEntrega || "", rangeStart)).length,
    pagadas: policies.filter((p) => inRange(p.fechaPago || "", rangeStart)).length,
  };

  // Points ------------------------------------------------------------
  const puntos =
    referidosObtenidos * 1 +
    llamadasRealizadas * 1 +
    citasObtenidas * 2 +
    cuestionariosANF * 2 +
    entrevistasCierre * 3;

  // UI ---------------------------------------------------------------
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex gap-2">
          {(["week", "month", "quarter", "all"] as const).map((k) => (
            <Button key={k} variant={range === k ? "default" : "secondary"} onClick={() => setRange(k)}>
              {k === "week" && "Esta semana"}
              {k === "month" && "Este mes"}
              {k === "quarter" && "Últimos 3 meses"}
              {k === "all" && "Histórico"}
            </Button>
          ))}
        </div>
      </div>

      {/* Puntos del período */}
      <Card className="shadow">
        <CardContent className="p-5">
          <div className="text-sm text-neutral-500">Puntos del período</div>
          <div className="text-3xl font-semibold mt-1">{puntos}</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div>Referidos obtenidos: <b>{referidosObtenidos}</b> = {referidosObtenidos} puntos</div>
            <div>Llamadas realizadas: <b>{llamadasRealizadas}</b> = {llamadasRealizadas} puntos</div>
            <div>Citas obtenidas: <b>{citasObtenidas}</b> = {citasObtenidas * 2} puntos</div>
            <div>Cuestionarios ANF: <b>{cuestionariosANF}</b> = {cuestionariosANF * 2} puntos</div>
            <div>Entrevistas de cierre: <b>{entrevistasCierre}</b> = {entrevistasCierre * 3} puntos</div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs adicionales (en el período) */}
      <div className="grid gap-3 md:grid-cols-3">
        <StatTile title="Nuevos prospectos" value={nuevosProspectos} />
        <StatTile title="Cuestionarios ANF" value={cuestionariosANF} />
        <StatTile title="Referidos obtenidos" value={referidosObtenidos} />
      </div>

      {/* Embudo */}
      <div className="grid gap-3 md:grid-cols-5">
        <FunnelTile title="Llamadas" value={funnel.llamadas} />
        <FunnelTile title="Citas" value={funnel.citas} />
        <FunnelTile title="Citas de cierre" value={funnel.cierres} />
        <FunnelTile title="Pólizas emitidas" value={funnel.emitidas} />
        <FunnelPaid title="Pólizas pagadas" value={funnel.pagadas} />
      </div>

      {/* Tasa de cierre (al final) + Resumen */}
      <Card className="shadow">
        <CardContent className="p-5 space-y-2">
          <div className="text-sm text-neutral-500">Tasa de cierre (al final)</div>
          <div className="text-3xl font-semibold">{tasaCierre}%</div>
          <div className="text-sm text-neutral-700">
            {`${llamadasRealizadas} llamadas = ${citasObtenidas} citas = ${entrevistasCierre} entrevistas de cierre = ${funnel.emitidas} pólizas emitidas = ${funnel.pagadas} pólizas pagadas`}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FunnelTile({ title, value }: { title: string; value: number }) {
  return (
    <Card className="bg-black text-white shadow">
      <CardContent className="p-5">
        <div className="text-sm opacity-70">{title}</div>
        <div className="text-3xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function FunnelPaid({ title, value }: { title: string; value: number }) {
  // 0–1 rojo, 2–3 amarillo, 4+ verde
  const color = value <= 1 ? "bg-red-600" : value <= 3 ? "bg-yellow-500" : "bg-green-600";
  return (
    <Card className={`${color} text-white shadow`}>
      <CardContent className="p-5">
        <div className="text-sm opacity-90">{title}</div>
        <div className="text-3xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatTile({ title, value }: { title: string; value: number }) {
  return (
    <Card className="shadow">
      <CardContent className="p-5">
        <div className="text-sm text-neutral-500">{title}</div>
        <div className="text-3xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}