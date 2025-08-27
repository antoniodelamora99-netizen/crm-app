"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";

// Carga perezosa de las herramientas. Si aún no existen los archivos reales,
// mostramos un fallback elegante sin romper la app.
const BasicQuote = dynamic(
  async () => {
    try {
      const m = await import("@/features/tools/basic-quote/BasicQuote");
      // Maneja varias formas de exportación posibles
      const comp = m.default || (m as any).BasicQuote || (m as any).BasicQuotePage || (m as any).default;
      return { default: comp };
    } catch (err) {
      return { default: function BasicQuoteFallback() { return <Fallback label="Cotizador b\u00e1sico" />; } };
    }
  },
  { ssr: false }
);

const PlanComparer = dynamic(
  async () => {
    try {
      const m = await import("@/features/tools/PlanCompare");
      return { default: m.default || (m as any).PlanCompare };
    } catch {
      return { default: function PlanComparerFallback() { return <Fallback label="Comparador de planes" />; } };
    }
  },
  { ssr: false }
);

const ClientChecklist = dynamic(
  async () => {
    try {
      const m = await import("@/features/tools/ClientChecklist");
      return { default: m.default || (m as any).ClientChecklist };
    } catch {
      return { default: function ClientChecklistFallback() { return <Fallback label="Checklist del cliente" />; } };
    }
  },
  { ssr: false }
);

export default function ToolsPage() {
  const [tab, setTab] = useState<"basic" | "comparer" | "checklist">("basic");

  return (
    <div className="space-y-4">
      <Header />

      <Card className="shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="inline-flex rounded-md border p-1 bg-background">
              <button
                type="button"
                onClick={() => setTab("basic")}
                className={`px-3 py-1.5 text-sm rounded-sm transition ${tab === "basic" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                aria-pressed={tab === "basic"}
              >
                Cotizador básico
              </button>
              <button
                type="button"
                onClick={() => setTab("comparer")}
                className={`px-3 py-1.5 text-sm rounded-sm transition ${tab === "comparer" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                aria-pressed={tab === "comparer"}
              >
                Comparador de planes
              </button>
              <button
                type="button"
                onClick={() => setTab("checklist")}
                className={`px-3 py-1.5 text-sm rounded-sm transition ${tab === "checklist" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                aria-pressed={tab === "checklist"}
              >
                Checklist de cliente
              </button>
            </div>
          </div>

          <div className="mt-4">
            {tab === "basic" && (
              <BasicQuote />
            )}

            {tab === "comparer" && (
              <PlanComparer />
            )}

            {tab === "checklist" && (
              <ClientChecklist />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">Herramientas</h1>
        <p className="text-sm text-muted-foreground">
          Cotiza, compara y prepara materiales para tus clientes.
        </p>
      </div>
    </div>
  );
}

function Fallback({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
      <p className="font-medium mb-1">{label}</p>
      <p>
        Aún no se encontró el componente de <b>{label}</b>. Si ya lo creaste,
        verifica la ruta:
      </p>
      <ul className="list-disc pl-5 mt-2">
        <li><code>src/features/tools/BasicQuote.tsx</code></li>
        <li><code>src/features/tools/PlanCompare.tsx</code></li>
        <li><code>src/features/tools/ClientChecklist.tsx</code></li>
      </ul>
      <p className="mt-2">
        Cuando esos archivos existan y exporten el componente (default o nombrado),
        esta pestaña se cargará automáticamente.
      </p>
    </div>
  );
}