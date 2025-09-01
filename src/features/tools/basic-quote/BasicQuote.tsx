"use client";

import React, { useMemo, useState } from "react";
import { computeUdiQuote, fmt2, Periodicity } from "@/lib/finance/udi";

export default function BasicQuote() {
  // Keep raw string inputs to control formatting and avoid browser quirks with leading zeros
  const [udiTodayTxt, setUdiTodayTxt] = useState<string>("8.5");
  const [inflPctTxt, setInflPctTxt] = useState<string>("4.5");
  const [yearsTxt, setYearsTxt] = useState<string>("10");
  const [periodicity, setPeriodicity] = useState<Periodicity>("Anual");
  const [udisPerPeriodTxt, setUdisPerPeriodTxt] = useState<string>("1000");
  const [pvRatePctTxt, setPvRatePctTxt] = useState<string>("0");

  // Normalizers -------------------------------------------------------------
  const normDecimal = (s: string) => {
    // Trim spaces
    let v = s.replace(/\s+/g, "");
    if (v === "") return "";
    // Allow only one leading minus, digits and one dot
    v = v.replace(/[^0-9.\-]/g, "");
    // If starts with '.', prefix 0
    if (v.startsWith(".")) v = "0" + v;
    // If starts with multiple zeros like 00.5 or 008, collapse to single zero except keep 0.x
    if (/^0+\d/.test(v)) v = v.replace(/^0+/, "");
    // Edge: becomes empty after strip -> 0
    if (v === "") v = "0";
    return v;
  };
  const normInteger = (s: string) => {
    let v = s.replace(/\s+/g, "");
    v = v.replace(/[^0-9\-]/g, "");
    // Remove leading zeros (keep single zero)
    v = v.replace(/^0+(\d)/, "$1");
    if (v === "") v = "0";
    return v;
  };

  const udiToday = parseFloat(udiTodayTxt || "0");
  const inflPct = parseFloat(inflPctTxt || "0");
  const years = parseInt(yearsTxt || "0", 10);
  const udisPerPeriod = parseInt(udisPerPeriodTxt || "0", 10);
  const pvRatePct = parseFloat(pvRatePctTxt || "0");

  const [showValueAtYear, setShowValueAtYear] = useState(true);
  const [showPresentValue, setShowPresentValue] = useState(true);

  const input = useMemo(() => ({ udiToday, inflPct, years, periodicity, udisPerPeriod, pvRatePct }), [udiToday, inflPct, years, periodicity, udisPerPeriod, pvRatePct]);

  const result = computeUdiQuote(input);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-xs text-neutral-600">Precio UDI hoy</span>
          <input type="text" inputMode="decimal" value={udiTodayTxt} onChange={(e) => setUdiTodayTxt(normDecimal((e.target as HTMLInputElement).value))} onBlur={(e)=> setUdiTodayTxt(normDecimal((e.target as HTMLInputElement).value))} className="input" />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-neutral-600">Inflación anual (%)</span>
          <input type="text" inputMode="decimal" value={inflPctTxt} onChange={(e) => setInflPctTxt(normDecimal((e.target as HTMLInputElement).value))} onBlur={(e)=> setInflPctTxt(normDecimal((e.target as HTMLInputElement).value))} className="input" />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-neutral-600">Años</span>
          <input type="text" inputMode="numeric" value={yearsTxt} onChange={(e) => setYearsTxt(normInteger((e.target as HTMLInputElement).value))} onBlur={(e)=> setYearsTxt(normInteger((e.target as HTMLInputElement).value))} className="input" />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-neutral-600">UDIs por periodo</span>
          <input type="text" inputMode="numeric" value={udisPerPeriodTxt} onChange={(e) => setUdisPerPeriodTxt(normInteger((e.target as HTMLInputElement).value))} onBlur={(e)=> setUdisPerPeriodTxt(normInteger((e.target as HTMLInputElement).value))} className="input" />
        </label>
        <label className="grid gap-1 col-span-2">
          <span className="text-xs text-neutral-600">Periodicidad</span>
          <select value={periodicity} onChange={(e) => setPeriodicity(e.target.value as Periodicity)} className="input">
            <option>Anual</option>
            <option>Semestral</option>
            <option>Trimestral</option>
            <option>Mensual</option>
          </select>
        </label>
        <label className="grid gap-1 col-span-2">
          <span className="text-xs text-neutral-600">Tasa de descuento (%)</span>
          <input type="text" inputMode="decimal" value={pvRatePctTxt} onChange={(e) => setPvRatePctTxt(normDecimal((e.target as HTMLInputElement).value))} onBlur={(e)=> setPvRatePctTxt(normDecimal((e.target as HTMLInputElement).value))} className="input" />
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
