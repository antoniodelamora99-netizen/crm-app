"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Client, Activity, Policy } from "@/lib/types";
import { uid } from "@/lib/types";
import { useClients } from "@/features/clients/hooks/useClients";
import { useActivities } from "@/features/activities/hooks/useActivities";
import { usePolicies } from "@/features/policies/hooks/usePolicies";
import { useSessionUser } from "@/lib/auth/useSessionUser";

// ======== Tipos (tablero Kanban) ========
export type ColumnKey = "new" | "quote" | "follow" | "issued";
type Card = { id: string; title: string; subtitle?: string };
type Board = Record<ColumnKey, Card[]>;

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
  const sessionUser = useSessionUser();
  const {
    clients,
    loading: loadingClients,
    upsert: upsertClient,
  } = useClients();
  const {
    activities,
    loading: loadingActivities,
  } = useActivities();
  const {
    policies,
    loading: loadingPolicies,
  } = usePolicies();

  const [drag, setDrag] = useState<{ id: string; from: ColumnKey } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const loading = loadingClients || loadingActivities || loadingPolicies;

  useEffect(() => {
    if (!clients.length) return;
    // Autocompleta pipeline para clientes sin etapa persistida
    const missing = clients.filter((c) => !c.pipeline);
    if (missing.length === 0) return;
    missing.forEach((client) => {
      const stage = inferPipeline(client, activities, policies);
      void upsertClient({ ...client, pipeline: stage });
    });
  }, [clients, activities, policies, upsertClient]);

  const board: Board = useMemo(() => {
    const byStage: Board = { new: [], quote: [], follow: [], issued: [] };
    for (const c of clients) {
      const stage = (c.pipeline as PipelineStage | undefined) ?? inferPipeline(c, activities, policies);
      byStage[stage].push({
        id: c.id,
        title: `${c.nombre} ${c.apellidoPaterno ?? ""}`.trim(),
        subtitle: c.estatus ?? "Prospecto",
      });
    }
    return byStage;
  }, [clients, activities, policies]);

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

    const target = clients.find((c) => c.id === draggedId);
    if (target) {
      void upsertClient({ ...target, pipeline: to });
    }
    setDrag(null);
  };

  const updateStage = (id: string, to: ColumnKey) => {
    const target = clients.find((c) => c.id === id);
    if (target) {
      void upsertClient({ ...target, pipeline: to });
    }
    setMenuFor(null);
  };

  // Crear prospecto rápido (se guarda con owner y etapa "new")
  const onQuickAdd = () => {
    const title = prompt("Nombre del prospecto");
    if (!title) return;
    const [nombre, ...rest] = title.split(" ");
    if (!sessionUser?.id) return;
    const nuevo: Client = {
      id: uid(),
      nombre,
      apellidoPaterno: rest.join(" ") || undefined,
      estatus: "Prospecto",
      createdAt: new Date().toISOString(),
      ownerId: sessionUser.id,
      pipeline: "new",
    } as Client & { pipeline: PipelineStage };
    void upsertClient(nuevo);
  };

  const Column = ({ col }: { col: ColumnKey }) => {
    const columnCards = board[col];
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
            {columnCards.length}
          </span>
        </div>
        {col === "new" && (
          <button className="text-xs px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200" onClick={onQuickAdd}>
            + Nuevo prospecto
          </button>
        )}
      </div>

      <div className="p-3 space-y-2" onClick={() => setMenuFor(null)}>
        {columnCards.map((card) => {
          const clientData = clients.find((client) => client.id === card.id);
          return (
            <div
              key={card.id}
              className="relative group flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50"
              title={card.subtitle}
              draggable={true}
              onDragStart={handleDragStart(col, card.id)}
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
                    onDragStart={handleDragStart(col, card.id)}
                    onDragEnd={() => setDrag(null)}
                    onClick={(e) => e.stopPropagation()}
                    title="Arrastra para cambiar de etapa"
                  >
                    {card.title}
                  </span>
                  {card.subtitle && (
                    <span className="text-[11px] text-neutral-500">{card.subtitle}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {clientData?.telefono ? (
                  <button
                    type="button"
                    onClick={() => copyPhone(clientData.telefono, card.id)}
                    className="text-[11px] px-2 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700"
                    title="Copiar teléfono al portapapeles"
                  >
                    {copied === card.id ? "Copiado" : clientData.telefono}
                  </button>
                ) : (
                  <span className="opacity-0 group-hover:opacity-100 transition text-[11px] text-neutral-500">Arrastra el nombre para cambiar de etapa</span>
                )}
                <button
                  type="button"
                  className="text-neutral-400 hover:text-neutral-700 px-1 py-0.5 rounded"
                  title="Cambiar etapa…"
                  onClick={(e) => { e.stopPropagation(); setMenuFor(card.id); }}
                >
                  ⋯
                </button>
              </div>
              {menuFor === card.id && (
                <div className="absolute right-2 top-2 z-20 w-56 rounded-md border border-neutral-200 bg-white shadow-md p-1">
                  {(["new","quote","follow","issued"] as ColumnKey[]).map(k => (
                    <button
                      key={k}
                      className={`w-full text-left text-xs px-2 py-1 rounded hover:bg-neutral-100 ${k === (col as ColumnKey) ? "font-semibold" : ""}`}
                      onClick={(e) => { e.stopPropagation(); updateStage(card.id, k); }}
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
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Pendientes</h2>
        {loading ? <span className="text-xs text-neutral-500">Cargando datos…</span> : <span className="text-xs text-neutral-500">Arrastra entre columnas para actualizar el pipeline.</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Column col="new" />
        <Column col="quote" />
        <Column col="follow" />
        <Column col="issued" />
      </div>
      <p className="text-xs text-neutral-600">
        Arrastra para mover entre columnas. Al mover, se actualiza la etapa del cliente y el Dashboard podrá medirlo.
      </p>
    </div>
  );
}
