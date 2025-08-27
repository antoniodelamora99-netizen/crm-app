"use client";
import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Utilidades
type Periodicidad = "Mensual" | "Trimestral" | "Semestral" | "Anual";
type Moneda = "UDIS" | "MXN" | "USD";

/**
 * Convierte inflación anual a inflación por periodo.
 * Ej: 6% anual y mensual -> ((1+0.06)^(1/12))-1
 */
function ratePerPeriod(annual: number, perYear: number) {
  const a = annual / 100;
  return Math.pow(1 + a, 1 / perYear) - 1;
}

function perYearFrom(periodicidad: Periodicidad) {
  switch (periodicidad) {
    case "Mensual": return 12;
    case "Trimestral": return 4;
    case "Semestral": return 2;
    case "Anual": return 1;
  }
}

export default function BasicQuote() {
  // Entradas
  const [moneda, setMoneda] = useState<Moneda>("UDIS");
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>("Mensual");
  const [inflacionAnual, setInflacionAnual] = useState<number>(6);
  const [aporteInicial, setAporteInicial] = useState<number>(100); // en UDIS / MXN / USD según selección
  const [anios, setAnios] = useState<number>(10);
  const [udiPrecio, setUdiPrecio] = useState<number>(8.53);

  const { rows, totals } = useMemo(() => {
    const nPerYear = perYearFrom(periodicidad);
    const r = inflacionAnual / 100; // inflación anual

    const rows: Array<{
      year: number;
      udiPrice: number;
      aporteUDIS: number;
      saldoUDIS: number;
      aporteMoneda: number;
      saldoMoneda: number;
      saldoMonedaPV: number;
    }> = [];

    const aporteAnualUDIS = aporteInicial * nPerYear; // UDIS fijas por año

    let saldoUDIS = 0;

    for (let y = 1; y <= anios; y++) {
      const precioY = udiPrecio * Math.pow(1 + r, y - 1);
      saldoUDIS += aporteAnualUDIS;
      const aporteMoneda = aporteAnualUDIS * precioY;
      const saldoMoneda = saldoUDIS * precioY;
      const discount = 1 / Math.pow(1 + r, y - 1);
      const saldoMonedaPV = saldoMoneda * discount;
      rows.push({
        year: y,
        udiPrice: precioY,
        aporteUDIS: aporteAnualUDIS,
        saldoUDIS,
        aporteMoneda,
        saldoMoneda,
        saldoMonedaPV,
      });
    }

    const totals = rows.reduce(
      (acc, it) => {
        acc.aporteUDIS += it.aporteUDIS;
        acc.aporteMoneda += it.aporteMoneda;
        acc.saldoUDIS = it.saldoUDIS; // último
        acc.saldoMoneda = it.saldoMoneda; // último
        // Usar solo el valor presente del saldo FINAL (último año) para evitar doble conteo
        acc.saldoMonedaPV = it.saldoMonedaPV;
        return acc;
      },
      { aporteUDIS: 0, aporteMoneda: 0, saldoUDIS: 0, saldoMoneda: 0, saldoMonedaPV: 0 }
    );

    return { rows, totals };
  }, [periodicidad, inflacionAnual, aporteInicial, anios, udiPrecio]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);

  return (
    <Card className="shadow">
      <CardContent className="p-4 space-y-4">
        <div className="text-lg font-semibold">Cotizador básico (UDIS → valor por inflación)</div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1">
            <Label>Moneda de referencia</Label>
            <Select value={moneda} onValueChange={(v) => setMoneda(v as Moneda)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UDIS">UDIS</SelectItem>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label>Periodicidad de aportación</Label>
            <Select value={periodicidad} onValueChange={(v) => setPeriodicidad(v as Periodicidad)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Mensual">Mensual</SelectItem>
                <SelectItem value="Trimestral">Trimestral</SelectItem>
                <SelectItem value="Semestral">Semestral</SelectItem>
                <SelectItem value="Anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <Label>Inflación anual (%)</Label>
            <Input type="number" value={inflacionAnual} onChange={(e) => setInflacionAnual(Number((e.target as HTMLInputElement).value))} />
          </div>

          <div className="grid gap-1">
            <Label>Valor UDI hoy ({moneda})</Label>
            <Input type="number" step="0.0001" value={udiPrecio} onChange={(e) => setUdiPrecio(Number((e.target as HTMLInputElement).value))} />
          </div>

          <div className="grid gap-1">
            <Label>Aporte por periodo (en UDIS)</Label>
            <Input type="number" value={aporteInicial} onChange={(e) => setAporteInicial(Number((e.target as HTMLInputElement).value))} />
          </div>

          <div className="grid gap-1">
            <Label>Años de aportación</Label>
            <Input type="number" value={anios} onChange={(e) => setAnios(Number((e.target as HTMLInputElement).value))} />
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-neutral-50">
                <th className="p-2 text-left">Año</th>
                <th className="p-2 text-right">Precio UDI ({moneda})</th>
                <th className="p-2 text-right">Aporte anual (UDIS)</th>
                <th className="p-2 text-right">Saldo acumulado (UDIS)</th>
                <th className="p-2 text-right">Aporte anual ({moneda})</th>
                <th className="p-2 text-right">Saldo a valor del año ({moneda})</th>
                <th className="p-2 text-right">Saldo en valor presente ({moneda})</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.year} className="border-t">
                  <td className="p-2">{r.year}</td>
                  <td className="p-2 text-right">{fmt(r.udiPrice)}</td>
                  <td className="p-2 text-right">{fmt(r.aporteUDIS)}</td>
                  <td className="p-2 text-right">{fmt(r.saldoUDIS)}</td>
                  <td className="p-2 text-right">{fmt(r.aporteMoneda)}</td>
                  <td className="p-2 text-right">{fmt(r.saldoMoneda)}</td>
                  <td className="p-2 text-right">{fmt(r.saldoMonedaPV)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="p-2">Totales</td>
                <td className="p-2" />
                <td className="p-2 text-right">{fmt(totals.aporteUDIS)}</td>
                <td className="p-2 text-right" />
                <td className="p-2 text-right">{fmt(totals.aporteMoneda)}</td>
                <td className="p-2 text-right" />
                <td className="p-2 text-right" />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid md:grid-cols-4 gap-3 pt-2">
          <Stat label="Total aportado (UDIS)" value={fmt(totals.aporteUDIS)} />
          <Stat label={`Total aportado (${moneda})`} value={`${fmt(totals.aporteMoneda)} ${moneda}`} />
          <Stat label={`Saldo final (${moneda})`} value={`${fmt(totals.saldoMoneda)} ${moneda}`} />
          <Stat label="Saldo final (UDIS)" value={fmt(totals.saldoUDIS)} />
          <Stat label={`Saldo final (valor presente, ${moneda})`} value={`${fmt(totals.saldoMonedaPV)} ${moneda}`} />
        </div>

        <div className="text-xs text-neutral-500">
          La aportación en <strong>UDIS</strong> se mantiene constante por periodo. El precio de la UDI crece por la inflación anual, por lo que el valor en {moneda} tanto de las aportaciones como del saldo aumenta cada año.
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}