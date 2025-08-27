// src/lib/repos.ts
import { repo, LS_KEYS } from "./storage";
import type {
  Client,
  Policy,
  Activity,
  Goal,
  MedicalForm,
  KBSection,
} from "./types";

// Repos tipados sobre localStorage
export const ClientsRepo     = repo<Client>(LS_KEYS.clients);
export const PoliciesRepo    = repo<Policy>(LS_KEYS.policies);
export const ActivitiesRepo  = repo<Activity>(LS_KEYS.activities);
export const GoalsRepo       = repo<Goal>(LS_KEYS.goals);
export const MedicalRepo     = repo<MedicalForm>(LS_KEYS.medical);
export const KBRepo          = repo<KBSection>(LS_KEYS.kb);

// (Opcional) re-export del tipo Repo si te sirve
export type { Repo } from "./storage";