"use client";
import { CalEvent, gridOfMonth, toDate } from "./calendar-utils";

type Props = {
  anchor: Date; // cualquier dia del mes visible
  events: CalEvent[];
  onEventClick?: (ev: CalEvent) => void;
  onSlotClick?: (d: Date) => void;
};

export default function MonthGrid({ anchor, events, onEventClick, onSlotClick }: Props) {
  const days = gridOfMonth(anchor);
  const today = new Date();
  const inSameDay = (d: Date, ev: CalEvent) => {
    const s = toDate(ev.start);
    return (
      s.getFullYear() === d.getFullYear() &&
      s.getMonth() === d.getMonth() &&
      s.getDate() === d.getDate()
    );
  };

  return (
    <div className="grid grid-cols-7 border rounded-md overflow-hidden bg-white">
      {days.map((d, idx) => {
        const dayEvents = events.filter((ev) => inSameDay(d, ev));
        return (
          <div
            key={idx}
            className="border-r border-b min-h-[110px] p-2"
            onDoubleClick={() =>
              onSlotClick?.(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0))
            }
          >
            {(() => {
              const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
              const isOutside = d.getMonth() !== anchor.getMonth();
              const baseNum = (
                <span
                  className={
                    `inline-flex items-center justify-center w-6 h-6 rounded-full select-none ` +
                    (isToday ? `bg-red-500 text-white font-semibold` : isOutside ? `text-neutral-400` : `text-neutral-900`)
                  }
                >
                  {d.getDate()}
                </span>
              );
              return <div className="text-xs font-medium mb-1">{baseNum}</div>;
            })()}
            <div className="flex flex-col gap-1">
              {dayEvents.slice(0, 4).map((ev) => (
                <div
                  key={ev.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onEventClick?.(ev)}
                  className="text-[11px] px-2 py-1 rounded text-white cursor-pointer"
                  style={{ background: ev.color || "#7c3aed" }}
                >
                  {ev.title}
                </div>
              ))}
              {dayEvents.length > 4 && (
                <div className="text-[11px] text-muted-foreground">
                  +{dayEvents.length - 4} más
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
