import type { MedicalForm } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function medicalToDB(form: MedicalForm & { ownerId?: string }) {
  return {
    id: form.id,
    owner_id: form.ownerId ?? null,
    cliente_id: form.clienteId,
    fecha: form.fecha,
    enfermedades: form.enfermedades ?? null,
    hospitalizacion: form.hospitalizacion ?? null,
    medicamentos: form.medicamentos ?? null,
    cirugias: form.cirugias ?? null,
    antecedentes: form.antecedentes ?? null,
    otros: form.otros ?? null,
    pdf_url: form.pdfUrl ?? null,
    created_at: form.createdAt ?? new Date().toISOString(),
  };
}

export function medicalFromDB(row: any): MedicalForm { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: row.id,
    ownerId: row.owner_id || undefined,
    clienteId: row.cliente_id,
    fecha: row.fecha,
    enfermedades: row.enfermedades ?? undefined,
    hospitalizacion: row.hospitalizacion ?? undefined,
    medicamentos: row.medicamentos ?? undefined,
    cirugias: row.cirugias ?? undefined,
    antecedentes: row.antecedentes ?? undefined,
    otros: row.otros ?? undefined,
    pdfUrl: row.pdf_url ?? undefined,
    createdAt: row.created_at || undefined,
  };
}

export async function listRemoteMedicalForms(): Promise<MedicalForm[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from('medical_forms')
    .select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('Supabase list medical forms error', error.message);
    return [];
  }
  return (data ?? []).map(medicalFromDB);
}

export async function upsertRemoteMedicalForm(form: MedicalForm & { ownerId?: string }): Promise<MedicalForm | null> {
  const sb = supabaseBrowser();
  const row = medicalToDB(form);
  const { data, error } = await sb
    .from('medical_forms')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) {
    console.warn('Supabase upsert medical form error', error.message);
    return null;
  }
  return medicalFromDB(data);
}

export async function deleteRemoteMedicalForm(id: string): Promise<boolean> {
  const sb = supabaseBrowser();
  const { error } = await sb.from('medical_forms').delete().eq('id', id);
  if (error) {
    console.warn('Supabase delete medical form error', error.message);
    return false;
  }
  return true;
}
