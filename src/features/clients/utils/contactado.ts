import { repo, LS_KEYS } from "@/lib/storage";
import type { Client } from "@/lib/types";

const ClientsRepo = repo<Client>(LS_KEYS.clients) as any;

export function setContactado(id: string, value: boolean) {
  const list: Client[] = ClientsRepo.list();
  const idx = list.findIndex((c: Client) => c.id === id);
  if (idx === -1) return null;
  const c = { ...list[idx] } as Client;
  if (value) {
    c.contactado = true;
    if (!c.contactadoAt) c.contactadoAt = new Date().toISOString();
  } else {
    c.contactado = false;
    c.contactadoAt = undefined;
  }
  list[idx] = c;
  ClientsRepo.saveAll(list);
  return c;
}
