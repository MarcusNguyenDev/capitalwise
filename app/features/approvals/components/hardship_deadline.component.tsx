import { formatCalendarDate } from "@/shared/format/format_values.util";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function countDaysUntil(calendar_date: string, current_time_ms: number): number {
  return Math.ceil((new Date(`${calendar_date.slice(0, 10)}T23:59:59`).getTime() - current_time_ms) / MS_PER_DAY);
}

/** A hardship notice must be answered within 21 days of being received. */
export function HardshipDeadline({ response_due_on, current_time_ms }: { response_due_on: string; current_time_ms: number | null }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-warning bg-warning-soft px-5 py-3">
      <div>
        <p className="text-lg font-bold text-warning">Hardship notice: respond by {formatCalendarDate(response_due_on)}</p>
        <p className="text-ink-soft">The customer must receive a decision within 21 days of giving notice.</p>
      </div>
      {current_time_ms === null ? null : (
        <p className="shrink-0 text-right">
          <span className="block text-3xl font-black tabular-nums text-warning">{Math.max(0, countDaysUntil(response_due_on, current_time_ms))}</span>
          <span className="text-sm font-semibold uppercase tracking-wide text-ink-soft">days left</span>
        </p>
      )}
    </div>
  );
}
