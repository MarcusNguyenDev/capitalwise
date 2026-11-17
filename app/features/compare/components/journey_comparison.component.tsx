"use client";

import { fetchJourneyComparison } from "@/shared/api_client/engine_api.client";
import { formatLongDuration } from "@/shared/format/format_values.util";
import { LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { JourneyComparison as JourneyComparisonData } from "@/shared/types/resources.type";
import { Card } from "@/shared/ui/card.component";
import { ErrorState } from "@/shared/ui/error_state.component";
import { PageHeader } from "@/shared/ui/page_header.component";
import { SkeletonDetail } from "@/shared/ui/skeleton.component";

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

/** Before and after: today's phone banking journey against the AI specialist, with measured numbers. */
export function JourneyComparison() {
  const comparison_query = useLiveQuery(fetchJourneyComparison, [LIVE_EVENT.CALL_ENDED]);
  const comparison = comparison_query.data;
  const speed_up = comparison ? describeSpeedUp(comparison) : null;
  const longest_total_seconds = comparison ? Math.max(comparison.legacy_journey.total_seconds, comparison.ai_journey.total_seconds) : 0;

  return (
    <>
      <PageHeader
        title="Before and after"
        description="The same request, two journeys. Today the customer does all the work and is sent to an app; with an AI specialist the call is resolved."
        actions={
          speed_up && comparison ? (
            <p className="text-right">
              <span className="block text-2xl font-semibold tabular-nums text-accent">{speed_up}</span>
              <span className="text-sm text-ink-soft">
                {formatLongDuration(comparison.legacy_journey.total_seconds)} down to {formatLongDuration(comparison.ai_journey.total_seconds)}
              </span>
            </p>
          ) : null
        }
      />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-6">
        {comparison_query.error_message ? <ErrorState message={comparison_query.error_message} onRetry={comparison_query.reload} /> : null}
        {!comparison && !comparison_query.error_message ? <SkeletonDetail label="Loading the comparison" /> : null}
        {comparison ? (
          <>
            <Card title="Total time, to the same scale">
              <div className="flex flex-col gap-3">
                <JourneyTimeBar journey={comparison.legacy_journey} side="LEGACY" longest_total_seconds={longest_total_seconds} />
                <JourneyTimeBar journey={comparison.ai_journey} side="AI" longest_total_seconds={longest_total_seconds} />
              </div>
            </Card>
            <div className="grid gap-5 lg:grid-cols-2">
              <JourneyColumn journey={comparison.legacy_journey} side="LEGACY" />
              <JourneyColumn journey={comparison.ai_journey} side="AI" />
            </div>
            <MeasuredNumbers measured={comparison.measured} />
          </>
        ) : null}
      </div>
    </>
  );
}
