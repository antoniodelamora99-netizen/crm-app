"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSessionUser } from "@/lib/auth/useSessionUser";
import { useDashboardMetrics, type RangeKey } from "@/features/dashboard/hooks/useDashboardMetrics";

export default function DashboardPage() {
  const session = useSessionUser();
  const [range, setRange] = useState<RangeKey>("month");
  const { loading, error, snapshot, progreso, DAILY_TARGET } = useDashboardMetrics(range);

  if (!session) {
    return <div className="p-6 text-sm text-neutral-500">Inicia sesión para ver tu dashboard.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Tab label="Esta semana" active={range === "week"} onClick={() => setRange("week")} />
          <Tab label="Este mes" active={range === "month"} onClick={() => setRange("month")} />
          <Tab label="Últimos 3 meses" active={range === "q3"} onClick={() => setRange("q3")} />
          <Tab label="Histórico" active={range === "all"} onClick={() => setRange("all")} />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Ocurrió un error al calcular tus métricas: {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <StatCard loading={loading} title="Nuevos prospectos" value={snapshot.prospectosNuevos} />
        <StatCard loading={loading} title="Llamadas realizadas" value={snapshot.llamadasRealizadas} />
        <StatCard loading={loading} title="Citas agendadas" value={snapshot.citasAgendadas} />
        <StatCard loading={loading} title="Pólizas ingresadas" value={snapshot.polizasIngresadas} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm text-slate-600">Termómetro diario</div>
          <div className="text-sm font-semibold text-slate-900">
            {snapshot.puntosDelDia} / {DAILY_TARGET} pts
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

function StatCard({ loading, title, value }: { loading: boolean; title: string; value: number | string }) {
  return (
    <Card className="shadow">
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="mt-1 text-3xl font-semibold">
          {loading ? <span className="text-base text-neutral-400">…</span> : value}
        </div>
      </CardContent>
    </Card>
  );
}
