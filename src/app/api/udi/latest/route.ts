import { NextResponse } from "next/server";

// Date helpers
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDMY = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

// GET /api/udi/latest -> { value: number, date?: string, source: string }
function normalizeBanxicoDate(raw: string): string | undefined {
  if (!raw) return undefined;
  const today = new Date();
  const isFuture = (d: Date) => d.getTime() > today.getTime() + 36 * 3600 * 1000; // allow up to +36h tolerance

  // Try ISO first (YYYY-MM-DD)
  const isoMatch = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (isoMatch) {
    const y = isoMatch[1], m = isoMatch[2], d2 = isoMatch[3];
    const d = new Date(`${y}-${m}-${d2}T00:00:00`);
    if (!isNaN(d.getTime())) {
      if (isFuture(d)) {
        // try swapping month/day in case feed mixed formats
        const alt = new Date(`${y}-${d2}-${m}T00:00:00`);
        if (!isNaN(alt.getTime()) && !isFuture(alt)) return toIso(alt);
        return toIso(today);
      }
      return toIso(d);
    }
  }
  // Try dd/MM/yyyy
  const dmy = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (dmy) {
    const d = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00`);
    if (!isNaN(d.getTime())) {
      // Some feeds could deliver MM/DD/YYYY by mistake; if the parsed date is too far in future, swap day<->month
      if (isFuture(d)) {
        const alt = new Date(`${dmy[3]}-${dmy[1]}-${dmy[2]}T00:00:00`);
        if (!isNaN(alt.getTime())) return toIso(alt);
      }
      return toIso(d);
    }
  }
  // Fallback: return today
  return toIso(today);
}

export async function GET() {
  const token = process.env.BANXICO_TOKEN || process.env.NEXT_PUBLIC_BANXICO_TOKEN;
  const serie = process.env.BANXICO_SERIE_ID || process.env.NEXT_PUBLIC_BANXICO_SERIE_ID || "SP68257";
  if (!token) {
    return NextResponse.json({ error: "BANXICO_TOKEN not configured" }, { status: 503 });
  }
  const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${encodeURIComponent(serie)}/datos/oportuno?token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: `Banxico ${res.status}` }, { status: res.status });
    const data = await res.json();
  const nodo = data?.bmx?.series?.[0]?.datos?.[0];
    const raw = (nodo?.dato ?? "").toString().replace(/,/g, ".");
    const v = Number(raw);
    if (!isFinite(v) || v <= 0) return NextResponse.json({ error: "Invalid value" }, { status: 502 });
  const iso = normalizeBanxicoDate(String(nodo?.fecha || ""));
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  const dateDMY = toDMY(isNaN(d.getTime()) ? new Date() : d);
  return NextResponse.json({ value: v, date: dateDMY, source: "banxico" }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}
