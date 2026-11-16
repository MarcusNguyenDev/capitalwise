import { formatCodeLabel, formatLongDuration } from "@/shared/format/format_values.util";
import type { AutonomyStat } from "@/shared/types/resources.type";
import { LabelledValue } from "@/shared/ui/surface.component";

export function AutonomyStatCard({ autonomy_stat }: { autonomy_stat: AutonomyStat }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h3 className="text-xl font-bold">{formatCodeLabel(autonomy_stat.action_code)}</h3>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Staff agreed with the AI</span>
        <span className="text-3xl font-black tabular-nums">{autonomy_stat.agreement_pct}%</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${autonomy_stat.is_eligible ? "bg-positive" : "bg-ink-faint"}`}
          style={{ width: `${Math.min(100, autonomy_stat.agreement_pct)}%` }}
        />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <LabelledValue label="Decisions">
          <span className="text-lg font-bold tabular-nums">{autonomy_stat.decided_cases}</span>
        </LabelledValue>
        <LabelledValue label="Edited">
          <span className="text-lg font-bold tabular-nums">{autonomy_stat.edited_count}</span>
        </LabelledValue>
        <LabelledValue label="Time to decide">
          <span className="text-lg font-bold tabular-nums">{formatLongDuration(autonomy_stat.avg_minutes_to_decision * 60)}</span>
        </LabelledValue>
      </div>
      {autonomy_stat.is_eligible ? null : <p className="mt-4 border-t border-line pt-3 text-ink-soft">{autonomy_stat.headline}</p>}
    </section>
  );
}
