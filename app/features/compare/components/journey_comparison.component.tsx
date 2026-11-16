"use client";

import { fetchJourneyComparison } from "@/shared/api_client/engine_api.client";
import { formatLongDuration } from "@/shared/format/format_values.util";
import { LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { JourneyComparison as JourneyComparisonData } from "@/shared/types/resources.type";
import { ErrorState, LoadingState } from "@/shared/ui/surface.component";

import { JourneyColumn } from "./journey_column.component";
import { JourneyTimeBar } from "./journey_time_bar.component";
import { MeasuredNumbers } from "./measured_numbers.component";

function describeSpeedUp(comparison: JourneyComparisonData): string | null {
  const { legacy_journey, ai_journey } = comparison;
  if (ai_journey.total_seconds <= 0 || legacy_journey.total_seconds <= ai_journey.total_seconds) {
    return null;
  }
  const speed_ratio = legacy_journey.total_seconds / ai_journey.total_seconds;
  return `${speed_ratio >= 10 ? Math.round(speed_ratio) : speed_ratio.toFixed(1)}x faster`;
}

function ComparisonHeadline({ comparison }: { comparison: JourneyComparisonData }) {
  const speed_up = describeSpeedUp(comparison);
  return (
    <div className="flex items-end justify-between gap-8">
      <div>
        <h1 className="text-4xl font-black tracking-tight">
          Resolve, <span className="text-accent">don&apos;t deflect.</span>
        </h1>
        <p className="mt-1 max-w-5xl text-xl text-ink-soft">
          The same request, two journeys. Today the customer does all the work and is sent to an app. With an AI specialist the call is finished.
        </p>
      </div>
      {speed_up ? (
        <p className="shrink-0 text-right">
          <span className="block text-5xl font-black tabular-nums text-accent">{speed_up}</span>
          <span className="text-lg font-semibold text-ink-soft">
            {formatLongDuration(comparison.legacy_journey.total_seconds)} down to {formatLongDuration(comparison.ai_journey.total_seconds)}
          </span>
        </p>
      ) : null}
    </div>
  );
}

export function JourneyComparison() {
  const comparison_query = useLiveQuery(fetchJourneyComparison, [LIVE_EVENT.CALL_ENDED]);
  const comparison = comparison_query.data;

  if (!comparison) {
    return comparison_query.error_message ? <ErrorState message={comparison_query.error_message} /> : <LoadingState label="Loading the comparison" />;
  }
  const longest_total_seconds = Math.max(comparison.legacy_journey.total_seconds, comparison.ai_journey.total_seconds);
  return (
    <div className="space-y-5">
      <ComparisonHeadline comparison={comparison} />
      <div className="space-y-2 rounded-3xl border border-line bg-white px-8 py-4">
        <JourneyTimeBar journey={comparison.legacy_journey} side="LEGACY" longest_total_seconds={longest_total_seconds} />
        <JourneyTimeBar journey={comparison.ai_journey} side="AI" longest_total_seconds={longest_total_seconds} />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <JourneyColumn journey={comparison.legacy_journey} side="LEGACY" />
        <JourneyColumn journey={comparison.ai_journey} side="AI" />
      </div>
      <MeasuredNumbers measured={comparison.measured} />
    </div>
  );
}
