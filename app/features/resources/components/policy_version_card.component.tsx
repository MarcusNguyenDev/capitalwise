"use client";

import { formatDateTime } from "@/shared/format/format_values.util";
import { useStaffName } from "@/shared/staff/use_staff_name.hook";
import type { Policy } from "@/shared/types/resources.type";
import { Chip } from "@/shared/ui/chip.component";

import { PolicyRuleSentence } from "./policy_rule_sentence.component";

export function PolicyVersionCard({ policy }: { policy: Policy }) {
  const approver_name = useStaffName(policy.approved_by);
  return (
    <div className={`rounded-xl border px-5 py-4 ${policy.is_active ? "border-ink bg-white" : "border-line bg-surface"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-lg font-bold">
          {policy.policy_id} · v{policy.version}
        </span>
        {policy.is_active ? <Chip tone="positive">Active</Chip> : <Chip>Inactive</Chip>}
        <span className="text-ink-soft">
          Approved by {approver_name} · {formatDateTime(policy.created_at)}
        </span>
      </div>
      <ol className="mt-2">
        {policy.definition.rules.map((rule) => (
          <PolicyRuleSentence key={rule.id} rule={rule} />
        ))}
        <PolicyRuleSentence rule={policy.definition.default} is_default />
      </ol>
    </div>
  );
}
