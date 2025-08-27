// src/lib/finance/udi.ts
export type Periodicity = "Mensual" | "Trimestral" | "Semestral" | "Anual";

export const periodsPerYear: Record<Periodicity, number> = {
  Mensual: 12,
  Trimestral: 4,
  Semestral: 2,
  Anual: 1,
};

export interface UdiQuoteInput {
  udiToday: number;
  inflPct: number;
  years: number;
  periodicity: Periodicity;
  udisPerPeriod: number;
  pvRatePct?: number;
}

export interface UdiRow {
  year: number;
  udiPrice: number;
  annualUdis: number;
  cumUdis: number;
  annualMx: number;
  valueAtYearMx: number;
  presentValueMx: number;
}

export interface UdiQuoteResult {
  rows: UdiRow[];
  totals: {
    totalUdisContributed: number;
    finalCumUdis: number;
    finalValueAtYearMx: number;
    finalPresentValueMx: number;
  };
}

export function buildUdiPath(udiToday: number, inflPct: number, years: number): number[] {
  const infl = inflPct / 100;
  const out: number[] = [];
  let p = udiToday;
  for (let y = 1; y <= years; y++) {
    if (y === 1) out.push(p);
    else {
      p = p * (1 + infl);
      out.push(p);
    }
  }
  return out;
}

export function presentValue(amount: number, ratePct: number, yearIndex: number): number {
  if (!ratePct || ratePct <= 0) return amount;
  const r = ratePct / 100;
  return amount / Math.pow(1 + r, yearIndex);
}

export function computeUdiQuote(input: UdiQuoteInput): UdiQuoteResult {
  const { udiToday, inflPct, years, periodicity, udisPerPeriod, pvRatePct } = input;
  const perYear = periodsPerYear[periodicity];
  const udiPath = buildUdiPath(udiToday, inflPct, years);

  const rows: UdiRow[] = [];
  let cumUdis = 0;
  let totalUdisContributed = 0;

  for (let y = 1; y <= years; y++) {
    const udiPrice = udiPath[y - 1];
    const annualUdis = udisPerPeriod * perYear;
    totalUdisContributed += annualUdis;
    cumUdis += annualUdis;

    const annualMx = annualUdis * udiPrice;
    const valueAtYearMx = cumUdis * udiPrice;
    const presentValueMx = presentValue(valueAtYearMx, pvRatePct ?? 0, y);

    rows.push({ year: y, udiPrice, annualUdis, cumUdis, annualMx, valueAtYearMx, presentValueMx });
  }

  const last = rows[rows.length - 1] || ({} as UdiRow);
  return {
    rows,
    totals: {
      totalUdisContributed,
      finalCumUdis: last.cumUdis || 0,
      finalValueAtYearMx: last.valueAtYearMx || 0,
      finalPresentValueMx: last.presentValueMx || 0,
    },
  };
}

export function fmt2(n: number) {
  return (isFinite(n) ? n : 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
