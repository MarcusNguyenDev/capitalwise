import { formatMilliseconds } from "@/shared/format/format_values.util";
import type { JourneyComparison } from "@/shared/types/resources.type";

const COST_FORMATTER = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 3 });

function formatCost(cost_usd: number | null): string {
  return cost_usd === null ? "–" : `US${COST_FORMATTER.format(cost_usd)}`;
}

function MeasuredNumber({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white px-5 py-2.5">
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="font-semibold leading-tight text-ink-soft">{label}</p>
    </div>
  );
}

/** Averages taken from the calls actually run in this demo, not from a slide. */
export function MeasuredNumbers({ measured }: { measured: JourneyComparison["measured"] }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold">Measured on real demo calls</h2>
        <p className="text-lg text-ink-soft">
          Averages over {measured.sample_call_count} {measured.sample_call_count === 1 ? "call" : "calls"} handled by the AI specialist
        </p>
      </div>
      <div className="grid grid-cols-5 gap-4">
        <MeasuredNumber label="AI response time" value={formatMilliseconds(measured.avg_response_ms)} />
        <MeasuredNumber label="Time to confirm identity" value={formatMilliseconds(measured.avg_time_to_identity_ms)} />
        <MeasuredNumber label="Time to resolution" value={formatMilliseconds(measured.avg_time_to_resolution_ms)} />
        <MeasuredNumber label="Time to a human, when asked" value={formatMilliseconds(measured.avg_time_to_human_ms)} />
        <MeasuredNumber label="Cost per call" value={formatCost(measured.avg_cost_usd)} />
      </div>
    </section>
  );
}
