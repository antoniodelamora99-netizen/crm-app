"use client";
import { ViewMode, fmtMonthTitle } from "./calendar-utils";
import { addDays, addMonths } from "date-fns";
import { Button } from "@/components/ui/button";

type Props = {
  view: ViewMode;
  date: Date;
  onView(view: ViewMode): void;
  onDate(d: Date): void;
};

export default function CalendarToolbar({ view, date, onView, onDate }: Props) {
  const goPrev = () => {
    if (view === "day") onDate(addDays(date, -1));
    else if (view === "week") onDate(addDays(date, -7));
    else onDate(addMonths(date, -1));
  };
  const goNext = () => {
    if (view === "day") onDate(addDays(date, 1));
    else if (view === "week") onDate(addDays(date, 7));
    else onDate(addMonths(date, 1));
  };
  const today = () => onDate(new Date());

  const pill = (v: ViewMode, label: string) => (
    <Button
      key={v}
      type="button"
      variant={view === v ? "default" : "secondary"}
      onClick={() => onView(v)}
      className="h-9"
    >
      {label}
    </Button>
  );

  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={goPrev}>←</Button>
        <Button variant="outline" onClick={today}>Hoy</Button>
        <Button variant="outline" onClick={goNext}>→</Button>
      </div>
      <h2 className="text-lg font-semibold">{fmtMonthTitle(date)}</h2>
      <div className="flex items-center gap-2">
        {pill("day", "Día")}
        {pill("week", "Semana")}
        {pill("month", "Mes")}
      </div>
    </div>
  );
}
