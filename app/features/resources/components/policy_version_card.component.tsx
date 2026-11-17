"use client";

import { formatDateTime } from "@/shared/format/format_values.util";
import { useStaffName } from "@/shared/staff/use_staff_name.hook";
import type { Policy } from "@/shared/types/resources.type";
import { Badge } from "@/shared/ui/badge.component";

import { PolicyRuleSentence } from "./policy_rule_sentence.component";

/** One version of a policy: its rules in order, who approved it and when. */
export function PolicyVersionCard({ policy }: { policy: Policy }) {
  const approver_name = useStaffName(policy.approved_by);
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs font-semibold">
          {policy.policy_id} · v{policy.version}
        </span>
        {policy.is_active ? <Badge tone="positive">Active</Badge> : <Badge>Inactive</Badge>}
        <span className="text-ink-soft">
          Approved by {approver_name} · {formatDateTime(policy.created_at)}
        </span>
      </div>
      <ol className="mt-1">
        {policy.definition.rules.map((rule) => (
          <PolicyRuleSentence key={rule.id} rule={rule} />
        ))}
        <PolicyRuleSentence rule={policy.definition.default} is_default />
      </ol>
    </div>
  );
}
