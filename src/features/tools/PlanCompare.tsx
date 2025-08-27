

"use client";
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

// Tipado mínimo para filas a comparar
export type CompareRow = {
  id: string;
  producto: string; // nombre del plan (p.ej. Imagina Ser 65)
  aseguradora?: string;
  moneda: "MXN" | "USD" | "UDIS";
  prima?: number; // prima del periodo
  periodo: "Mensual" | "Trimestral" | "Semestral" | "Anual";
  sumaAsegurada?: number;
  deducible?: number;
  coaseguro?: number; // en %
  notas?: string;
};

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * PlanComparePage
 *
 * Pequeño comparador de planes. Mantiene el estado local (local-first) y NO se auto-importa.
 * Deja un placeholder simple pero útil para comenzar a comparar 2+ opciones.
 */
export default function PlanComparePage() {
  const [rows, setRows] = useState<CompareRow[]>([
    { id: uid(), producto: "", aseguradora: "", moneda: "MXN", periodo: "Mensual" },
    { id: uid(), producto: "", aseguradora: "", moneda: "MXN", periodo: "Mensual" },
  ]);

  const addRow = () => setRows((r) => [...r, { id: uid(), producto: "", aseguradora: "", moneda: "MXN", periodo: "Mensual" }]);
  const delRow = (id: string) => setRows((r) => r.filter((x) => x.id !== id));
  const patch = (id: string, key: keyof CompareRow, value: any) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, [key]: value } : x)));

  const resumen = useMemo(() => {
    // pequeña agregación para mostrar totales aproximados por moneda
    const by = new Map<string, number>();
    for (const r of rows) {
      const key = r.moneda + "-" + (r.periodo || "Mensual");
      const val = Number(r.prima || 0);
      by.set(key, (by.get(key) || 0) + val);
    }
    return Array.from(by.entries());
  }, [rows]);

  return (
    <div className="space-y-4">
      <Card className="shadow">
        <CardHeader>
          <CardTitle>Comparador de Planes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Agrega 2 o más opciones y ajusta sus campos para compararlas rápidamente.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm align-middle">
              <thead className="bg-neutral-100 text-neutral-700">
                <tr>
                  <th className="p-2 text-left">Plan / Producto</th>
                  <th className="p-2 text-left">Aseguradora</th>
                  <th className="p-2 text-left">Moneda</th>
                  <th className="p-2 text-left">Periodo</th>
                  <th className="p-2 text-left">Prima</th>
                  <th className="p-2 text-left">Suma Asegurada</th>
                  <th className="p-2 text-left">Deducible</th>
                  <th className="p-2 text-left">Coaseguro %</th>
                  <th className="p-2 text-left">Notas</th>
                  <th className="p-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 min-w-[180px]">
                      <Input
                        value={r.producto}
                        placeholder="Imagina Ser 65 / GM Flex…"
                        onChange={(e) => patch(r.id, "producto", (e.target as HTMLInputElement).value)}
                      />
                    </td>
                    <td className="p-2 min-w-[140px]">
                      <Input
                        value={r.aseguradora || ""}
                        placeholder="GNP / AXA / Seguros…"
                        onChange={(e) => patch(r.id, "aseguradora", (e.target as HTMLInputElement).value)}
                      />
                    </td>
                    <td className="p-2">
                      <Select value={r.moneda} onValueChange={(v) => patch(r.id, "moneda", v as CompareRow["moneda"])}>
                        <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MXN">MXN</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="UDIS">UDIS</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Select value={r.periodo} onValueChange={(v) => patch(r.id, "periodo", v as CompareRow["periodo"])}>
                        <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mensual">Mensual</SelectItem>
                          <SelectItem value="Trimestral">Trimestral</SelectItem>
                          <SelectItem value="Semestral">Semestral</SelectItem>
                          <SelectItem value="Anual">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2 min-w-[120px]">
                      <Input
                        type="number"
                        value={r.prima ?? ""}
                        onChange={(e) => patch(r.id, "prima", Number((e.target as HTMLInputElement).value))}
                      />
                    </td>
                    <td className="p-2 min-w-[140px]">
                      <Input
                        type="number"
                        value={r.sumaAsegurada ?? ""}
                        onChange={(e) => patch(r.id, "sumaAsegurada", Number((e.target as HTMLInputElement).value))}
                      />
                    </td>
                    <td className="p-2 min-w-[120px]">
                      <Input
                        type="number"
                        value={r.deducible ?? ""}
                        onChange={(e) => patch(r.id, "deducible", Number((e.target as HTMLInputElement).value))}
                      />
                    </td>
                    <td className="p-2 min-w-[110px]">
                      <Input
                        type="number"
                        value={r.coaseguro ?? ""}
                        onChange={(e) => patch(r.id, "coaseguro", Number((e.target as HTMLInputElement).value))}
                      />
                    </td>
                    <td className="p-2 min-w-[200px]">
                      <Input
                        value={r.notas || ""}
                        placeholder="Coberturas, límites, extras…"
                        onChange={(e) => patch(r.id, "notas", (e.target as HTMLInputElement).value)}
                      />
                    </td>
                    <td className="p-2">
                      <Button variant="destructive" size="icon" onClick={() => delRow(r.id)}>
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={addRow}><Plus className="mr-2" size={16}/>Agregar opción</Button>
          </div>

          {/* Resumen simple */}
          {rows.length > 0 && (
            <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {resumen.map(([k, total]) => (
                <Card key={k} className="border-dashed">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground">Suma de primas ({k})</div>
                    <div className="text-lg font-semibold">
                      {total.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}