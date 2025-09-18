import { supabaseBrowser } from '@/lib/supabase/browser'

export type ProfileRow = {
  id: string
  email: string | null
  name: string | null // from display_name
  role: 'asesor' | 'gerente' | 'promotor' | 'admin'
  manager_id: string | null
  promoter_id: string | null
  created_at: string | null
}

export async function listProfiles(): Promise<ProfileRow[]> {
  const sb = supabaseBrowser()
  const { data, error } = await sb
    .from('profiles')
  .select('id,email,name:display_name,role,manager_id,promoter_id,created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProfileRow[]
}
