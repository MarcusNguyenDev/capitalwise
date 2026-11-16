import { HIGH_UTILISATION_RATIO } from "../constants/resources_view.constant";

/** A count against its capacity, for example live calls against an agent's maximum. */
export function UtilisationBar({ label, used_count, capacity }: { label: string; used_count: number; capacity: number }) {
  const utilisation_ratio = capacity > 0 ? Math.min(1, used_count / capacity) : 0;
  const is_high = utilisation_ratio >= HIGH_UTILISATION_RATIO;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
        <span key={used_count} className="animate-highlight rounded px-1 font-mono font-bold tabular-nums">
          {used_count} / {capacity}
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full transition-all duration-500 ${is_high ? "bg-accent" : "bg-positive"}`}
          style={{ width: `${utilisation_ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
