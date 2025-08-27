import {
  addDays,
  addMinutes,
  endOfDay,
  endOfMonth,
  endOfWeek,
  formatISO,
  isAfter,
  isBefore,
  isWithinInterval,
  parseISO,
  setHours,
  setMinutes,
  startOfDay,
  startOfMonth,
  startOfWeek
} from "date-fns";
import { es } from "date-fns/locale/es";

export type ViewMode = "day" | "week" | "month";

export type CalEvent = {
  id: string;
  title: string;
  ownerId?: string;
  start: string; // ISO
  end?: string;  // ISO
  color?: string;
  meta?: Record<string, any>;
};

export function toDate(iso: string) {
  return parseISO(iso);
}

export function rangeFor(view: ViewMode, anchor: Date) {
  if (view === "day") {
    const start = startOfDay(anchor);
    const end = endOfDay(anchor);
    return { start, end };
  }
  if (view === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 1 }); // lunes
    const end = endOfWeek(anchor, { weekStartsOn: 1 });
    return { start, end };
  }
  const start = startOfMonth(anchor);
  const end = endOfMonth(anchor);
  return { start, end };
}

export function inVisibleRange(ev: CalEvent, start: Date, end: Date) {
  const s = parseISO(ev.start);
  const e = ev.end ? parseISO(ev.end) : addMinutes(s, 60);
  return isWithinInterval(s, { start, end }) || isWithinInterval(e, { start, end }) || (isBefore(s, start) && isAfter(e, end));
}

export function daysOfWeek(anchor: Date) {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
}

export function gridOfMonth(anchor: Date) {
  // 6 filas x 7 columnas
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  return Array.from({ length: 42 }).map((_, i) => addDays(start, i));
}

export function hoursFromTo(from = 6, to = 22) {
  return Array.from({ length: to - from + 1 }).map((_, i) => from + i);
}

export const fmtDayTitle = (d: Date) =>
  d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

export const fmtMonthTitle = (d: Date) =>
  d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

export function clampToHour(iso: string, fallbackHour = 9) {
  const d = parseISO(iso);
  return formatISO(setMinutes(setHours(d, d.getHours() || fallbackHour), d.getMinutes() || 0));
}
