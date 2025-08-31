import { repo, LS_KEYS } from "@/lib/storage";
import { getSupabase } from "@/lib/supabaseClient";
import type { Client } from "@/lib/types";

const ClientsRepo = repo<Client>(LS_KEYS.clients) as any;

export function setContactado(id: string, value: boolean) {
  const list: Client[] = ClientsRepo.list();
  const idx = list.findIndex((c: Client) => c.id === id);
  if (idx === -1) return null;
  const c = { ...list[idx] } as Client;
  if (value) {
    c.contactado = true;
    if (!c.contactado_fecha) c.contactado_fecha = new Date().toISOString();
  } else {
    c.contactado = false;
    c.contactado_fecha = null;
  }
  list[idx] = c;
  ClientsRepo.saveAll(list);
  // Persist to Supabase if available (fire-and-forget)
  const sb = getSupabase();
  if (sb) {
    (async () => {
      try {
        const { error } = await sb
          .from("clients")
          .update({ contactado: c.contactado, contactado_fecha: c.contactado ? (c.contactado_fecha as any) : null })
          .eq("id", c.id);
        if (error) console.warn("Supabase: setContactado update error", error.message);
        else console.info("Supabase: setContactado updated", { id: c.id, contactado: c.contactado, contactado_fecha: c.contactado_fecha });
      } catch (_) {
        // ignore
      }
    })();
  }
  return c;
}
