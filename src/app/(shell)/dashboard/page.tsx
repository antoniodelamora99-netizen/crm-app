"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { repo, LS_KEYS } from "@/lib/storage";
import { getCurrentUser, filterByScope } from "@/lib/users";
import type { Client, Policy, Activity } from "@/lib/types";

// =====================================
// Puntos y meta (25 puntos)
// Si ya tienes estos valores en otra ruta, luego los movemos.
// =====================================
const DAILY_TARGET = 25;
const ACTIVITY_POINTS: Record<
  "Llamada" | "Cita Inicial" | "Cita Cierre" | "Entrega" | "Seguimiento",
  number
> = {
  Llamada: 1,
  "Cita Inicial": 3,
  "Cita Cierre": 5,
  Entrega: 8,
  Seguimiento: 1,
};

// =====================================
// Repos
// =====================================
const ClientsRepo = repo<Client>(LS_KEYS.clients);
const PoliciesRepo = repo<Policy>(LS_KEYS.policies);
const ActivitiesRepo = repo<Activity>(LS_KEYS.activities);

type RangeKey = "week" | "month" | "q3" | "all";

export default function DashboardPage() {
  const user = getCurrentUser();
  const [range, setRange] = useState<RangeKey>("month");
  const [error, setError] = useState<string | null>(null);
  const [rawClients, setRawClients] = useState<Client[]>([]);
  const [rawPolicies, setRawPolicies] = useState<Policy[]>([]);
  const [rawActivities, setRawActivities] = useState<Activity[]>([]);

  // Carga inicial de datos locales (defensiva, nunca lanza setState dentro del render)
  useEffect(() => {
    try { setRawClients(ClientsRepo.list()); } catch (e) { setError('Error cargando clientes'); }
    try { setRawPolicies(PoliciesRepo.list()); } catch (e) { setError('Error cargando pólizas'); }
    try { setRawActivities(ActivitiesRepo.list()); } catch (e) { setError('Error cargando actividades'); }
  }, []);

  const now = new Date();

  // Rango de fechas para KPIs
  const { dateFrom, dateTo } = useMemo(() => {
    if (range === "week") {
      const dFrom = new Date(now);
      dFrom.setDate(now.getDate() - 7);
      const dTo = new Date(now);
      return { dateFrom: dFrom, dateTo: dTo };
    }
    if (range === "q3") {
      const dFrom = new Date(now);
      dFrom.setDate(now.getDate() - 90);
      return { dateFrom: dFrom, dateTo: now };
    }
    if (range === "month") {
      const dFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      const dTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { dateFrom: dFrom, dateTo: dTo };
    }
    return { dateFrom: new Date(2000, 0, 1), dateTo: now };
  }, [range, now]);

  const clients = useMemo(() => user ? filterByScope(rawClients, user, (r) => r.ownerId) : rawClients, [rawClients, user]);
  const policies = useMemo(() => user ? filterByScope(rawPolicies, user, (r) => r.ownerId) : rawPolicies, [rawPolicies, user]);
  const activities = useMemo(() => {
    const base = user ? filterByScope(rawActivities, user, (r) => r.ownerId) : rawActivities;
    return base.filter(a => a && typeof a === 'object' && typeof (a as Activity).tipo === 'string');
  }, [rawActivities, user]);

  const inRange = (iso?: string) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d >= dateFrom && d <= dateTo;
  };

  // KPIs
  const nuevosProspectos = clients.filter((c) => inRange(c.createdAt)).length;
  const llamadasRealizadas = activities.filter((a) => a.tipo === "Llamada" && a.realizada && inRange(a.fechaHora)).length;
  const citasAgendadas = activities.filter(
    (a) => (a.tipo === "Cita Inicial" || a.tipo === "Cita Cierre") && inRange(a.fechaHora)
  ).length;
  const polizasIngresadas = policies.filter((p) => inRange(p.fechaIngreso)).length;

  // Termómetro diario (siempre hoy)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const isToday = (iso?: string) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d >= startOfToday && d <= endOfToday;
  };

  const puntosDelDia = activities
    .filter((a) => a.realizada && isToday(a.fechaHora))
    .reduce((sum, a) => sum + (ACTIVITY_POINTS[(a.tipo as keyof typeof ACTIVITY_POINTS)] ?? 0), 0);

  const progreso = Math.min(1, puntosDelDia / DAILY_TARGET);

  const resetLocal = () => {
    try {
      const keys = [LS_KEYS.clients, LS_KEYS.policies, LS_KEYS.activities];
      keys.forEach(k => localStorage.removeItem(k));
      location.reload();
    } catch {}
  };

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Ocurrió un error al cargar tus métricas: {error}
          <div className="mt-2 flex gap-2">
            <Button variant="destructive" onClick={resetLocal}>Restablecer datos locales</Button>
            <Button variant="secondary" onClick={() => { setError(null); location.reload(); }}>Intentar de nuevo</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Título + Tabs de rango */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Tab label="Esta semana" active={range === "week"} onClick={() => setRange("week")} />
          <Tab label="Este mes" active={range === "month"} onClick={() => setRange("month")} />
          <Tab label="Últimos 3 meses" active={range === "q3"} onClick={() => setRange("q3")} />
          <Tab label="Histórico" active={range === "all"} onClick={() => setRange("all")} />
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <StatCard title="Nuevos prospectos" value={nuevosProspectos} />
        <StatCard title="Llamadas realizadas" value={llamadasRealizadas} />
        <StatCard title="Citas agendadas" value={citasAgendadas} />
        <StatCard title="Pólizas ingresadas" value={polizasIngresadas} />
      </div>

      {/* Termómetro 25 puntos */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm text-slate-600">Termómetro diario</div>
          <div className="text-sm font-semibold text-slate-900">
            {puntosDelDia} / {DAILY_TARGET} pts
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-slate-100">
          <div
            className="h-3 rounded-full bg-indigo-600 transition-all"
            style={{ width: `${progreso * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <Button
      variant={active ? "default" : "secondary"}
      onClick={onClick}
      className={active ? "" : "bg-slate-100 text-slate-700"}
    >
      {label}
    </Button>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card className="shadow">
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="mt-1 text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
