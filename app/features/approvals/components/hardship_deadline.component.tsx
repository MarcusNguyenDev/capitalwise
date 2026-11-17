import { CalendarClock } from "lucide-react";

import { formatCalendarDate } from "@/shared/format/format_values.util";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function countDaysUntil(calendar_date: string, current_time_ms: number): number {
  return Math.ceil((new Date(`${calendar_date.slice(0, 10)}T23:59:59`).getTime() - current_time_ms) / MS_PER_DAY);
}

/** A hardship notice must be answered within 21 days of being received. */
export function HardshipDeadline({ response_due_on, current_time_ms }: { response_due_on: string; current_time_ms: number | null }) {
  const days_left = current_time_ms === null ? null : Math.max(0, countDaysUntil(response_due_on, current_time_ms));
  return (
    <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
      <CalendarClock className="size-5 shrink-0 text-warning" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-semibold text-warning">Hardship notice: respond by {formatCalendarDate(response_due_on)}.</span>{" "}
        <span className="text-ink-soft">The customer must get a decision within 21 days of giving notice.</span>
      </p>
      {days_left === null ? null : (
        <p className="shrink-0 text-right font-semibold tabular-nums text-warning">
          {days_left} {days_left === 1 ? "day" : "days"} left
        </p>
      )}
    </div>
  );
}
