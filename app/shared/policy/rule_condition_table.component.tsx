import { Check, X } from "lucide-react";

import type { EvaluatedCondition } from "@/shared/types/case.type";
import { DataTable } from "@/shared/ui/data_table.component";

import { describeActualValue, describeExpectation, describeFact } from "./describe_policy.util";

function ConditionResult({ has_passed }: { has_passed: boolean }) {
  return has_passed ? (
    <span className="inline-flex items-center gap-1 font-semibold text-positive">
      <Check className="size-4" aria-hidden />
      Met
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 font-semibold text-ink-soft">
      <X className="size-4" aria-hidden />
      Not met
    </span>
  );
}

/** Every condition of one policy rule: what the rule expects, the actual value, and whether it was met. */
export function RuleConditionTable({ conditions }: { conditions: EvaluatedCondition[] }) {
  if (conditions.length === 0) {
    return <p className="text-sm text-ink-soft">No conditions: this is the fallback when no other rule matches.</p>;
  }
  return (
    <DataTable<EvaluatedCondition>
      caption="Rule conditions"
      rows={conditions}
      readRowKey={(condition) => `${condition.rule_id ?? ""}:${condition.fact}:${condition.op}`}
      columns={[
        { key: "fact", header: "Condition", class_name: "first-letter:uppercase", renderCell: (condition) => describeFact(condition.fact) },
        {
          key: "expected",
          header: "Policy expects",
          class_name: "text-ink-soft",
          renderCell: (condition) => describeExpectation({ fact: condition.fact, op: condition.op, value: condition.expected }),
        },
        { key: "actual", header: "Actual", class_name: "font-medium", renderCell: (condition) => describeActualValue(condition.fact, condition.actual) },
        { key: "result", header: "Result", is_numeric: true, renderCell: (condition) => <ConditionResult has_passed={condition.passed} /> },
      ]}
    />
  );
}
