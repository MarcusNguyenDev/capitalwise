import { formatMilliseconds } from "@/shared/format/format_values.util";
import type { CallMetrics as CallMetricValues } from "@/shared/types/call.type";
import { Stat } from "@/shared/ui/stat.component";

const COST_FORMATTER = new Intl.NumberFormat("en-AU", { style: "currency", currency: "USD", currencyDisplay: "code", minimumFractionDigits: 3 });

function formatCost(estimated_cost_usd: number | null | undefined): string {
  return estimated_cost_usd === null || estimated_cost_usd === undefined ? "–" : COST_FORMATTER.format(estimated_cost_usd);
}

export function CallMetrics({ metrics }: { metrics: CallMetricValues }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      <Stat label="Avg AI response" value={formatMilliseconds(metrics.avg_response_ms)} />
      <Stat label="Time to identity" value={formatMilliseconds(metrics.time_to_identity_ms)} />
      <Stat label="Time to a person" value={formatMilliseconds(metrics.time_to_human_ms)} />
      <Stat label="Time on hold" value={formatMilliseconds(metrics.total_hold_ms ?? null)} />
      <Stat label="Estimated cost" value={formatCost(metrics.estimated_cost_usd)} />
    </dl>
  );
}
