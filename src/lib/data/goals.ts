import type { Goal } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function goalToDB(goal: Goal & { ownerId?: string }) {
  return {
    id: goal.id,
    owner_id: goal.ownerId ?? null,
    tipo: goal.tipo,
    mes: goal.mes,
    meta_mensual: goal.metaMensual ?? null,
    meta_anual: goal.metaAnual ?? null,
    created_at: goal.createdAt ?? new Date().toISOString(),
  };
}

export function goalFromDB(row: any): Goal { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: row.id,
    ownerId: row.owner_id || undefined,
    tipo: row.tipo,
    mes: row.mes,
    metaMensual: row.meta_mensual ?? undefined,
    metaAnual: row.meta_anual ?? undefined,
    createdAt: row.created_at || undefined,
  };
}

export async function listRemoteGoals(): Promise<Goal[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from('goals')
    .select('*')
    .order('mes', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('Supabase list goals error', error.message);
    return [];
  }
  return (data ?? []).map(goalFromDB);
}

export async function upsertRemoteGoal(goal: Goal & { ownerId?: string }): Promise<Goal | null> {
  const sb = supabaseBrowser();
  const row = goalToDB(goal);
  const { data, error } = await sb
    .from('goals')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) {
    console.warn('Supabase upsert goal error', error.message);
    return null;
  }
  return goalFromDB(data);
}

export async function deleteRemoteGoal(id: string): Promise<boolean> {
  const sb = supabaseBrowser();
  const { error } = await sb.from('goals').delete().eq('id', id);
  if (error) {
    console.warn('Supabase delete goal error', error.message);
    return false;
  }
  return true;
}
