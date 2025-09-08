import { LS_KEYS } from "./storage";
import type { User } from "./types";

// Semilla de usuarios (solo pruebas locales)
export const SEED_USERS: User[] = [
  { id: "u-prom-1", role: "promotor", name: "Antonio García", username: "prom-antonio", password: "1234" },
  { id: "u-prom-2", role: "promotor", name: "Antonio García Jr.", username: "prom-antoniojr", password: "1234" },
  { id: "u-ger-1", role: "gerente", name: "Pilar García", username: "ger-pilar", password: "1234", promoterId: "u-prom-1" },
  { id: "u-ger-2", role: "gerente", name: "Jairon Galicia", username: "ger-jairon", password: "1234", promoterId: "u-prom-1" },
  { id: "u-ase-1", role: "asesor", name: "Asesor Juan", username: "ase-juan", password: "1234", managerId: "u-ger-1", promoterId: "u-prom-1" },
  { id: "u-ase-2", role: "asesor", name: "Asesor Ana", username: "ase-ana", password: "1234", managerId: "u-ger-1", promoterId: "u-prom-1" },
  { id: "u-ase-3", role: "asesor", name: "Asesor Luis", username: "ase-luis", password: "1234", managerId: "u-ger-2", promoterId: "u-prom-1" },
];

// ------- Persistencia local (localStorage) -------
export function getUsers(): User[] {
  if (typeof window === "undefined") return SEED_USERS;
  try {
    const raw = localStorage.getItem(LS_KEYS.users);
    if (!raw) {
      localStorage.setItem(LS_KEYS.users, JSON.stringify(SEED_USERS));
      return SEED_USERS;
    }
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Narrow each element to a partial User shape; fill required fields if missing
      return parsed.map((u): User => {
        const base: Partial<User> = typeof u === "object" && u !== null ? (u as Record<string, unknown>) : {};
        return {
          id: String(base.id || crypto.randomUUID()),
            role: (base.role === "promotor" || base.role === "gerente" || base.role === "asesor") ? base.role : "asesor",
          name: typeof base.name === "string" ? base.name : "Usuario",
          username: typeof base.username === "string" ? base.username : "user" + Math.random().toString(36).slice(2,6),
          password: typeof base.password === "string" ? base.password : "1234",
          startDate: typeof base.startDate === "string" ? base.startDate : undefined,
          managerId: typeof base.managerId === "string" ? base.managerId : undefined,
          promoterId: typeof base.promoterId === "string" ? base.promoterId : undefined,
        };
      });
    }
    return SEED_USERS;
  } catch {
    return SEED_USERS;
  }
}

export function saveUsers(users: User[]) {
  if (typeof window !== "undefined") localStorage.setItem(LS_KEYS.users, JSON.stringify(users));
}

export function getCurrentUser(): User | null {
  if (typeof window !== "undefined") {
    const id = localStorage.getItem(LS_KEYS.currentUser);
    if (id) {
      const u = getUsers().find(x => x.id === id);
      if (u) return u;
    }
  }
  return null;
}

export function setCurrentUser(id: string) {
  if (typeof window !== "undefined") localStorage.setItem(LS_KEYS.currentUser, id);
}

// ------- Alcance visible por jerarquía -------
export function visibleOwnerIdsFor(user: User): string[] {
  const USERS = getUsers();
  if (user.role === "promotor") {
    return USERS.filter(u => u.promoterId === user.id || u.id === user.id).map(u => u.id);
  }
  if (user.role === "gerente") {
    return USERS.filter(u => u.id === user.id || u.managerId === user.id).map(u => u.id);
  }
  return [user.id];
}

// Filtra registros por ownerId visible para el usuario actual
export function filterByScope<T>(
  rows: T[],
  user: User | null,
  getOwnerId: (row: T) => string | undefined
): T[] {
  if (!user) return [];
  const allowed = new Set(visibleOwnerIdsFor(user));
  return rows.filter(r => {
    const o = getOwnerId(r);
    return typeof o === "string" && allowed.has(o);
  });
}