import { formatFactValue } from "@/shared/format/format_values.util";
import type { EvaluatedCondition } from "@/shared/types/case.type";

import { describeFact, describeOperator } from "./describe_policy.util";

function PassFailMark({ has_passed }: { has_passed: boolean }) {
  return has_passed ? (
    <span className="inline-flex items-center gap-1 font-semibold text-positive">✓ Pass</span>
  ) : (
    <span className="inline-flex items-center gap-1 font-semibold text-accent">✕ Fail</span>
  );
}

/** Every condition of one policy rule: what the rule expects, the actual value, pass or fail. */
export function RuleConditionTable({ conditions }: { conditions: EvaluatedCondition[] }) {
  if (conditions.length === 0) {
    return <p className="text-ink-soft">No conditions. This is the fallback when no other rule matches.</p>;
  }
  return (
    <table className="w-full text-left">
      <thead>
        <tr className="text-sm uppercase tracking-wide text-ink-faint">
          <th className="py-1.5 font-semibold">Condition</th>
          <th className="py-1.5 font-semibold">Policy expects</th>
          <th className="py-1.5 font-semibold">Actual value</th>
          <th className="py-1.5 text-right font-semibold">Result</th>
        </tr>
      </thead>
      <tbody>
        {conditions.map((condition, condition_index) => (
          <tr key={`${condition_index}:${condition.fact}`} className="border-t border-line">
            <td className="py-2 pr-4 font-medium first-letter:uppercase">{describeFact(condition.fact)}</td>
            <td className="py-2 pr-4 font-mono text-[0.95rem]">
              {describeOperator(condition.op)} {formatFactValue(condition.expected)}
            </td>
            <td className="py-2 pr-4 font-mono text-[0.95rem] font-semibold">{formatFactValue(condition.actual)}</td>
            <td className="py-2 text-right">
              <PassFailMark has_passed={condition.passed} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
