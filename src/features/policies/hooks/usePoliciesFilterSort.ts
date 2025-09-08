import { useMemo, useState } from "react";
import type { Policy, Client } from "@/lib/types";

export type PolicySortKey = "createdAt" | "plan" | "cliente" | "prima";
export type PolicySortDir = "asc" | "desc";

export function usePoliciesFilterSort({ policies, clients }: { policies: Policy[]; clients: Client[]; }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<PolicySortKey>("createdAt");
  const [sortDir, setSortDir] = useState<PolicySortDir>("desc");

  const filtered = useMemo(() => {
    const lc = query.toLowerCase();
    const list = policies.filter((p) => {
      if (!lc) return true;
      const c = clients.find((x) => x.id === p.clienteId);
      const hay = [p.plan, p.numeroPoliza, c?.nombre, c?.apellidoPaterno, c?.apellidoMaterno]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(lc);
    });

    const sorted = [...list].sort((a, b) => {
      if (sortKey === "createdAt") {
        const A = a.createdAt || "";
        const B = b.createdAt || "";
        return sortDir === "asc" ? A.localeCompare(B) : B.localeCompare(A);
      }
      if (sortKey === "plan") return sortDir === "asc" ? a.plan.localeCompare(b.plan) : b.plan.localeCompare(a.plan);
      if (sortKey === "cliente") {
        const ca = clients.find((x) => x.id === a.clienteId)?.nombre || "";
        const cb = clients.find((x) => x.id === b.clienteId)?.nombre || "";
        return sortDir === "asc" ? ca.localeCompare(cb) : cb.localeCompare(ca);
      }
      // prima
      const pa = a.primaMensual || 0;
      const pb = b.primaMensual || 0;
      return sortDir === "asc" ? pa - pb : pb - pa;
    });
    return sorted;
  }, [query, policies, clients, sortKey, sortDir]);

  return {
    filtered,
    query,
    sortKey,
    sortDir,
    setQuery,
    setSortKey,
    setSortDir,
  };
}
