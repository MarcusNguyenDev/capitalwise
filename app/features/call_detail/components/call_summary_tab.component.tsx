import { CallSignalBadges } from "@/shared/status/call_signal_badges.component";
import type { LiveCall } from "@/shared/types/call.type";

import { CallIdentitySummary } from "./call_identity_summary.component";
import { CallMetrics } from "./call_metrics.component";

/** The AI's running summary first, then identity, the signals and the call's measurements. */
export function CallSummaryTab({ call }: { call: LiveCall }) {
  return (
    <div className="flex flex-col gap-5 p-4">
      <section>
        <h3 className="text-xs font-semibold text-ink-faint">AI summary</h3>
        <p key={call.ai_summary} className="mt-1 animate-highlight rounded text-sm leading-relaxed">
          {call.ai_summary ?? "The AI has not summarised the call yet."}
        </p>
      </section>
      <CallIdentitySummary call={call} />
      <section>
        <h3 className="text-xs font-semibold text-ink-faint">Signals</h3>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <CallSignalBadges call={call} />
          {call.risk_level === "LOW" && (call.sentiment === "NEUTRAL" || call.sentiment === "POSITIVE") ? (
            <span className="text-sm text-ink-soft">Low risk, customer calm.</span>
          ) : null}
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold text-ink-faint">Measured on this call</h3>
        <CallMetrics metrics={call.metrics ?? {}} />
      </section>
    </div>
  );
}
