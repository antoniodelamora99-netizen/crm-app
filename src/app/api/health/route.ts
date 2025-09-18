import { NextResponse } from 'next/server'

export function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE: Boolean(process.env.SUPABASE_SERVICE_ROLE),
    BANXICO_TOKEN: Boolean(process.env.BANXICO_TOKEN) || Boolean(process.env.NEXT_PUBLIC_BANXICO_TOKEN),
    BANXICO_SERIE_ID: process.env.BANXICO_SERIE_ID || process.env.NEXT_PUBLIC_BANXICO_SERIE_ID || 'SP68257'
  }
  return NextResponse.json({ ok: true, env }, { status: 200 })
}
