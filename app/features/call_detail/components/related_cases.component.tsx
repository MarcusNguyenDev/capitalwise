import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";

import { formatCalendarDate } from "@/shared/format/format_values.util";
import { formatConfidence } from "@/shared/policy/describe_policy.util";
import { CaseStatusBadge } from "@/shared/status/case_status_badge.component";
import { formatActionLabel } from "@/shared/status/format_action_label.util";
import { RECOMMENDATION_LABELS } from "@/shared/status/status_wording.constant";
import { TierBadge } from "@/shared/status/tier_badge.component";
import type { EngineCase } from "@/shared/types/case.type";
import { EmptyState } from "@/shared/ui/empty_state.component";
import { SkeletonList } from "@/shared/ui/skeleton.component";

function describeHandler(engine_case: EngineCase): string {
  if (engine_case.tier === 1) {
    return "Done automatically, no staff needed";
  }
  return engine_case.assigned_staff_name ? `Assigned to ${engine_case.assigned_staff_name}` : "Waiting for a specialist";
}

function RelatedCaseCard({ engine_case }: { engine_case: EngineCase }) {
  const is_awaiting_decision = engine_case.status === "PENDING_APPROVAL" || engine_case.status === "ESCALATED";
  return (
    <li className="animate-slide-in rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">{formatActionLabel(engine_case.action_code)}</span>
        <TierBadge tier={engine_case.tier} />
        <CaseStatusBadge status={engine_case.status} />
      </div>
      <p className="mt-1 text-sm text-ink-soft">{engine_case.summary}</p>
      <p className="mt-2 text-sm">
        {RECOMMENDATION_LABELS[engine_case.recommendation]} ({formatConfidence(engine_case.confidence)}), decided by policy rule{" "}
        <span className="font-mono text-xs font-semibold">{engine_case.matched_rule_id}</span>.
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        {describeHandler(engine_case)} · {engine_case.case_number}
        {engine_case.response_due_on ? ` · respond by ${formatCalendarDate(engine_case.response_due_on)}` : ""}
      </p>
      <Link
        href={is_awaiting_decision ? `/approvals?case=${engine_case.case_number}` : `/audit/decisions?case=${engine_case.case_number}`}
        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-info hover:underline"
      >
        {is_awaiting_decision ? "Open the case pack" : "See why it was decided"}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </li>
  );
}

/** Case packs raised on this call, kept current as policy routes them and staff decide them. */
export function RelatedCases({ related_cases, is_loading }: { related_cases: EngineCase[]; is_loading: boolean }) {
  if (is_loading && related_cases.length === 0) {
    return <SkeletonList row_count={2} label="Loading cases" />;
  }
  if (related_cases.length === 0) {
    return <EmptyState icon={<FileText aria-hidden />} title="No case on this call yet" description="When the AI proposes an action, its case pack appears here." />;
  }
  return (
    <ul className="flex flex-col gap-2 p-4">
      {related_cases.map((engine_case) => (
        <RelatedCaseCard key={engine_case.case_number} engine_case={engine_case} />
      ))}
    </ul>
  );
}
