import { formatMilliseconds } from "@/shared/format/format_values.util";
import type { JourneyComparison } from "@/shared/types/resources.type";
import { Card } from "@/shared/ui/card.component";
import { Stat } from "@/shared/ui/stat.component";

const COST_FORMATTER = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 3 });

function formatCost(cost_usd: number | null): string {
  return cost_usd === null ? "–" : `US${COST_FORMATTER.format(cost_usd)}`;
}

/** Averages taken from the calls actually run in this demo, not from a slide. */
export function MeasuredNumbers({ measured }: { measured: JourneyComparison["measured"] }) {
  return (
    <Card
      title="Measured on real demo calls"
      description={`Averages over ${measured.sample_call_count} ${measured.sample_call_count === 1 ? "call" : "calls"} handled by the AI specialist.`}
    >
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="AI response time" value={formatMilliseconds(measured.avg_response_ms)} />
        <Stat label="Time to confirm identity" value={formatMilliseconds(measured.avg_time_to_identity_ms)} />
        <Stat label="Time to resolution" value={formatMilliseconds(measured.avg_time_to_resolution_ms)} />
        <Stat label="Time to a person, when asked" value={formatMilliseconds(measured.avg_time_to_human_ms)} />
        <Stat label="Cost per call" value={formatCost(measured.avg_cost_usd)} />
      </dl>
    </Card>
  );
}
