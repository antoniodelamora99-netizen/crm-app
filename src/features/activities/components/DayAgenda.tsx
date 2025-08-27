"use client";
import { CalEvent, hoursFromTo, toDate } from "./calendar-utils";
import { format } from "date-fns";

type Props = {
  date: Date;
  events: CalEvent[];
  onEventClick?: (ev: CalEvent) => void;
  onSlotClick?: (d: Date) => void;
};

export default function DayAgenda({ date, events, onEventClick, onSlotClick }: Props) {
  const hrs = hoursFromTo(6, 22);

  const eventsOfHour = (h: number) =>
    events.filter(ev => {
      const s = toDate(ev.start);
      const e = ev.end ? toDate(ev.end) : new Date(s.getTime() + 60 * 60000);
      return s.getHours() <= h && e.getHours() > h && s.toDateString() === date.toDateString();
    });

  return (
    <div className="grid grid-cols-[80px_1fr]">
      <div />
      <div className="border rounded-md bg-white overflow-hidden">
        {hrs.map(h => (
          <div key={h} className="relative border-b min-h-[56px]" onDoubleClick={() => onSlotClick?.(new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, 0))}>
            <div className="absolute left-2 top-1 text-xs text-muted-foreground">{`${h}:00`}</div>
            <div className="pl-20 pr-2 py-2 flex gap-2 flex-wrap">
              {eventsOfHour(h).map(ev => (
                <div key={ev.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onEventClick?.(ev)}
                  className="px-2 py-1 rounded text-xs text-white cursor-pointer"
                  style={{ background: ev.color || "#7c3aed" }}>
                  <div className="font-medium">{ev.title}</div>
                  <div className="opacity-80">
                    {format(toDate(ev.start), "p")}  {ev.end ? format(toDate(ev.end), "p") : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
