// src/lib/storage.ts
export type Repo<T> = { list: () => T[]; saveAll: (rows: T[]) => void };

export const LS_KEYS = {
  clients: "crm_clients",
  policies: "crm_policies",
  activities: "crm_activities",
  goals: "crm_goals",
  medical: "crm_medical",
  kb: "crm_kb_sections",
  users: "crm_users",
  currentUser: "crm_current_user_id",
};

export function repo<T>(key: string): Repo<T> {
  const memory: T[] = [];
  const isBrowser = typeof window !== "undefined" && typeof localStorage !== "undefined";
  return {
    list: () => {
      if (!isBrowser) return memory;
      try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
    },
    saveAll: (rows: T[]) => {
      if (!isBrowser) { memory.length = 0; memory.push(...rows); return; }
      localStorage.setItem(key, JSON.stringify(rows));
    },
  };
}