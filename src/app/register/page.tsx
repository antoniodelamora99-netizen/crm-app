"use client";
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { ensureProfile } from '@/lib/auth/ensureProfile'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const em = email.trim()
      const nm = name.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error('Ingresa un email válido')
      if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres')
      const sb = supabaseBrowser()
      const { error, data } = await sb.auth.signUp({ email: em, password, options: { data: { name: nm || undefined } } })
      if (error) throw error
      // si el proyecto tiene confirmación por correo, signUp devuelve user null hasta confirmar
      // intentamos asegurar profile si ya hay sesión
      await ensureProfile({ name: nm || undefined })
      router.replace('/dashboard')
    } catch (e: any) {
      setError(e?.message || 'No se pudo registrar')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-white">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 text-center">
          <div className="text-xl font-extrabold tracking-tight text-slate-900">GAMO</div>
          <div className="text-xs tracking-wide text-slate-500">Crear cuenta</div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nombre (opcional)</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Correo electrónico</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tucorreo@empresa.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Contraseña</label>
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}
          <button type="submit" disabled={loading} className="w-full rounded-md bg-black px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{loading? 'Creando…' : 'Crear cuenta'}</button>
        </form>
      </div>
    </div>
  )
}
