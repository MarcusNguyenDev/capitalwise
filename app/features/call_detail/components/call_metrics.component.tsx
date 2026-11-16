import { formatMilliseconds } from "@/shared/format/format_values.util";
import type { CallMetrics as CallMetricValues } from "@/shared/types/call.type";

const COST_FORMATTER = new Intl.NumberFormat("en-AU", { style: "currency", currency: "USD", currencyDisplay: "code", minimumFractionDigits: 3 });

function formatCost(estimated_cost_usd: number | null | undefined): string {
  return estimated_cost_usd === null || estimated_cost_usd === undefined ? "–" : COST_FORMATTER.format(estimated_cost_usd);
}

function MetricValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p key={value} className="animate-highlight rounded text-xl font-bold tabular-nums">
        {value}
      </p>
    </div>
  );
}

export function CallMetrics({ metrics }: { metrics: CallMetricValues }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <MetricValue label="Avg AI response" value={formatMilliseconds(metrics.avg_response_ms)} />
      <MetricValue label="Time to identity" value={formatMilliseconds(metrics.time_to_identity_ms)} />
      <MetricValue label="Time to a human" value={formatMilliseconds(metrics.time_to_human_ms)} />
      <MetricValue label="Estimated cost" value={formatCost(metrics.estimated_cost_usd)} />
    </div>
  );
}
