'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react'
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
  // refs para gestos táctiles
  const touchRef = useRef<{ startX: number; startY: number; opening: boolean; closing: boolean; active: boolean }>({ startX:0, startY:0, opening:false, closing:false, active:false })
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

  // Gestos táctiles: swipe desde borde para abrir y swipe izquierda para cerrar
  useEffect(() => {
    let tracking = false
    let opening = false
    let closing = false
    let startX = 0, startY = 0
    const threshold = 60
    const panelWidth = 288 // w-72
    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      startX = t.clientX; startY = t.clientY
      // abrir
      if (!menuOpen && startX < 16) { tracking = true; opening = true; closing = false }
      // cerrar
      else if (menuOpen && startX < panelWidth) { tracking = true; closing = true; opening = false }
    }
    function onMove(e: TouchEvent) {
      if (!tracking) return
      const t = e.touches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      // Cancelar si es scroll vertical dominante
      if (Math.abs(dy) > Math.abs(dx) * 1.2) { tracking = false; return }
      if (opening && dx > threshold) { setMenuOpen(true); tracking = false }
      if (closing && dx < -threshold) { setMenuOpen(false); tracking = false }
    }
    function onEnd() { tracking = false; opening = false; closing = false }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [menuOpen])

  // Para evitar animación en primer render (montaje inicial)
  const hasMountedRef = useRef(false)
  useEffect(() => { hasMountedRef.current = true }, [])

  // Estado inicial (después de montar hooks) -> evita romper orden de hooks
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
      {/* Edge invisible (touch) para iniciar apertura via swipe */}
      {!menuOpen && (
        <div className="fixed left-0 top-0 h-full w-4 z-40 md:hidden" />
      )}
      {/* Top bar mobile (hamburger a la izquierda) */}
      <div className="md:hidden relative flex items-center gap-3 pr-4 pl-14 py-3 border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
        {/* Botón fijo extremo izquierdo - estilo limpio sin borde */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center rounded-xl text-slate-700 active:scale-90 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 hover:bg-slate-100/70"
        >
          <span className={['transition-all duration-300 ease-out will-change-transform', menuOpen ? 'scale-95 rotate-45 opacity-80' : ''].join(' ')}>
            {menuOpen ? <X size={22}/> : <Menu size={22} />}
          </span>
        </button>
        <div className="flex items-end gap-2">
          <span className="text-xl font-extrabold tracking-tight text-slate-900">GAMO</span>
          <span className="text-[10px] font-medium text-slate-400 mb-0.5 select-none">v{APP_VERSION}</span>
        </div>
      </div>
      {/* Mobile overlay */}
      <div
        className={[
          'md:hidden fixed inset-0 z-40 transition-opacity duration-300',
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        ].join(' ')}
        style={{ background: 'rgba(0,0,0,0.35)' }}
        onClick={() => setMenuOpen(false)}
      >
        <div
          className={[
            'absolute left-0 top-0 h-full w-72 bg-white shadow-xl border-r border-slate-200 flex flex-col will-change-transform',
            'transition-transform duration-300 ease-out'
          ].join(' ')}
          onClick={e => e.stopPropagation()}
          style={{ transform: menuOpen ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          <div className="px-5 pt-6 pb-4 border-b border-slate-200">
            <div className="flex items-end gap-2">
              <div className="text-2xl font-extrabold tracking-tight text-slate-900">GAMO</div>
              <span className="text-[11px] font-medium text-slate-400 mb-0.5 select-none">v{APP_VERSION}</span>
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Cerrar menú"
              className="absolute right-2 top-2 p-2 rounded-lg text-slate-500 hover:bg-slate-100 active:scale-95"
            >
              <X size={18} />
            </button>
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
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8"><AppErrorBoundary>{children}</AppErrorBoundary></div>
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

// Simple client-side error boundary to surface errors en producción
class EB extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err: Error) { return { error: err }; }
  componentDidCatch(err: Error, info: any) { console.error('UI ErrorBoundary', err, info); }
  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 space-y-2">
          <div className="font-semibold">Se produjo un error en la interfaz</div>
          <pre className="whitespace-pre-wrap text-[11px] max-h-40 overflow-auto">{this.state.error.message}</pre>
          <button
            onClick={() => { this.setState({ error: null }); if (typeof window !== 'undefined') window.location.reload(); }}
            className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 active:scale-95"
          >Recargar</button>
        </div>
      )
    }
    return this.props.children;
  }
}
function AppErrorBoundary({ children }: { children: React.ReactNode }) { return <EB>{children}</EB>; }