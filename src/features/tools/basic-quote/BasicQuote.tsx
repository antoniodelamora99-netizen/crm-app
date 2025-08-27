"use client";

import React, { useMemo, useState } from "react";
import { computeUdiQuote, fmt2, Periodicity } from "@/lib/finance/udi";

export default function BasicQuote() {
  const [udiToday, setUdiToday] = useState<number>(7.0);
  const [inflPct, setInflPct] = useState<number>(3);
  const [years, setYears] = useState<number>(10);
  const [periodicity, setPeriodicity] = useState<Periodicity>("Mensual");
  const [udisPerPeriod, setUdisPerPeriod] = useState<number>(10);
  const [pvRatePct, setPvRatePct] = useState<number>(0);

  const [showValueAtYear, setShowValueAtYear] = useState(true);
  const [showPresentValue, setShowPresentValue] = useState(true);

  const input = useMemo(() => ({ udiToday, inflPct, years, periodicity, udisPerPeriod, pvRatePct }), [udiToday, inflPct, years, periodicity, udisPerPeriod, pvRatePct]);

  const result = computeUdiQuote(input);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-neutral-600">Precio UDI hoy</span>
          <input type="number" value={udiToday} onChange={(e) => setUdiToday(Number(e.target.value))} className="input" />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-neutral-600">Inflación anual (%)</span>
          <input type="number" value={inflPct} onChange={(e) => setInflPct(Number(e.target.value))} className="input" />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-neutral-600">Años</span>
          <input type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} className="input" />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-neutral-600">UDIs por periodo</span>
          <input type="number" value={udisPerPeriod} onChange={(e) => setUdisPerPeriod(Number(e.target.value))} className="input" />
        </label>
        <label className="grid gap-1 col-span-2">
          <span className="text-xs text-neutral-600">Periodicidad</span>
          <select value={periodicity} onChange={(e) => setPeriodicity(e.target.value as Periodicity)} className="input">
            <option>Mensual</option>
            <option>Trimestral</option>
            <option>Semestral</option>
            <option>Anual</option>
          </select>
        </label>
        <label className="grid gap-1 col-span-2">
          <span className="text-xs text-neutral-600">Tasa de descuento (%)</span>
          <input type="number" value={pvRatePct} onChange={(e) => setPvRatePct(Number(e.target.value))} className="input" />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={showValueAtYear} onChange={(e) => setShowValueAtYear(e.target.checked)} />
          <span className="text-sm">Mostrar Valor a año</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={showPresentValue} onChange={(e) => setShowPresentValue(e.target.checked)} />
          <span className="text-sm">Mostrar Valor Actual</span>
        </label>
      </div>

      <table className="w-full text-sm border">
        <thead className="bg-neutral-100 text-neutral-700">
          <tr>
            <th className="p-2 text-left">Año</th>
            <th className="p-2 text-left">UDI</th>
            <th className="p-2 text-left">UDIs anuales</th>
            <th className="p-2 text-left">UDIs acumuladas</th>
            <th className="p-2 text-left">MX anual</th>
            {showValueAtYear && <th className="p-2 text-left">Valor a año (MXN)</th>}
            {showPresentValue && <th className="p-2 text-left">Valor actual (MXN)</th>}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r) => (
            <tr key={r.year} className="border-t">
              <td className="p-2">{r.year}</td>
              <td className="p-2">{r.udiPrice.toFixed(4)}</td>
              <td className="p-2">{r.annualUdis}</td>
              <td className="p-2">{r.cumUdis}</td>
              <td className="p-2">{fmt2(r.annualMx)}</td>
              {showValueAtYear && <td className="p-2">{fmt2(r.valueAtYearMx)}</td>}
              {showPresentValue && <td className="p-2">{fmt2(r.presentValueMx)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-neutral-50">
          <tr>
            <td className="p-2 font-semibold">Totales</td>
            <td />
            <td className="p-2">{result.totals.totalUdisContributed}</td>
            <td className="p-2">{result.totals.finalCumUdis}</td>
            <td className="p-2">{fmt2(result.totals.finalValueAtYearMx)}</td>
            {showValueAtYear && <td />}
            {showPresentValue && <td className="p-2">{fmt2(result.totals.finalPresentValueMx)}</td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
