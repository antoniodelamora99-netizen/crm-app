// API helpers (mock) para el dashboard y otros módulos
// Tipado alineado con los roles y entidades del proyecto

import type { UserRole } from "@/lib/types";
import { getCurrentUser } from "@/lib/users";

// ===== Tipos =====
export type DashboardMetrics = {
  prospectos: number;      // nuevos prospectos
  llamadas: number;        // llamadas realizadas
  citas: number;           // citas obtenidas
  cierres: number;         // entrevistas de cierre realizadas
  polizasEmitidas: number; // pólizas emitidas
  polizasPagadas: number;  // pólizas pagadas
  referidosObtenidos?: number;      // NUEVO: referidos del periodo
  cuestionariosRealizados?: number; // NUEVO: ANF realizados
  puntos: number;          // puntaje según reglas
};

export type RecentActivity = {
  id: string;
  description: string;
  at: string; // ISO date
};

// ===== API simulada =====
export async function fetchUserRole(): Promise<UserRole> {
  // Si estamos en el browser, tomamos el rol del usuario actual guardado en localStorage
  try {
    if (typeof window !== "undefined") {
      const me = getCurrentUser();
      if (me?.role) return me.role;
    }
  } catch {
    // ignore
  }
  // Valor por defecto (antes devolvía 'admin', que no existe en el sistema)
  return "asesor";
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  // Simulación de una llamada a API con datos consistentes con el CRM
  const prospectos = 12;
  const llamadas = 34;
  const citas = 18; // citas obtenidas
  const cierres = 6; // entrevistas de cierre realizadas
  const polizasEmitidas = 4;
  const polizasPagadas = 2;
  const referidosObtenidos = 5; // ejemplo
  const cuestionariosRealizados = 3; // ANF realizados (no confundir con cuestionario médico)

  const puntos =
    (referidosObtenidos ?? 0) * 1 +
    llamadas * 1 +
    citas * 2 +
    (cuestionariosRealizados ?? 0) * 2 +
    cierres * 3;

  return {
    prospectos,
    llamadas,
    citas,
    cierres,
    polizasEmitidas,
    polizasPagadas,
    referidosObtenidos,
    cuestionariosRealizados,
    puntos,
  };
}

export async function fetchRecentActivities(): Promise<RecentActivity[]> {
  // Simulación de actividades recientes
  const now = new Date();
  return [
    { id: "a1", description: "Llamada registrada a prospecto", at: new Date(now.getTime() - 60 * 60 * 1000).toISOString() },
    { id: "a2", description: "Cita creada para mañana", at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() },
    { id: "a3", description: "Póliza emitida", at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() },
  ];
}
