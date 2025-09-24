"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Client, Activity, Policy, User } from "@/lib/types";
import { repo, LS_KEYS } from "@/lib/storage";
import { getCurrentUser, filterByScope } from "@/lib/users";
// Diagnóstico Supabase
import { useSessionUser } from "@/lib/auth/useSessionUser";
import { useProfile } from "@/lib/auth/useProfile";
import { listRemoteClients } from "@/lib/data/clients";

// ======== Tipos (tablero Kanban) ========
export type ColumnKey = "new" | "quote" | "follow" | "issued";
type Card = { id: string; title: string; subtitle?: string };
type Board = Record<ColumnKey, Card[]>;

// Repos
const ClientsRepo   = repo<Client>(LS_KEYS.clients);
const PoliciesRepo  = repo<Policy>(LS_KEYS.policies);
const ActivitiesRepo= repo<Activity>(LS_KEYS.activities);

// Metadatos UI
const colMeta: Record<ColumnKey, { title: string }> = {
  new:    { title: "Nuevo prospecto" },
  quote:  { title: "Pendiente de cotización" },
  follow: { title: "En seguimiento" },
  issued: { title: "Solicitud emitida" },
};

// --------- Lógica de pipeline ---------
// Guardamos la etapa en el cliente (client.pipeline) para que el tablero y el dashboard
// puedan medir lo mismo. Si no existe, inferimos por actividad/póliza.
type PipelineStage = ColumnKey;
function inferPipeline(c: Client, acts: Activity[], pols: Policy[]): PipelineStage {
  const actsClient = acts.filter(a => a.clienteId === c.id);
  const polsClient = pols.filter(p => p.clienteId === c.id);

  // Emitida si existe póliza con fecha de ingreso o estado en proceso/vigente
  if (polsClient.some(p => p.fechaIngreso || p.estado === "Vigente" || p.estado === "En proceso")) {
    return "issued";
  }
  // Cotización si hay póliza propuesta o en proceso
  if (polsClient.some(p => p.estado === "Propuesta")) return "quote";
  // Seguimiento si hay actividades pendientes (no realizadas) a futuro
  const upcoming = actsClient.some(a => !a.realizada && new Date(a.fechaHora) >= new Date());
  if (upcoming) return "follow";
  // Default: nuevo
  return "new";
}

export default function PendingPage() {
  const me = getCurrentUser() as User;
  // Estado de diagnóstico Supabase (no altera la lógica existente de la página)
  const sess = useSessionUser();
  const { profile } = useProfile(sess?.id);
  const [remoteCount, setRemoteCount] = useState<number | null>(null);
  const [remoteErr, setRemoteErr] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rows = await listRemoteClients();
        if (mounted) setRemoteCount(rows.length);
      } catch (e: any) {
        if (mounted) setRemoteErr(e?.message || "Error consultando clients");
      }
    })();
    return () => { mounted = false; };
  }, []);
  // Tick para forzar relectura de repos tras mover/editar
  const [tick, setTick] = useState(0);
  // Cargamos datos del usuario en alcance (reactivos al tick)
  const allClients = useMemo(() => ClientsRepo.list(), [tick]);
  const allActs    = useMemo(() => ActivitiesRepo.list(), [tick]);
  const allPols    = useMemo(() => PoliciesRepo.list(), [tick]);

  const clients = useMemo(
    () => filterByScope(allClients, me, c => (c as Client).ownerId || ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me?.id, allClients, allActs, allPols]
  );
  const acts = useMemo(
    () => filterByScope(allActs, me, a => (a as Activity).ownerId || ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me?.id, allActs]
  );
  const pols = useMemo(
    () => filterByScope(allPols, me, p => (p as Policy).ownerId || ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me?.id, allPols]
  );

  // Backfill/inferir pipeline cuando falte; persistimos en localStorage
  const [drag, setDrag] = useState<{ id: string; from: ColumnKey } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const board: Board = useMemo(() => {
    const byStage: Board = { new: [], quote: [], follow: [], issued: [] };
    let changed = false;
    const updated: Client[] = [...allClients];

    for (const c of clients) {
      let stage = (c as any).pipeline as PipelineStage | undefined;
      if (!stage) {
        stage = inferPipeline(c, acts, pols);
        // persistir en copia global
        const idx = updated.findIndex(x => x.id === c.id);
        if (idx >= 0) {
          (updated[idx] as any).pipeline = stage;
          changed = true;
        }
      }
      byStage[stage!].push({
        id: c.id,
        title: `${c.nombre} ${c.apellidoPaterno ?? ""}`.trim(),
        subtitle: c.estatus ?? "Prospecto",
      });
    }
    if (changed) ClientsRepo.saveAll(updated);
    return byStage;
  }, [clients, acts, pols, allClients, tick]);

  // Drag & drop para mover etapa → actualiza client.pipeline y persiste
  const copyPhone = async (tel?: string, id?: string) => {
    if (!tel) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(tel);
      } else {
        const ta = document.createElement("textarea");
        ta.value = tel; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
      }
      if (id) { setCopied(id); setTimeout(()=> setCopied(null), 1300); }
    } catch {}
  };
  const handleDragStart = (from: ColumnKey, id: string) => (e: React.DragEvent) => {
    setDrag({ from, id });
    try {
      e.dataTransfer.setData("text/plain", id); // required for Safari/Firefox
    } catch {}
    e.dataTransfer.effectAllowed = "move";
    // Optional: small transparent drag image
    const img = new Image();
    img.src =
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJ0cmFuc3BhcmVudCIvPjwvc3ZnPg==";
    try { e.dataTransfer.setDragImage(img, 5, 5); } catch {}
  };
  const handleDrop = (to: ColumnKey) => (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = ((): string | null => {
      try { return e.dataTransfer.getData("text/plain"); } catch { return null; }
    })() || drag?.id || null;

    if (!draggedId) { setDrag(null); return; }
    if (drag?.from === to) { setDrag(null); return; }

    const list = ClientsRepo.list();
    const idx = list.findIndex(c => c.id === draggedId);
    if (idx >= 0) {
      (list[idx] as any).pipeline = to;
      ClientsRepo.saveAll(list);
      setTick(t => t + 1);
    }
    setDrag(null);
  };

  const updateStage = (id: string, to: ColumnKey) => {
    const list = ClientsRepo.list();
    const idx = list.findIndex(c => c.id === id);
    if (idx >= 0) {
      (list[idx] as any).pipeline = to;
      ClientsRepo.saveAll(list);
      setTick(t => t + 1);
    }
    setMenuFor(null);
  };

  // Crear prospecto rápido (se guarda con owner y etapa "new")
  const onQuickAdd = () => {
    const title = prompt("Nombre del prospecto");
    if (!title) return;
    const [nombre, ...rest] = title.split(" ");
    const nuevo: Client = {
      id: Math.random().toString(36).slice(2,10),
      nombre,
      apellidoPaterno: rest.join(" ") || undefined,
      estatus: "Prospecto",
      createdAt: new Date().toISOString(),
      ownerId: me?.id,
    } as Client & { pipeline: PipelineStage };
    (nuevo as any).pipeline = "new";
    const list = ClientsRepo.list();
    ClientsRepo.saveAll([nuevo, ...list]);
    setTick(t => t + 1);
  };

  const Column = ({ col }: { col: ColumnKey }) => {
    // Conditional Tailwind classes based on col
    let bgBorderClass = "";
    let headerBgClass = "";
    if (col === "issued") {
      bgBorderClass = "bg-green-50 border-green-200";
      headerBgClass = "bg-green-100";
    } else if (col === "quote") {
      bgBorderClass = "bg-yellow-50 border-yellow-200";
      headerBgClass = "bg-yellow-100";
    } else if (col === "follow") {
      bgBorderClass = "bg-blue-50 border-blue-200";
      headerBgClass = "bg-blue-100";
    } else if (col === "new") {
      bgBorderClass = "bg-neutral-50 border-neutral-200";
      headerBgClass = "bg-neutral-100";
    }
    return (
      <div
        className={`flex flex-col rounded-xl shadow-sm min-h-[420px] ${bgBorderClass}`}
        onDragOver={(e) => { e.preventDefault(); try { (e as any).dataTransfer.dropEffect = "move"; } catch {} }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(col)(e); }}
      >
      <div className={`flex items-center justify-between px-4 py-3 ${headerBgClass} border-b border-neutral-200 rounded-t-xl`}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-block w-2 h-2 rounded-full bg-neutral-500"></span>
          {colMeta[col].title}
          <span className="ml-2 text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
            {board[col].length}
          </span>
        </div>
        {col === "new" && (
          <button className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200" onClick={onQuickAdd}>
            + Nuevo prospecto
          </button>
        )}
      </div>

      <div className="p-3 space-y-2" onClick={() => setMenuFor(null)}>
        {board[col].map((c) => {
          const clientData = clients.find(client => client.id === c.id);
          return (
            <div
              key={c.id}
              className="relative group flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50"
              title={c.subtitle}
              draggable={true}
              onDragStart={handleDragStart(col, c.id)}
              onDragEnd={() => setDrag(null)}
              onClick={(e) => { e.stopPropagation(); }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="mr-2 text-neutral-400 select-none"
                  title="Arrastra el nombre para mover"
                >
                  ⋮⋮
                </span>
                <div className="flex flex-col">
                  <span
                    className="text-sm font-medium cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={handleDragStart(col, c.id)}
                    onDragEnd={() => setDrag(null)}
                    onClick={(e) => e.stopPropagation()}
                    title="Arrastra para cambiar de etapa"
                  >
                    {c.title}
                  </span>
                  {c.subtitle && (
                    <span className="text-[11px] text-neutral-500">{c.subtitle}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {clientData?.telefono ? (
                  <button
                    type="button"
                    onClick={() => copyPhone(clientData.telefono, c.id)}
                    className="text-[11px] px-2 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700"
                    title="Copiar teléfono al portapapeles"
                  >
                    {copied === c.id ? "Copiado" : clientData.telefono}
                  </button>
                ) : (
                  <span className="opacity-0 group-hover:opacity-100 transition text-[11px] text-neutral-500">Arrastra el nombre para cambiar de etapa</span>
                )}
                <button
                  type="button"
                  className="text-neutral-400 hover:text-neutral-700 px-1 py-0.5 rounded"
                  title="Cambiar etapa…"
                  onClick={(e) => { e.stopPropagation(); setMenuFor(c.id); }}
                >
                  ⋯
                </button>
              </div>
              {menuFor === c.id && (
                <div className="absolute right-2 top-2 z-20 w-56 rounded-md border border-neutral-200 bg-white shadow-md p-1">
                  {(["new","quote","follow","issued"] as ColumnKey[]).map(k => (
                    <button
                      key={k}
                      className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-neutral-100 ${k === (col as ColumnKey) ? "font-semibold" : ""}`}
                      onClick={(e) => { e.stopPropagation(); updateStage(c.id, k); }}
                    >
                      {colMeta[k].title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Panel de diagnóstico de sesión/perfil/acceso a Supabase */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
        <div className="flex flex-wrap gap-3">
          <div>
            <span className="font-semibold">Sesión:</span>
            <span className="ml-1">{sess ? `${sess.id.slice(0,8)}…` : "no iniciada"}</span>
          </div>
          <div>
            <span className="font-semibold">Perfil:</span>
            <span className="ml-1">{profile ? `${profile.role.toUpperCase()} (${profile.name ?? "sin nombre"})` : "cargando / no disponible"}</span>
          </div>
          <div>
            <span className="font-semibold">Clientes remotos:</span>
            <span className="ml-1">{remoteErr ? `error: ${remoteErr}` : (remoteCount ?? "…")}</span>
          </div>
          <div>
            <span className="font-semibold">Modo datos:</span>
            <span className="ml-1">Clientes locales (tablero) + Actividades/Pólizas locales</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Pendientes</h2>
        <div className="text-xs text-neutral-500">* Este tablero refleja clientes reales y su etapa del embudo.</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Column key={`new-${tick}`} col="new" />
        <Column key={`quote-${tick}`} col="quote" />
        <Column key={`follow-${tick}`} col="follow" />
        <Column key={`issued-${tick}`} col="issued" />
      </div>
      <p className="text-xs text-neutral-600">
        Arrastra para mover entre columnas. Al mover, se actualiza la etapa del cliente y el Dashboard podrá medirlo.
      </p>
    </div>
  );
}