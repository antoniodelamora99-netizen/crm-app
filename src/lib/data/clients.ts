import type { Client } from "@/lib/types";
import { getSupabase } from "@/lib/supabaseClient";

// Normaliza hacia fila de BD (nullables y fechas a ISO string)
export function clientToDB(c: Client) {
  return {
    id: c.id,
    nombre: c.nombre,
    apellidoPaterno: c.apellidoPaterno ?? null,
    apellidoMaterno: c.apellidoMaterno ?? null,
    telefono: c.telefono ?? null,
    email: c.email ?? null,
    fechaNacimiento: c.fechaNacimiento ?? null,
    sexo: c.sexo ?? null,
    estadoCivil: c.estadoCivil ?? null,
    estadoResidencia: c.estadoResidencia ?? null,
    ocupacion: c.ocupacion ?? null,
    empresa: c.empresa ?? null,
    ingresoHogar: c.ingresoHogar ?? null,
    dependientes: c.dependientes ?? null,
    fumador: c.fumador ?? null,
    fuente: c.fuente ?? null,
    estatus: c.estatus ?? null,
    referidoPorId: c.referidoPorId ?? null,
    asesor: c.asesor ?? null,
    ultimoContacto: c.ultimoContacto ?? null,
    notas: c.notas ?? null,
    anfRealizado: c.anfRealizado ?? null,
    anfFecha: c.anfFecha ?? null,
    createdAt: c.createdAt ?? new Date().toISOString(),
    ownerId: c.ownerId ?? null,
    contactado: c.contactado ?? false,
    contactado_fecha: c.contactado
      ? (c.contactado_fecha instanceof Date
          ? c.contactado_fecha.toISOString()
          : (c.contactado_fecha ? (typeof c.contactado_fecha === "string" ? c.contactado_fecha : new Date().toISOString()) : new Date().toISOString()))
      : null,
  };
}

export function clientFromDB(row: any): Client { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: row.id,
    nombre: row.nombre,
    apellidoPaterno: row.apellidoPaterno || undefined,
    apellidoMaterno: row.apellidoMaterno || undefined,
    telefono: row.telefono || undefined,
    email: row.email || undefined,
    fechaNacimiento: row.fechaNacimiento || undefined,
    sexo: row.sexo || undefined,
    estadoCivil: row.estadoCivil || undefined,
    estadoResidencia: row.estadoResidencia || undefined,
    ocupacion: row.ocupacion || undefined,
    empresa: row.empresa || undefined,
    ingresoHogar: row.ingresoHogar || undefined,
    dependientes: row.dependientes || undefined,
    fumador: row.fumador ?? undefined,
    fuente: row.fuente || undefined,
    estatus: row.estatus || undefined,
    referidoPorId: row.referidoPorId || undefined,
    asesor: row.asesor || undefined,
    ultimoContacto: row.ultimoContacto || undefined,
    notas: row.notas || undefined,
    anfRealizado: row.anfRealizado ?? undefined,
    anfFecha: row.anfFecha || undefined,
    createdAt: row.createdAt || undefined,
    ownerId: row.ownerId || undefined,
    contactado: row.contactado ?? false,
    contactado_fecha: row.contactado_fecha || undefined,
  };
}

export async function listRemoteClients(): Promise<Client[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from("clients").select("*").order("createdAt", { ascending: false });
  if (error) { console.warn("Supabase list clients error", error.message); return []; }
  return (data || []).map(clientFromDB);
}

export async function upsertRemoteClient(c: Client): Promise<Client | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const row = clientToDB(c);
  const { data, error } = await sb.from("clients").upsert(row, { onConflict: "id" }).select("*").single();
  if (error) { console.warn("Supabase upsert client error", error.message); return null; }
  return clientFromDB(data);
}

export async function deleteRemoteClient(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("clients").delete().eq("id", id);
  if (error) { console.warn("Supabase delete client error", error.message); return false; }
  return true;
}

export async function toggleRemoteContactado(c: Client, val: boolean): Promise<Client | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("clients")
    .update({
      contactado: val,
      contactado_fecha: val ? new Date().toISOString() : null,
    })
    .eq("id", c.id)
    .select("*")
    .single();
  if (error) { console.warn("Supabase toggle contactado error", error.message); return null; }
  return clientFromDB(data);
}
