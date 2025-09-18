'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { ensureProfile } from '@/lib/auth/ensureProfile'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const em = email.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        throw new Error('Ingresa un email válido')
      }
      const sb = supabaseBrowser()
      const { error } = await sb.auth.signInWithPassword({ email: em, password })
  if (error) throw error
  await ensureProfile()
      router.replace('/dashboard')
    } catch (e: any) {
      setError(e?.message || 'No se pudo iniciar sesión')
    } finally { setLoading(false) }
  }

  const sendMagicLink = async () => {
    setError(null)
    setLoading(true)
    try {
      const em = email.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        throw new Error('Ingresa un email válido')
      }
      const sb = supabaseBrowser()
      const { error } = await sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin + '/dashboard' : undefined } })
      if (error) throw error
      setOtpSent(true)
    } catch (e: any) {
      setError(e?.message || 'No se pudo enviar el enlace')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-white">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 text-center">
          <div className="text-xl font-extrabold tracking-tight text-slate-900">GAMO</div>
          <div className="text-xs tracking-wide text-slate-500">ASESORÍA INTEGRAL EN RIESGOS</div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Correo electrónico</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@empresa.com"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Contraseña</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-900 active:translate-y-px focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-60"
          >
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="mt-4 grid gap-2">
          <button
            onClick={sendMagicLink}
            disabled={loading || !email}
            className="w-full rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 active:translate-y-px disabled:opacity-60"
          >
            Enviarme enlace mágico
          </button>
          {otpSent && <div className="text-[12px] text-slate-600">Revisa tu correo para completar el acceso.</div>}
        </div>
      </div>
    </div>
  )
}