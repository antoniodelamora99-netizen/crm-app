import type { Client } from "@/lib/types";
import { supabaseBrowser } from "@/lib/supabase/browser";

// Normaliza hacia fila de BD (nullables y fechas a ISO string)
export function clientToDB(c: Client) {
  return {
    id: c.id,
    owner_id: c.ownerId ?? null,
    nombre: c.nombre,
    apellido_paterno: c.apellidoPaterno ?? null,
    apellido_materno: c.apellidoMaterno ?? null,
    telefono: c.telefono ?? null,
    email: c.email ?? null,
    fecha_nacimiento: c.fechaNacimiento ?? null,
    sexo: c.sexo ?? null,
    estado_civil: c.estadoCivil ?? null,
    estado_residencia: c.estadoResidencia ?? null,
    ocupacion: c.ocupacion ?? null,
    empresa: c.empresa ?? null,
    ingreso_hogar: c.ingresoHogar ?? null,
    dependientes: c.dependientes ?? null,
    fumador: c.fumador ?? null,
    fuente: c.fuente ?? null,
    estatus: c.estatus ?? null,
    ultimo_contacto: c.ultimoContacto ?? null,
    notas: c.notas ?? null,
    anf_realizado: c.anfRealizado ?? null,
    anf_fecha: c.anfFecha ?? null,
    created_at: c.createdAt ?? new Date().toISOString(),
    contactado: c.contactado ?? false,
    pipeline: c.pipeline ?? null,
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
    ownerId: row.owner_id || undefined,
    nombre: row.nombre,
    apellidoPaterno: row.apellido_paterno || undefined,
    apellidoMaterno: row.apellido_materno || undefined,
    telefono: row.telefono || undefined,
    email: row.email || undefined,
    fechaNacimiento: row.fecha_nacimiento || undefined,
    sexo: row.sexo || undefined,
    estadoCivil: row.estado_civil || undefined,
    estadoResidencia: row.estado_residencia || undefined,
    ocupacion: row.ocupacion || undefined,
    empresa: row.empresa || undefined,
    ingresoHogar: row.ingreso_hogar || undefined,
    dependientes: row.dependientes || undefined,
    fumador: row.fumador ?? undefined,
    fuente: row.fuente || undefined,
    estatus: row.estatus || undefined,
    ultimoContacto: row.ultimo_contacto || undefined,
    notas: row.notas || undefined,
    anfRealizado: row.anf_realizado ?? undefined,
    anfFecha: row.anf_fecha || undefined,
    createdAt: row.created_at || undefined,
    contactado: row.contactado ?? false,
    contactado_fecha: row.contactado_fecha || undefined,
    pipeline: row.pipeline || undefined,
  };
}

export async function listRemoteClients(): Promise<Client[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb.from("clients").select("*").order("created_at", { ascending: false });
  if (error) { console.warn("Supabase list clients error", error.message); return []; }
  return (data || []).map(clientFromDB);
}

export async function upsertRemoteClient(c: Client): Promise<Client | null> {
  const sb = supabaseBrowser();
  const row = clientToDB(c);
  const { data, error } = await sb.from("clients").upsert(row, { onConflict: "id" }).select("*").single();
  if (error) { console.warn("Supabase upsert client error", error.message); return null; }
  return clientFromDB(data);
}

export async function deleteRemoteClient(id: string): Promise<boolean> {
  const sb = supabaseBrowser();
  const { error } = await sb.from("clients").delete().eq("id", id);
  if (error) { console.warn("Supabase delete client error", error.message); return false; }
  return true;
}

export async function toggleRemoteContactado(c: Client, val: boolean): Promise<Client | null> {
  const sb = supabaseBrowser();
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
