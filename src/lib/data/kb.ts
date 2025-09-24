import type { KBSection, KBFile } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/browser';

// Map DB rows to app types. We treat storage_path as a generic URL (can be data: URL or Supabase Storage path)
function sectionFromDB(row: any): KBSection { // eslint-disable-line @typescript-eslint/no-explicit-any
  const files: KBFile[] = Array.isArray(row.kb_files)
    ? row.kb_files.map((f: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: f.id,
        name: f.name,
        size: Number(f.size || 0),
        type: f.mime_type || 'application/octet-stream',
        dataUrl: f.storage_path || '',
        uploadedAt: f.created_at || new Date().toISOString(),
        uploadedById: f.owner_id || 'unknown',
      }))
    : [];
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    files,
    ownerId: row.owner_id || undefined,
  };
}

function sectionToDB(section: KBSection) {
  return {
    id: section.id,
    owner_id: section.ownerId ?? null,
    title: section.title,
    description: section.description ?? null,
  };
}

export async function listRemoteKBSections(): Promise<KBSection[]> {
  const sb = supabaseBrowser();
  const { data, error } = await sb
    .from('kb_sections')
    .select('id, owner_id, title, description, created_at, updated_at, kb_files:kb_files(*)')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('Supabase list KB sections error', error.message);
    return [];
  }
  return (data || []).map(sectionFromDB);
}

export async function upsertRemoteKBSection(section: KBSection): Promise<KBSection | null> {
  const sb = supabaseBrowser();
  const row = sectionToDB(section);
  const { data, error } = await sb
    .from('kb_sections')
    .upsert(row, { onConflict: 'id' })
    .select('id, owner_id, title, description, created_at, updated_at, kb_files:kb_files(*)')
    .single();
  if (error) {
    console.warn('Supabase upsert KB section error', error.message);
    return null;
  }
  return sectionFromDB(data);
}

export async function deleteRemoteKBSection(id: string): Promise<boolean> {
  const sb = supabaseBrowser();
  const { error } = await sb.from('kb_sections').delete().eq('id', id);
  if (error) {
    console.warn('Supabase delete KB section error', error.message);
    return false;
  }
  return true;
}

// Add files to a section. For now we store data URLs in storage_path (or http URL if using Storage elsewhere).
export async function addRemoteKBFiles(sectionId: string, files: KBFile[], ownerId?: string): Promise<KBFile[]> {
  const sb = supabaseBrowser();
  if (!files.length) return [];
  const rows = files.map((f) => ({
    id: f.id,
    section_id: sectionId,
    owner_id: ownerId ?? null,
    name: f.name,
    size: f.size ?? null,
    mime_type: f.type ?? null,
    storage_path: f.dataUrl || null,
  }));
  const { data, error } = await sb
    .from('kb_files')
    .insert(rows)
    .select('*');
  if (error) {
    console.warn('Supabase insert KB files error', error.message);
    return [];
  }
  return (data || []).map((f: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: f.id,
    name: f.name,
    size: Number(f.size || 0),
    type: f.mime_type || 'application/octet-stream',
    dataUrl: f.storage_path || '',
    uploadedAt: f.created_at || new Date().toISOString(),
    uploadedById: f.owner_id || 'unknown',
  }));
}

export async function deleteRemoteKBFile(fileId: string): Promise<boolean> {
  const sb = supabaseBrowser();
  const { error } = await sb.from('kb_files').delete().eq('id', fileId);
  if (error) {
    console.warn('Supabase delete KB file error', error.message);
    return false;
  }
  return true;
}
