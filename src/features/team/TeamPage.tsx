"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { getUsers } from "@/lib/users";
import { useSessionUser } from "@/lib/auth/useSessionUser";
import { useProfile } from "@/lib/auth/useProfile";
import { repo, LS_KEYS } from "@/lib/storage";
import type { Activity, Policy } from "@/lib/types";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subDays,
  subMonths,
  subYears,
  startOfDay,
  endOfDay,
  isWithinInterval,
  parseISO,
} from "date-fns";

const ActivitiesRepo = repo<Activity>(LS_KEYS.activities);
const PoliciesRepo   = repo<Policy>(LS_KEYS.policies);

const filters = [
  'Esta semana',
  'Semana pasada',
  'Últimos 30 días',
  'Este mes',
  '6 meses',
  'Un año'
];

function getRangeFromFilter(filter: string) {
  const now = new Date();
  switch (filter) {
    case 'Esta semana': {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return { start, end };
    }
    case 'Semana pasada': {
      // last week Monday..Sunday
      const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      const start = subWeeks(thisWeekStart, 1);
      const end = subDays(thisWeekStart, 1); // Sunday of last week
      return { start, end };
    }
    case 'Últimos 30 días': {
      const start = startOfDay(subDays(now, 30));
      const end = endOfDay(now);
      return { start, end };
    }
    case 'Este mes': {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return { start, end };
    }
    case '6 meses': {
      const start = startOfDay(subMonths(now, 6));
      const end = endOfDay(now);
      return { start, end };
    }
    case 'Un año': {
      const start = startOfDay(subYears(now, 1));
      const end = endOfDay(now);
      return { start, end };
    }
    default: {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return { start, end };
    }
  }
}

function inRange(iso: string | undefined, range: { start: Date; end: Date }) {
  if (!iso) return false;
  const d = parseISO(iso);
  return isWithinInterval(d, range);
}

export default function TeamPage() {
  const session = useSessionUser();
  const { profile: me } = useProfile(session?.id);
  const USERS = getUsers();
  const allActs = ActivitiesRepo.list();
  const allPols = PoliciesRepo.list();
  const [selectedFilter, setSelectedFilter] = useState(filters[0]);

  const activeRange = useMemo(() => getRangeFromFilter(selectedFilter), [selectedFilter]);

  if (!me || me.role === "asesor") {
    return (
      <Card className="shadow">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-2">Equipo</h2>
          <p className="text-sm text-muted-foreground">
            Esta vista es para Gerentes y Promotores.
          </p>
        </CardContent>
      </Card>
    );
  }

  // asesores bajo el gerente/promotor
  const asesores = useMemo(() => {
    if (me.role === "gerente") {
      return USERS.filter(u => u.role === "asesor" && u.managerId === me.id);
    }
    // promotor: todos los asesores bajo sus gerentes/promotorId
    return USERS.filter(u => u.role === "asesor" && u.promoterId === me.id);
  }, [USERS, me]);

  const rows = asesores.map(a => {
    const acts = allActs.filter(x => x.ownerId === a.id);
    const pols = allPols.filter(x => x.ownerId === a.id);

    const llamadasPeriodo = acts.filter(x => x.tipo === "Llamada" && inRange(x.fechaHora, activeRange)).length;
    const citasPeriodo = acts.filter(x => (x.tipo === "Cita Inicial" || x.tipo === "Cita Cierre") && inRange(x.fechaHora, activeRange)).length;
    const polizasIngresadasPeriodo = pols.filter(p => inRange(p.createdAt, activeRange)).length;
    const polizasPagadasPeriodo = pols.filter(p => inRange(p.fechaPago, activeRange)).length;
    const activo = (llamadasPeriodo + citasPeriodo + polizasIngresadasPeriodo + polizasPagadasPeriodo) > 0;

    return {
      id: a.id,
      nombre: a.name,
      activo,
      llamadasSemana: llamadasPeriodo,
      citasSemana: citasPeriodo,
      polizasIngresadasSemana: polizasIngresadasPeriodo,
      polizasPagadasSemana: polizasPagadasPeriodo,
      polizasTotales: pols.length,
    };
  });

  // Estilos de los botones de filtro para imitar el sidebar
  const filterPillClasses = (active: boolean) =>
    [
      "inline-flex items-center h-9 px-3 rounded-lg border transition-colors select-none",
      "text-sm font-medium",
      // estado base (inactivo): similar a item inactivo del sidebar
      !active && "bg-muted text-foreground/80 border-transparent hover:bg-muted/80",
      // estado activo: similar al item activo del sidebar
      active && "bg-foreground text-background border-foreground",
      // accesibilidad / focus visible
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-foreground/50",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <Card className="shadow">
      <CardContent className="p-6 overflow-x-auto">
        <h1 className="text-xl font-semibold mb-6">Asesores</h1>
        <div className="mb-4 flex flex-wrap gap-2">
          {filters.map(filter => {
            const isActive = filter === selectedFilter;
            return (
              <button
                key={filter}
                type="button"
                aria-pressed={isActive}
                onClick={() => setSelectedFilter(filter)}
                className={filterPillClasses(isActive)}
              >
                {filter}
              </button>
            );
          })}
        </div>
        <table className="w-full text-sm border-separate border-spacing-y-2">
          <thead className="bg-neutral-100 text-neutral-700 rounded-lg">
            <tr>
              <th className="text-left p-4">Asesor</th>
              <th className="text-left p-4">Activo</th>
              <th className="text-right p-4">Llamadas</th>
              <th className="text-right p-4">Citas</th>
              <th className="text-right p-4">Pólizas ingresadas</th>
              <th className="text-right p-4">Pólizas pagadas</th>
              <th className="text-right p-4">Pólizas totales</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="bg-white shadow-sm rounded-lg">
                <td className="p-4">{r.nombre}</td>
                <td className="p-4">{r.activo ? "Sí" : "No"}</td>
                <td className="p-4 text-right">{r.llamadasSemana}</td>
                <td className="p-4 text-right">{r.citasSemana}</td>
                <td className="p-4 text-right">{r.polizasIngresadasSemana}</td>
                <td className="p-4 text-right">{r.polizasPagadasSemana}</td>
                <td className="p-4 text-right">{r.polizasTotales}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-sm text-muted-foreground">Sin asesores asignados.</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}