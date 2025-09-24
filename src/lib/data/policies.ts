import type { Policy } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/browser';

type DbParticipa = {
  participa_mdrt?: boolean | null;
  participa_convencion?: boolean | null;
  participa_reconocimiento?: boolean | null;
};

export function policyToDB(p: Policy) {
  const participa: DbParticipa = {
    participa_mdrt: p.participa?.mdrt ?? null,
    participa_convencion: p.participa?.convencion ?? null,
    participa_reconocimiento: p.participa?.reconocimiento ?? null,
  };
  return {
    id: p.id,
    owner_id: p.ownerId ?? null,
    cliente_id: p.clienteId,
    plan: p.plan,
    numero_poliza: p.numeroPoliza ?? null,
    estado: p.estado,
    suma_asegurada: p.sumaAsegurada ?? null,
    prima_mensual: p.primaMensual ?? null,
    fecha_ingreso: p.fechaIngreso ?? null,
    fecha_examen_medico: p.fechaExamenMedico ?? null,
    forma_pago: p.formaPago ?? null,
    fecha_pago: p.fechaPago ?? null,
    fecha_entrega: p.fechaEntrega ?? null,
    comision_estimada: p.comisionEstimada ?? null,
    necesidades_futuras: p.necesidadesFuturas ?? null,
    proximo_seguimiento: p.proximoSeguimiento ?? null,
    pdf_url: p.pdfUrl ?? null,
    moneda: p.moneda ?? null,
    msi: p.msi ?? null,
    created_at: p.createdAt ?? new Date().toISOString(),
    ...participa,
  };
}

export function policyFromDB(row: any): Policy { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: row.id,
    ownerId: row.owner_id || undefined,
    clienteId: row.cliente_id,
    plan: row.plan,
    numeroPoliza: row.numero_poliza || undefined,
    estado: row.estado,
    sumaAsegurada: row.suma_asegurada || undefined,
    primaMensual: row.prima_mensual || undefined,
    fechaIngreso: row.fecha_ingreso || undefined,
    fechaExamenMedico: row.fecha_examen_medico || undefined,
    formaPago: row.forma_pago || undefined,
    fechaPago: row.fecha_pago || undefined,
    fechaEntrega: row.fecha_entrega || undefined,
    comisionEstimada: row.comision_estimada || undefined,
    necesidadesFuturas: row.necesidades_futuras || undefined,
    proximoSeguimiento: row.proximo_seguimiento || undefined,
    pdfUrl: row.pdf_url || undefined,
    moneda: row.moneda || undefined,
    msi: row.msi ?? undefined,
    participa: {
      mdrt: row.participa_mdrt ?? undefined,
      convencion: row.participa_convencion ?? undefined,
      reconocimiento: row.participa_reconocimiento ?? undefined,
    },
    createdAt: row.created_at || undefined,
  } as Policy;
}

export async function listRemotePolicies(): Promise<Policy[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from('policies')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('Supabase list policies error', error.message);
    return [];
  }
  return (data || []).map(policyFromDB);
}

export async function upsertRemotePolicy(policy: Policy): Promise<Policy | null> {
  const sb = supabaseBrowser();
  const row = policyToDB(policy);
  const { data, error } = await sb
    .from('policies')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) {
    console.warn('Supabase upsert policy error', error.message);
    return null;
  }
  return policyFromDB(data);
}

export async function deleteRemotePolicy(id: string): Promise<boolean> {
  const sb = supabaseBrowser();
  const { error } = await sb.from('policies').delete().eq('id', id);
  if (error) {
    console.warn('Supabase delete policy error', error.message);
    return false;
  }
  return true;
}
