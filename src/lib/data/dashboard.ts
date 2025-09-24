import type { Activity, Client, Policy } from '@/lib/types';

export type DashboardSnapshot = {
  prospectosNuevos: number;
  llamadasRealizadas: number;
  citasAgendadas: number;
  polizasIngresadas: number;
  puntosDelDia: number;
};

export function calculateDashboardSnapshot(
  clients: Client[],
  policies: Policy[],
  activities: Activity[],
  range: { from: Date; to: Date },
  today: { start: Date; end: Date },
): DashboardSnapshot {
  const { from, to } = range;

  const inRange = (iso?: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    return d >= from && d <= to;
  };

  const inToday = (iso?: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    return d >= today.start && d <= today.end;
  };

  const prospectosNuevos = clients.filter((c) => inRange(c.createdAt)).length;

  const llamadasRealizadas = activities.filter(
    (a) => a.tipo === 'Llamada' && a.realizada && inRange(a.fechaHora)
  ).length;

  const citasAgendadas = activities.filter(
    (a) =>
      (a.tipo === 'Cita Inicial' || a.tipo === 'Cita Cierre') &&
      inRange(a.fechaHora)
  ).length;

  const polizasIngresadas = policies.filter((p) => inRange(p.fechaIngreso)).length;

  const ACTIVITY_POINTS: Record<Activity['tipo'], number> = {
    Llamada: 1,
    'Cita Inicial': 3,
    'Cita Cierre': 5,
    Entrega: 8,
    Seguimiento: 1,
  };

  const puntosDelDia = activities
    .filter((a) => a.realizada && inToday(a.fechaHora))
    .reduce((sum, a) => sum + (ACTIVITY_POINTS[a.tipo] ?? 0), 0);

  return {
    prospectosNuevos,
    llamadasRealizadas,
    citasAgendadas,
    polizasIngresadas,
    puntosDelDia,
  };
}
