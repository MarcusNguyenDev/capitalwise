import { formatCodeLabel, formatDateTime } from "@/shared/format/format_values.util";
import type { CasePack } from "@/shared/types/case.type";

import { DECISION_LABELS } from "../constants/approval_queue.constant";

import { ExecutionResultList } from "./execution_result_list.component";

function findReasonLabel(case_pack: CasePack): string {
  const reason_code = case_pack.case.decision_reason_code;
  const all_reason_codes = [...case_pack.reason_codes.approve, ...case_pack.reason_codes.reject];
  return all_reason_codes.find((each_reason) => each_reason.code === reason_code)?.label ?? formatCodeLabel(reason_code);
}

/** Replaces the decision buttons once a case is decided: who decided, what was executed, what the customer was told. */
export function CaseOutcome({ case_pack, execution_result }: { case_pack: CasePack; execution_result: Record<string, unknown> | null }) {
  const engine_case = case_pack.case;
  const is_rejected = engine_case.decision === "REJECTED";
  const customer_messages = case_pack.notifications.filter((notification) => notification.channel === "SMS");
  const latest_message = customer_messages.reduce<(typeof customer_messages)[number] | null>(
    (latest, notification) => (latest === null || notification.created_at > latest.created_at ? notification : latest),
    null,
  );
  return (
    <div className={`animate-slide-in rounded-2xl border-2 p-5 ${is_rejected ? "border-accent bg-accent-soft" : "border-positive bg-positive-soft"}`}>
      <p className={`text-2xl font-black ${is_rejected ? "text-accent" : "text-positive"}`}>
        {is_rejected ? "✕" : "✓"} {DECISION_LABELS[engine_case.decision ?? ""] ?? formatCodeLabel(engine_case.status)}
        {engine_case.status === "EXECUTED" && !is_rejected ? ", then executed" : ""}
      </p>
      <p className="mt-1 text-lg">
        {engine_case.decided_by_name ?? "Staff"} · {findReasonLabel(case_pack)} · {formatDateTime(engine_case.decided_at)}
      </p>
      {execution_result ? <ExecutionResultList execution_result={execution_result} /> : null}
      {latest_message ? (
        <p className="mt-3 rounded-xl bg-white px-4 py-3">
          <span className="block text-sm font-semibold uppercase tracking-wide text-ink-faint">SMS sent to the customer</span>
          {latest_message.body}
        </p>
      ) : null}
    </div>
  );
}
