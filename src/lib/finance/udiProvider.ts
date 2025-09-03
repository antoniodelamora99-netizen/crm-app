// Lightweight UDI provider for the BasicQuote tool (client-side)
// Tries a custom JSON endpoint first (NEXT_PUBLIC_UDI_API_URL),
// then Banxico SIE API if a public token is provided.

export type UdiLatest = { value: number; date?: string } | null;

async function fetchFromCustom(): Promise<UdiLatest> {
  const url = process.env.NEXT_PUBLIC_UDI_API_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const v = Number((data?.udi ?? data?.value ?? data?.precio)?.toString().replace(/,/g, '.'));
    if (!isFinite(v) || v <= 0) return null;
    const date = (data?.date || data?.fecha || data?.asof || '').toString();
    return { value: v, date };
  } catch { return null; }
}

async function fetchFromBanxico(): Promise<UdiLatest> {
  const token = process.env.NEXT_PUBLIC_BANXICO_TOKEN;
  if (!token) return null;
  const serie = process.env.NEXT_PUBLIC_BANXICO_SERIE_ID || 'SP68257'; // UDI serie id (commonly SP68257)
  const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${encodeURIComponent(serie)}/datos/oportuno?token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const nodo = data?.bmx?.series?.[0]?.datos?.[0];
    const raw = (nodo?.dato ?? '').toString().replace(/,/g, '.');
    const v = Number(raw);
    if (!isFinite(v) || v <= 0) return null;
    return { value: v, date: nodo?.fecha };
  } catch { return null; }
}

export async function getLatestUdi(): Promise<UdiLatest> {
  const first = await fetchFromCustom();
  if (first) return first;
  const second = await fetchFromBanxico();
  if (second) return second;
  return null;
}
