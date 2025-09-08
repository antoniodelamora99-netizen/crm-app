"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

import {
  Client, Policy, Activity, uid, User,
} from "@/lib/types";
import { repo, LS_KEYS } from "@/lib/storage";
import { getCurrentUser, filterByScope, getUsers, visibleOwnerIdsFor } from "@/lib/users";

import { Calendar, dateFnsLocalizer, Views, View } from "react-big-calendar";
import { format, parse, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, addHours, addMinutes, addMonths, endOfMonth as endOfMonthDF, getDay } from "date-fns";
import { es } from "date-fns/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";

/* ===== Tipos locales extendidos ===== */
interface ActivityWithShare extends Activity { sharedWith?: string[] }
interface ReminderResource { policyId: string; isReminder: true; color?: Activity["color"]; }
type ResourceType = ActivityWithShare | ReminderResource;
interface CalendarEvent { id: string; title: string; start: Date; end: Date; resource: ResourceType; color?: Activity["color"]; }
interface ToolbarProps { label: string; onNavigate: (action: 'TODAY'|'PREV'|'NEXT'|Date) => void; onView: (view: View) => void; }

/* ===== Repos ===== */
const ClientsRepo = repo<Client>(LS_KEYS.clients);
const PoliciesRepo = repo<Policy>(LS_KEYS.policies);
const ActivitiesRepo = repo<Activity>(LS_KEYS.activities);

/* ===== Users for sharing ===== */
const ALL_USERS = getUsers();

/* ===== Localizer ===== */
// date-fns locales don't export a common Locale type here; infer via typeof es
const locales: Record<string, typeof es> = { es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

/* ===== UI helper local ===== */
function Field({label, children}:{label:string; children:React.ReactNode}){
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-neutral-600">{label}</Label>
      {children}
    </div>
  );
}

/* ===== Colores ===== */
const colorMap: Record<NonNullable<Activity["color"]>, string> = {
  verde: "#22c55e",
  verdeamarillento: "#16a34a",
  amarillo: "#f59e0b",
  naranja: "#fb923c",
  rojo: "#ef4444",
};

/* ===== Helpers fecha local/ISO seguros ===== */
function toLocalInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // Ajuste a zona local para datetime-local
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 16);
}
function toIsoOr(prev: string | undefined, value: string) {
  if (!value) return prev || undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? (prev || undefined) : d.toISOString();
}

/* ====== Componente principal ====== */
export default // NOTE: moved to src/features/activities/ActivitiesPage.tsx (kept temporarily as _OLD to avoid breakage)
function ActivitiesPage_OLD() {
  const currentUser = getCurrentUser();
  const user: User = currentUser ?? ({ id: "__anon__", role: "asesor", name: "Invitado", username: "", password: "" });
  const [rows, setRows] = useState<ActivityWithShare[]>(ActivitiesRepo.list() as ActivityWithShare[]);
  const clients = ClientsRepo.list();
  const policies = PoliciesRepo.list();

  const visibleClients = useMemo(() => filterByScope(clients, user, c => c.ownerId), [clients, user]);
  const visiblePolicies = useMemo(() => filterByScope(policies, user, p => p.ownerId), [policies, user]);

  // Usuarios del equipo disponibles para compartir (según jerarquía)
  const teamUsers = useMemo(() => {
    const me = user;
    const ids = visibleOwnerIdsFor(me);
    return ALL_USERS.filter(u => ids.includes(u.id) && u.id !== me.id);
  }, [user]);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ActivityWithShare | null>(null);
  const [calView, setCalView] = useState<View>(Views.DAY);
  const [calDate, setCalDate] = useState<Date>(new Date());
  const [shareMode, setShareMode] = useState<"none"|"all"|"custom">("none");
  const [shareFilter, setShareFilter] = useState("");
  useEffect(() => {
    if (!draft || user.role === "asesor") return;
  const list: string[] = draft?.sharedWith || [];
    if (list.length === 0) setShareMode("none");
    else if (list.length >= teamUsers.length) setShareMode("all");
    else setShareMode("custom");
  }, [draft, teamUsers.length, user.role]);

  useEffect(() => { ActivitiesRepo.saveAll(rows as Activity[]); }, [rows]);

  /* Rango visible del calendario */
  const viewRange = useMemo(() => {
    const d = calDate;
    if (calView === Views.DAY) return { start: startOfDay(d), end: endOfDay(d) };
    if (calView === Views.WEEK) return { start: startOfWeek(d, { weekStartsOn: 1 }), end: endOfWeek(d, { weekStartsOn: 1 }) };
    return { start: startOfMonth(d), end: endOfMonth(d) };
  }, [calDate, calView]);

  /* Recordatorios de pago (a partir de pólizas) */
  function makePaymentReminders(pols: Policy[], start: Date, end: Date): CalendarEvent[] {
    const out: CalendarEvent[] = [];
    for (const p of pols) {
      if (!p.fechaPago) continue;
      const freq = (p.formaPago || "Mensual").toLowerCase();
      const stepMonths = freq === "mensual" ? 1 : freq === "trimestral" ? 3 : freq === "semestral" ? 6 : 12;

      const anchor = new Date(p.fechaPago);
      if (isNaN(anchor.getTime())) continue;

      let first = new Date(anchor);
      while (first < start) first = addMonths(first, stepMonths);

      const clientName = visibleClients.find(c => c.id === p.clienteId)?.nombre || "Cliente";
      for (let dt = new Date(first); dt <= end; dt = addMonths(dt, stepMonths)) {
        const monthStart = new Date(dt.getFullYear(), dt.getMonth(), 1);
        const targetDay = Math.min(anchor.getDate(), endOfMonthDF(monthStart).getDate());
        const startAt = new Date(dt.getFullYear(), dt.getMonth(), targetDay, 9, 0, 0);
        const endAt = addMinutes(startAt, 30);
        out.push({
          id: `pay-${p.id}-${startAt.getTime()}`,
          title: `Pago póliza ${p.plan || ""} — ${clientName}`.trim(),
          start: startAt,
          end: endAt,
          resource: { policyId: p.id, isReminder: true, color: "amarillo" },
          color: "amarillo",
        });
      }
    }
    return out;
  }

  const visibleRows = useMemo(() => {
    const owned = filterByScope(rows, user, r => r.ownerId);
    const shared = rows.filter(r => Array.isArray(r.sharedWith) && (r.sharedWith as string[]).includes(user.id));
    const map = new Map(owned.map(x => [x.id, x]));
    for (const r of shared) map.set(r.id, r);
    return Array.from(map.values());
  }, [rows, user]);

  const events: CalendarEvent[] = useMemo(() => {
    const activityEvents: CalendarEvent[] = visibleRows.map(r => {
      const start = new Date(r.fechaHora);
      const end = r.fechaHoraFin ? new Date(r.fechaHoraFin) : addHours(start, 1);
      return ({
        id: r.id,
        title: `${r.tipo}${r.clienteId ? ` — ${visibleClients.find(c=>c.id===r.clienteId)?.nombre ?? ""}`: ""}`,
        start,
        end,
        resource: r,
        color: (r.color || "verde"),
      });
    });
    const reminderEvents = makePaymentReminders(visiblePolicies, viewRange.start, viewRange.end);
    return [...activityEvents, ...reminderEvents];
  }, [visibleRows, visibleClients, visiblePolicies, viewRange]);

  /* Toolbar estilo Apple */
  function Toolbar({ label, onNavigate, onView }: ToolbarProps) {
    return (
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-md border bg-white text-slate-700 hover:bg-slate-50" onClick={() => onNavigate('TODAY')}>Hoy</button>
          <div className="flex items-center overflow-hidden rounded-md border">
            <button className="px-3 py-1.5 bg-white hover:bg-slate-50 border-r" onClick={() => onNavigate('PREV')} aria-label="Anterior">‹</button>
            <button className="px-3 py-1.5 bg-white hover:bg-slate-50" onClick={() => onNavigate('NEXT')} aria-label="Siguiente">›</button>
          </div>
        </div>
        <div className="text-base md:text-lg font-semibold tracking-tight text-slate-800 select-none">{label}</div>
        <div className="inline-flex rounded-lg border bg-white shadow-sm overflow-hidden">
          <button className={`px-3 py-1.5 text-sm ${calView===Views.DAY ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}  onClick={() => onView(Views.DAY)}>Día</button>
          <button className={`px-3 py-1.5 text-sm border-l ${calView===Views.WEEK ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`} onClick={() => onView(Views.WEEK)}>Semana</button>
          <button className={`px-3 py-1.5 text-sm border-l ${calView===Views.MONTH ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`} onClick={() => onView(Views.MONTH)}>Mes</button>
        </div>
      </div>
    );
  }

  /* Evento con solo hora de inicio (no fin) */
  const EventCell: React.FC<{ event: CalendarEvent }> = ({ event }) => {
    const start: Date = event.start;
    const title: string = event.title;
    const time = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (calView === Views.MONTH) {
      const color = (event.color || event?.resource?.color) as keyof typeof colorMap | undefined;
      const dotColor = color ? colorMap[color] : "#0ea5e9";
      return <div className="truncate leading-tight"><span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: dotColor }} />{title}</div>;
    }
    return <div className="leading-tight"><span className="font-semibold">{time}</span> {title}</div>;
  };

  const eventPropGetter = (event: CalendarEvent) => {
    const raw = (event.color ?? (event.resource as ResourceType)?.color) as Activity["color"] | undefined;
    const key = (typeof raw === "string" ? raw.toLowerCase() : undefined) as keyof typeof colorMap | undefined;
    const bg = (key && colorMap[key]) ? colorMap[key] : "#0ea5e9";
    return { style: { backgroundColor: bg, borderColor: bg, color: "white" } };
  };

  /* Crear con click en slot */
  const onSelectSlot = ({ start }: { start: Date }) => {
    const s = new Date(start);
    const e = addHours(s, 1);
    const base: ActivityWithShare = {
      id: uid(),
      ownerId: user.id,
      clienteId: (visibleClients[0]?.id ?? clients[0]?.id ?? ""),
      tipo: "Llamada",
      fechaHora: s.toISOString(),
      fechaHoraFin: e.toISOString(),
      realizada: false,
      generoCierre: false,
      color: "verde",
    };
    setDraft(base);
    setOpen(true);
  };

  /* Editar evento existente (no recordatorios) */
  const onSelectEvent = (e: CalendarEvent) => {
    if ((e.resource as ReminderResource).isReminder) {
      alert("Este es un recordatorio de pago generado automáticamente. Para cambiarlo, edita la póliza.");
      return;
    }
    const start: Date = e.start;
    const end: Date = e.end instanceof Date ? e.end : addHours(start,1);
    const resource = e.resource as ActivityWithShare;
    const base: ActivityWithShare = { ...resource, fechaHora: start.toISOString(), fechaHoraFin: (resource.fechaHoraFin ? end.toISOString() : end.toISOString()) };
    base.sharedWith = resource.sharedWith || [];
    setDraft(base);
    setOpen(true);
  };

  const saveDraft = (a: ActivityWithShare) => {
    const start = new Date(a.fechaHora);
    const end = a.fechaHoraFin ? new Date(a.fechaHoraFin) : addHours(start, 1);
    const fixed: ActivityWithShare = { ...a, fechaHora: start.toISOString(), fechaHoraFin: end > start ? end.toISOString() : addHours(start, 1).toISOString(), sharedWith: a.sharedWith || [] };
    setRows(prev => {
      const exists = prev.some(x => x.id === fixed.id);
      return exists ? prev.map(x => x.id === fixed.id ? fixed : x) : [fixed, ...prev];
    });
    setOpen(false);
    setDraft(null);
  };

  const canDelete = (a: ActivityWithShare) => a.ownerId === user.id;
  const deleteDraft = (a: ActivityWithShare) => {
    if (!canDelete(a)) {
      alert("Solo la persona que creó el evento puede eliminarlo.");
      return;
    }
    if (confirm("¿Eliminar esta actividad?")) {
      setRows(prev => prev.filter(x => x.id !== a.id));
      setOpen(false);
      setDraft(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Citas / Actividades</h2>
        <Button onClick={() => {
          setDraft({
            id: uid(),
            ownerId: user.id,
            clienteId: (visibleClients[0]?.id ?? clients[0]?.id ?? ""),
            tipo: "Llamada",
            fechaHora: new Date().toISOString(),
            fechaHoraFin: addHours(new Date(),1).toISOString(),
            realizada: false, generoCierre: false, color: "verde",
          });
          setOpen(true);
        }}>
          Nueva
        </Button>
      </div>

      <Card className="shadow">
        <CardContent className="p-2">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            selectable
            popup
            defaultView={Views.DAY}
            views={[Views.DAY, Views.WEEK, Views.MONTH]}
            view={calView}
            onView={(v: View) => setCalView(v)}
            date={calDate}
            onNavigate={(d: Date) => setCalDate(d)}
            step={30}
            timeslots={2}
            min={new Date(1970, 0, 1, 6, 0, 0)}
            max={new Date(1970, 0, 1, 22, 0, 0)}
            scrollToTime={new Date(1970, 0, 1, 8, 0, 0)}
            style={{ height: 600 }}
            eventPropGetter={eventPropGetter}
            onSelectSlot={onSelectSlot}
            onSelectEvent={onSelectEvent}
            messages={{ month: "Mes", week: "Semana", day: "Día", agenda: "Agenda", next: ">", previous: "<", today: "Hoy" }}
            formats={{
              dayFormat: (date: Date) => format(date, "eee d", { locale: es }),
              weekdayFormat: (date: Date) => format(date, "eee", { locale: es }),
              dayHeaderFormat: (date: Date) => format(date, "eeee d 'de' MMMM", { locale: es }),
              dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
                `${format(start, "d 'de' MMM", { locale: es })} – ${format(end, "d 'de' MMM", { locale: es })}`,
              monthHeaderFormat: (date: Date) => format(date, "MMMM 'de' yyyy", { locale: es }),
              timeGutterFormat: (date: Date) => format(date, "h:mm a", { locale: es }),
              eventTimeRangeFormat: () => "",  // oculta "2:30–3:30"
              eventTimeRangeStartFormat: () => "",
              eventTimeRangeEndFormat: () => "",
            }}
            components={{ event: EventCell as any, toolbar: Toolbar as any }}
            showMultiDayTimes
            drilldownView={Views.DAY}
          />
          <style jsx global>{`
            .rbc-calendar { font-size: 12px; }
            .rbc-month-view, .rbc-time-view { border: none; background: #ffffff; }
            .rbc-time-header, .rbc-time-content, .rbc-month-row, .rbc-header { border-color: #e5e7eb; }
            .rbc-header { padding: 8px 6px; font-weight: 700; color: #1f2937; background: #f9fafb; letter-spacing: -0.01em; }
            .rbc-today { background: #f3f8ff; }
            .rbc-time-gutter .rbc-timeslot-group { border-color: #edf1f7; }
            .rbc-timeslot-group { border-color: #edf1f7; }
            .rbc-time-content > * + * > * { border-left-color: #edf1f7; }
            .rbc-now.rbc-current-time-indicator { background: #ff3b30; height: 2px; }
            .rbc-event { border-radius: 10px; box-shadow: 0 1px 0 rgba(0,0,0,0.05); padding: 3px 8px; border: none; }
            .rbc-event .rbc-event-content { font-weight: 600; }
            .rbc-event .rbc-event-label { display: none; }
            .rbc-month-view .rbc-event { padding: 2px 6px; border-radius: 8px; }
            .rbc-date-cell { padding: 4px 6px; }
            /* Today in month grid: red circular badge behind day number */
            .rbc-date-cell.rbc-now { color: #111827; font-weight: 700; }
            .rbc-month-view .rbc-date-cell .rbc-button-link { color: #111827; }
            .rbc-month-view .rbc-date-cell.rbc-now .rbc-button-link {
              background: #ff3b30; color: #ffffff; border-radius: 9999px;
              min-width: 22px; height: 22px; line-height: 22px;
              display: inline-flex; align-items: center; justify-content: center;
              font-weight: 700;
            }
            .rbc-off-range-bg { background: #fafafa; }
            /* Out-of-month dates: gray only the date number, keep events normal */
            .rbc-month-view .rbc-off-range .rbc-button-link { color: #9ca3af !important; }
            /* Weekly header: small red dot next to today label */
            .rbc-time-header .rbc-header.rbc-today::after {
              content: "";
              display: inline-block; margin-left: 6px;
              width: 6px; height: 6px; background: #ff3b30; border-radius: 9999px;
              vertical-align: middle;
            }
            .rbc-day-bg:hover { background: #f5f7fb; }
            .rbc-allday-cell, .rbc-allday-events { border-color: #e5e7eb; }
          `}</style>
          <div className="flex items-center gap-3 text-xs text-neutral-600 mt-2">
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#22c55e' }}></span>Verde</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#f59e0b' }}></span>Amarillo</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#ef4444' }}></span>Rojo</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#f59e0b' }}></span>Recordatorio de pago</span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setDraft(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{draft && rows.some(r => r.id === draft.id) ? "Editar actividad" : "Nueva actividad"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <Select value={draft.tipo} onValueChange={(v) => setDraft({ ...draft!, tipo: v as Activity["tipo"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Llamada", "Cita Inicial", "Cita Cierre", "Entrega", "Seguimiento"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cliente">
                <Select value={draft.clienteId} onValueChange={(v) => setDraft({ ...draft!, clienteId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {visibleClients.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre} {c.apellidoPaterno || ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fecha y hora">
                <Input
                  type="datetime-local"
                  value={toLocalInput(draft?.fechaHora)}
                  onChange={(e) => setDraft((p) => p ? ({ ...p, fechaHora: toIsoOr(p?.fechaHora, (e.target as HTMLInputElement).value) as string }) : p)}
                />
              </Field>
              <Field label="Hora fin">
                <Input
                  type="datetime-local"
                  value={toLocalInput(draft?.fechaHoraFin || (draft?.fechaHora ? new Date(new Date(draft.fechaHora).getTime() + 60*60*1000).toISOString() : undefined))}
                  onChange={(e) => setDraft((p) => p ? ({ ...p, fechaHoraFin: toIsoOr(p?.fechaHoraFin, (e.target as HTMLInputElement).value) as string }) : p)}
                />
              </Field>
              <Field label="Color">
                <Select value={draft.color || "verde"} onValueChange={(v) => setDraft({ ...draft!, color: v as NonNullable<Activity["color"]> })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="verde">Verde</SelectItem>
                    <SelectItem value="amarillo">Amarillo</SelectItem>
                    <SelectItem value="rojo">Rojo</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {/* Compartir con */}
              {user.role !== "asesor" && (
                <div className="col-span-2">
                  <Field label="Compartir con">
                    {/* Selector de modo */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-3 md:col-span-1">
                        <Label className="text-[11px] text-neutral-500">Modo</Label>
                        <Select value={shareMode} onValueChange={(v) => {
                          const mode = v as "none"|"all"|"custom";
                          setShareMode(mode);
                          if (!draft) return;
                          if (mode === "none") {
                            setDraft({ ...draft, sharedWith: [] });
                          } else if (mode === "all") {
                            setDraft({ ...draft, sharedWith: teamUsers.map(u => u.id) });
                          }
                        }}>
                          <SelectTrigger><SelectValue placeholder="Selecciona modo"/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nadie</SelectItem>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="custom">Elegir personas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Si el modo es custom, mostramos lista filtrable */}
                      {shareMode === "custom" && (
                        <div className="col-span-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Input placeholder="Buscar usuario…" value={shareFilter} onChange={e => setShareFilter((e.target as HTMLInputElement).value)} className="h-8" />
                            <Button type="button" variant="secondary" size="sm" onClick={() => {
                              if (!draft) return;
                              setDraft({ ...draft, sharedWith: teamUsers.map(u => u.id) });
                            }}>Todos</Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => {
                              if (!draft) return;
                              setDraft({ ...draft, sharedWith: [] });
                            }}>Nadie</Button>
                          </div>
                          <div className="flex flex-wrap gap-3 p-2 border rounded-md max-h-48 overflow-auto">
                            {teamUsers
                              .filter(u => u.name.toLowerCase().includes(shareFilter.toLowerCase()))
                              .map(u => {
                                const list: string[] = draft?.sharedWith || [];
                                const checked = list.includes(u.id);
                                return (
                                  <label key={u.id} className="inline-flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      className="accent-slate-700"
                                      checked={checked}
                                      onChange={(e) => {
                                        const set = new Set<string>(list);
                                        e.currentTarget.checked ? set.add(u.id) : set.delete(u.id);
                                        setDraft({ ...draft, sharedWith: Array.from(set) });
                                      }}
                                    />
                                    <span>{u.name}</span>
                                  </label>
                                );
                              })}
                            {teamUsers.length === 0 && <div className="text-xs text-neutral-500">No hay usuarios en tu equipo.</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  </Field>
                </div>
              )}
              <Field label="Lugar"><Input value={draft.lugar || ""} onChange={e => setDraft({ ...draft!, lugar: (e.target as HTMLInputElement).value })} /></Field>
              <Field label="Notas"><Textarea value={draft.notas || ""} onChange={e => setDraft({ ...draft!, notas: (e.target as HTMLTextAreaElement).value })} /></Field>
              <Field label="Realizada">
                <Select value={draft.realizada ? "si" : "no"} onValueChange={(v) => setDraft({ ...draft!, realizada: v === "si" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="si">Sí</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="¿Generó cierre?">
                <Select value={draft.generoCierre ? "si" : "no"} onValueChange={(v) => setDraft({ ...draft!, generoCierre: v === "si" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="si">Sí</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                </Select>
              </Field>
              <div className="col-span-2 mt-2 flex gap-2">
                <Button className="flex-1" onClick={() => draft && saveDraft(draft)}>Guardar</Button>
                {draft && rows.some(r => r.id === draft.id) && canDelete(draft) && (
                  <Button variant="destructive" onClick={() => deleteDraft(draft)}>Borrar</Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}