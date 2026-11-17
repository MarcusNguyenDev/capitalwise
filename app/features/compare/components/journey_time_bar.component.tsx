import { formatLongDuration } from "@/shared/format/format_values.util";
import type { Journey } from "@/shared/types/resources.type";

import { JOURNEY_SIDE_STYLES } from "../constants/journey_side.constant";
import type { JourneySide } from "../constants/journey_side.constant";

interface JourneyTimeBarProps {
  journey: Journey;
  side: JourneySide;
  longest_total_seconds: number;
}

/** One journey's total time, drawn to the same scale as the other journey and split by step. */
export function JourneyTimeBar({ journey, side, longest_total_seconds }: JourneyTimeBarProps) {
  const side_style = JOURNEY_SIDE_STYLES[side];
  const bar_width_percent = longest_total_seconds > 0 ? (journey.total_seconds / longest_total_seconds) * 100 : 0;
  const counted_steps = journey.steps.filter((journey_step) => !journey_step.is_optional_path);
  return (
    <div className="grid grid-cols-[minmax(8rem,14rem)_1fr_5rem] items-center gap-4">
      <p className="text-sm font-medium">{journey.title}</p>
      <div className="h-5" aria-hidden>
        <div className="flex h-full animate-fade-in gap-0.5 overflow-hidden rounded" style={{ width: `${Math.max(bar_width_percent, 1)}%` }}>
          {counted_steps.map((journey_step, step_index) => (
            <div
              key={journey_step.label}
              title={`${journey_step.label}: ${formatLongDuration(journey_step.duration_seconds)}`}
              className={side_style.segment_class_names[step_index % 2]}
              style={{ flexGrow: Math.max(journey_step.duration_seconds, 0.001), flexBasis: 0 }}
            />
          ))}
        </div>
      </div>
      <p className="text-right font-semibold tabular-nums">{formatLongDuration(journey.total_seconds)}</p>
    </div>
  );
}
