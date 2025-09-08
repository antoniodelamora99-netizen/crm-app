'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/users'
import { APP_VERSION } from '@/lib/version'
import { BUILD_COMMIT_SHORT, BUILD_DATE_ISO } from '@/lib/buildMeta'
import { LS_KEYS } from '@/lib/storage'
import {
  BarChart3,
  ListChecks,
  Users,
  ShieldCheck,
  CalendarDays,
  Target,
  Stethoscope,
  BookOpenText,
  Wrench,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

type Current = { id: string; role: 'asesor' | 'gerente' | 'promotor'; name: string }

// Local type for nav items with an optional role-gate
type MenuItem = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  show: boolean
}

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Current | null>(null)
  const [menuOpen, setMenuOpen] = useState(false) // mobile overlay nav
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false) // desktop collapse
  const router = useRouter()
  const pathname = usePathname()

  // Load current user (client-side local storage based auth)
  useEffect(() => {
    const u = getCurrentUser()
    if (!u) {
      router.replace('/login')
      return
    }
    setUser({ id: u.id, role: u.role as Current['role'], name: u.name })
  }, [router])

  // Derive role flags (keep outside of render branching to preserve hook order)
  const role = user?.role
  const isAsesor = role === 'asesor'
  const isManager = role === 'gerente' || role === 'promotor'

  // Iconized menu; compute once from role flags
  const menu: MenuItem[] = useMemo(
    () => [
      { href: '/dashboard', label: 'Dashboard', icon: BarChart3, show: true },
      { href: '/pending', label: 'Pendientes', icon: ListChecks, show: true },
      { href: '/clients', label: 'Clientes', icon: Users, show: isAsesor }, // asesores gestionan clientes
      { href: '/policies', label: 'Pólizas', icon: ShieldCheck, show: true },
      { href: '/activities', label: 'Citas / Actividades', icon: CalendarDays, show: true },
      { href: '/goals', label: 'Metas', icon: Target, show: true },
      { href: '/medical', label: 'Cuestionario Médico', icon: Stethoscope, show: true },
      { href: '/kb', label: 'Base de Conocimiento', icon: BookOpenText, show: true },
      { href: '/tools', label: 'Herramientas', icon: Wrench, show: true },
      // vistas de control
      { href: '/team', label: 'Asesores', icon: Users, show: isManager },
      { href: '/users', label: 'Usuarios', icon: Users, show: isManager },
    ],
    [isAsesor, isManager]
  )

  // Subtle logout (no big red button)
  const logout = () => {
    try { localStorage.removeItem(LS_KEYS.currentUser) } catch {}
    router.replace('/login')
  }

  // Early state: keep hook order stable
  if (!user) {
    return (
      <div className="grid h-screen place-items-center bg-slate-50 text-slate-600">
        <p className="animate-pulse">Redirigiendo al login…</p>
      </div>
    )
  }
  const itemClass = (href: string) => {
    const active =
      href === '/dashboard'
        ? pathname === '/dashboard' || pathname === '/'
        : pathname?.startsWith(href)
    return [
      'flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition-colors',
      active
        ? 'bg-slate-900 text-white shadow-sm'
        : 'bg-slate-50 text-slate-700 hover:bg-slate-100',
    ].join(' ')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar mobile (hamburger a la izquierda) */}
      <div className="md:hidden relative flex items-center gap-3 pr-4 pl-12 py-3 border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-40">
        {/* Botón fijo extremo izquierdo */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-md border border-slate-300 text-slate-600 active:scale-95 transition bg-white"
        >
          {menuOpen ? <X size={20}/> : <Menu size={20} />}
        </button>
        <div className="flex items-end gap-2">
          <span className="text-xl font-extrabold tracking-tight text-slate-900">GAMO</span>
          <span className="text-[10px] font-medium text-slate-400 mb-0.5 select-none">v{APP_VERSION}</span>
        </div>
      </div>
      {/* Mobile overlay menu */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl border-r border-slate-200 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-6 pb-4 border-b border-slate-200">
              <div className="flex items-end gap-2">
                <div className="text-2xl font-extrabold tracking-tight text-slate-900">GAMO</div>
                <span className="text-[11px] font-medium text-slate-400 mb-0.5 select-none">v{APP_VERSION}</span>
              </div>
              <div className="text-[11px] tracking-wide text-slate-500 -mt-0.5">ASESORÍA INTEGRAL EN RIESGOS</div>
              <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                <div className="truncate text-[13px] font-semibold text-slate-800">{user.name}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">{user.role}</div>
              </div>
            </div>
            <nav className="flex-1 overflow-auto px-3 py-4 space-y-1">
              {menu.filter(m=>m.show).map(m => (
                <Link key={m.href} href={m.href} className={itemClass(m.href)} onClick={() => setMenuOpen(false)}>
                  <m.icon size={18} className="shrink-0" />
                  <span>{m.label}</span>
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                className="text-[12px] font-medium text-slate-500 underline underline-offset-4 hover:text-rose-600"
              >Cerrar sesión</button>
              <button
                onClick={() => setMenuOpen(false)}
                className="text-[12px] text-slate-500 hover:text-slate-700"
              >Cerrar</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex">
        {/* SIDEBAR desktop (collapsible) */}
        <aside
          className={[
            "hidden md:flex sticky top-0 h-screen border-r border-slate-200 bg-white/90 backdrop-blur flex-col transition-all duration-200",
            sidebarCollapsed ? "w-16" : "w-72"
          ].join(" ")}
        >
          {/* Branding card (como en el diseño que te gustaba) */}
          <div className={"relative border-b border-slate-200 " + (sidebarCollapsed ? "px-2 pt-5 pb-4" : "px-5 pt-6 pb-5")}>
            <div className={"flex items-end gap-2 " + (sidebarCollapsed ? "justify-center" : "")}>
              <div className={"font-extrabold tracking-tight text-slate-900 " + (sidebarCollapsed ? "text-xl" : "text-2xl")}>G</div>
              {!sidebarCollapsed && (
                <>
                  <div className="text-2xl font-extrabold tracking-tight text-slate-900">AMO</div>
                  <span
                    className="text-[11px] font-medium text-slate-400 mb-0.5 select-none"
                    title={`Versión ${APP_VERSION} • ${BUILD_COMMIT_SHORT} • ${new Date(BUILD_DATE_ISO).toLocaleString()}`}
                  >v{APP_VERSION}</span>
                </>
              )}
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="text-[11px] tracking-wide text-slate-500 -mt-0.5">ASESORÍA INTEGRAL EN RIESGOS</div>
                <div className="mt-1 text-[10px] text-slate-400">
                  {new Date(BUILD_DATE_ISO).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  {" "}
                  {new Date(BUILD_DATE_ISO).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </>
            )}
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
              className="absolute -right-3 top-6 hidden md:inline-flex h-6 w-6 items-center justify-center rounded-full border bg-white text-slate-500 shadow-sm hover:text-slate-700 hover:bg-slate-50 transition"
            >
              {sidebarCollapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
            </button>
          </div>

            {/* Usuario compacto */}
          <div className={"mt-4 rounded-lg bg-slate-50 " + (sidebarCollapsed ? "mx-2 px-1 py-2" : "px-3 py-2")}> 
            <div className="truncate text-[13px] font-semibold text-slate-800" title={user.name}>{sidebarCollapsed ? user.name.split(' ')[0] : user.name}</div>
            {!sidebarCollapsed && <div className="text-[11px] uppercase tracking-wide text-slate-500">{user.role}</div>}
            {!sidebarCollapsed && (
              <button
                onClick={logout}
                className="mt-2 text-[12px] font-medium text-slate-500 underline underline-offset-4 hover:text-rose-600"
                aria-label="Cerrar sesión"
              >Cerrar sesión</button>
            )}
          </div>

          {/* Navegación */}
          <nav className={"py-4 overflow-auto flex-1 space-y-1 " + (sidebarCollapsed ? "px-1" : "px-3") }>
            {menu.filter((m) => m.show).map((m) => (
              <Link key={m.href} href={m.href} className={itemClass(m.href)} title={sidebarCollapsed ? m.label : undefined}>
                <m.icon size={18} className="shrink-0" />
                {!sidebarCollapsed && <span>{m.label}</span>}
              </Link>
            ))}
          </nav>
        </aside>

        {/* CONTENIDO */}
        <main className="min-h-screen flex-1">
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
          {/* Floating toggle for desktop when collapsed (optional show when collapsed) */}
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              aria-label="Expandir menú"
              className="hidden md:flex fixed bottom-4 left-4 h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg ring-2 ring-white/40 hover:bg-slate-800"
            >
              <ChevronRight size={18}/>
            </button>
          )}
        </main>
      </div>
    </div>
  )
}