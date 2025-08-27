"use client";
import { CalEvent, daysOfWeek, hoursFromTo, toDate } from "./calendar-utils";
import { format } from "date-fns";

type Props = {
  anchor: Date; // cualquier dia de la semana visible
  events: CalEvent[];
  onEventClick?: (ev: CalEvent) => void;
  onSlotClick?: (d: Date) => void;
};

export default function WeekGrid({ anchor, events, onEventClick, onSlotClick }: Props) {
  const days = daysOfWeek(anchor);
  const hrs = hoursFromTo(6, 22);

  const eventsOfDayHour = (d: Date, h: number) =>
    events.filter(ev => {
      const s = toDate(ev.start);
      const e = ev.end ? toDate(ev.end) : new Date(s.getTime() + 60 * 60000);
      return s.getDate() === d.getDate() &&
             s.getMonth() === d.getMonth() &&
             s.getFullYear() === d.getFullYear() &&
             s.getHours() <= h && e.getHours() > h;
    });

  return (
    <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))]">
      {/* header */}
      <div />
      {days.map(d => (
        <div key={d.toISOString()} className="text-center text-sm font-medium pb-2">
          {d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric" })}
        </div>
      ))}
      {/* body */}
      {hrs.map(h => (
        <div key={`h-${h}`} className="contents">
          <div className="text-xs text-muted-foreground py-2 pr-2">{`${h}:00`}</div>
          {days.map(d => (
            <div key={`${d.toISOString()}-${h}`} className="border min-h-[56px] p-1" onDoubleClick={() => onSlotClick?.(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, 0))}>
              <div className="flex flex-col gap-1">
                {eventsOfDayHour(d, h).map(ev => (
                  <div key={ev.id} onClick={() => onEventClick?.(ev)} className="px-2 py-1 rounded text-[11px] text-white cursor-pointer" style={{ background: ev.color || "#7c3aed" }}>
                    <div className="font-medium truncate">{ev.title}</div>
                    <div className="opacity-80 truncate">
                      {format(toDate(ev.start), "p")} {ev.end ? `– ${format(toDate(ev.end), "p")}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
