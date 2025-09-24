import type { Activity } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function activityToDB(a: Activity) {
  return {
    id: a.id,
    owner_id: a.ownerId ?? null,
    cliente_id: a.clienteId ?? null,
    tipo: a.tipo,
    fecha_hora: a.fechaHora,
    fecha_hora_fin: a.fechaHoraFin ?? null,
    lugar: a.lugar ?? null,
    notas: a.notas ?? null,
    realizada: a.realizada ?? null,
    genero_cierre: a.generoCierre ?? null,
    obtuvo_referidos: a.obtuvoReferidos ?? null,
    reagendada: a.reagendada ?? null,
    color: a.color ?? null,
    created_at: a.createdAt ?? new Date().toISOString(),
  };
}

export function activityFromDB(row: any): Activity { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: row.id,
    ownerId: row.owner_id || undefined,
    clienteId: row.cliente_id || '',
    tipo: row.tipo,
    fechaHora: row.fecha_hora,
    fechaHoraFin: row.fecha_hora_fin || undefined,
    lugar: row.lugar || undefined,
    notas: row.notas || undefined,
    realizada: row.realizada ?? undefined,
    generoCierre: row.genero_cierre ?? undefined,
    obtuvoReferidos: row.obtuvo_referidos ?? undefined,
    reagendada: row.reagendada ?? undefined,
    color: row.color || undefined,
    createdAt: row.created_at || undefined,
  };
}

export async function listRemoteActivities(): Promise<Activity[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from('activities')
    .select('*')
    .order('fecha_hora', { ascending: false });
  if (error) {
    console.warn('Supabase list activities error', error.message);
    return [];
  }
  return (data ?? []).map(activityFromDB);
}

export async function upsertRemoteActivity(activity: Activity): Promise<Activity | null> {
  const sb = supabaseBrowser();
  const row = activityToDB(activity);
  const { data, error } = await sb
    .from('activities')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) {
    console.warn('Supabase upsert activity error', error.message);
    return null;
  }
  return activityFromDB(data);
}

export async function deleteRemoteActivity(id: string): Promise<boolean> {
  const sb = supabaseBrowser();
  const { error } = await sb.from('activities').delete().eq('id', id);
  if (error) {
    console.warn('Supabase delete activity error', error.message);
    return false;
  }
  return true;
}
