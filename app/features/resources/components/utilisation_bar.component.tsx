import { joinClassNames } from "@/shared/ui/join_class_names.util";

import { HIGH_UTILISATION_RATIO } from "../constants/resources_view.constant";

/** A count against its capacity, for example live calls against an agent's maximum. */
export function UtilisationBar({ label, used_count, capacity }: { label: string; used_count: number; capacity: number }) {
  const utilisation_ratio = capacity > 0 ? Math.min(1, used_count / capacity) : 0;
  const is_high = utilisation_ratio >= HIGH_UTILISATION_RATIO;
  return (
    <div className="flex min-w-32 items-center gap-2" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={used_count}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
        <div className={joinClassNames("h-full rounded-full transition-all duration-500", is_high ? "bg-warning" : "bg-positive")} style={{ width: `${utilisation_ratio * 100}%` }} />
      </div>
      <span key={used_count} className="animate-highlight rounded px-0.5 text-xs tabular-nums text-ink-soft">
        {used_count} / {capacity}
      </span>
    </div>
  );
}
