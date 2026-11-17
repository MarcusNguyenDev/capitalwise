import { ArrowLeft } from "lucide-react";

import { formatCodeLabel } from "@/shared/format/format_values.util";
import { CareFlagBadge } from "@/shared/status/care_flag_badge.component";
import { CaseStatusBadge } from "@/shared/status/case_status_badge.component";
import { TierBadge } from "@/shared/status/tier_badge.component";
import type { EngineCase } from "@/shared/types/case.type";
import { IconButton } from "@/shared/ui/icon_button.component";

import { AWAITING_DECISION_STATUSES } from "../constants/approval_queue.constant";
import { SlaCountdown } from "./sla_countdown.component";

interface CasePackHeaderProps {
  engine_case: EngineCase;
  current_time_ms: number | null;
  onClose: () => void;
}

export function CasePackHeader({ engine_case, current_time_ms, onClose }: CasePackHeaderProps) {
  const is_awaiting_decision = AWAITING_DECISION_STATUSES.includes(engine_case.status);
  return (
    <header className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-line bg-white px-5 py-3.5">
      <IconButton label="Back to the queue" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={onClose} className="lg:hidden" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{engine_case.customer_name}</h2>
          <TierBadge tier={engine_case.tier} />
          <CaseStatusBadge status={engine_case.status} />
          {engine_case.has_care_flag || engine_case.facts.has_care_flag === true ? <CareFlagBadge /> : null}
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          {engine_case.action_description} · {formatCodeLabel(engine_case.risk_class)} risk · <span className="font-mono text-xs">{engine_case.case_number}</span>
        </p>
      </div>
      <div className="text-right text-sm">
        {is_awaiting_decision ? <SlaCountdown sla_due_at={engine_case.sla_due_at} current_time_ms={current_time_ms} /> : null}
        {/* Tier 1 cases are decided by policy on the call, so nobody was routed. */}
        {engine_case.tier === 1 && !engine_case.assigned_staff_name ? null : (
          <p className="text-ink-soft">
            Routed to <span className="font-medium text-ink">{engine_case.assigned_staff_name ?? "the team queue"}</span>
          </p>
        )}
        {engine_case.routing_rule ? <p className="max-w-xs text-xs text-ink-faint">{engine_case.routing_rule}</p> : null}
      </div>
    </header>
  );
}
