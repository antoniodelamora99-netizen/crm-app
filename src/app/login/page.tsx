'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUsers, setCurrentUser } from '@/lib/users'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const users = getUsers()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const u = users.find(
      (x) => x.username?.trim() === username.trim() && x.password === password
    )
    if (!u) {
      setError('Usuario o contraseña incorrectos.')
      return
    }

    setCurrentUser(u.id)
    router.replace('/dashboard') // después del login, al dashboard (dentro de (shell))
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
            <label className="block text-sm font-medium text-slate-700">Usuario</label>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ej. ase-juan"
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
              placeholder="••••"
            />
          </div>

          {error && (
            <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-900 active:translate-y-px focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
          >
            Iniciar sesión
          </button>
        </form>

        <div className="mt-4 text-[11px] text-slate-500">
          Usuarios demo: <code>ase-juan / 1234</code>, <code>ger-pilar / 1234</code>,{' '}
          <code>prom-antonio / 1234</code>
        </div>
      </div>
    </div>
  )
}