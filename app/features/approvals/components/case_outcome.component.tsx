import { CircleCheck, CircleX, MessageSquareText } from "lucide-react";

import { formatCodeLabel, formatDateTime } from "@/shared/format/format_values.util";
import type { CasePack } from "@/shared/types/case.type";
import { joinClassNames } from "@/shared/ui/join_class_names.util";

import { DECISION_LABELS } from "../constants/approval_queue.constant";
import { ExecutionResultList } from "./execution_result_list.component";

function findReasonLabel(case_pack: CasePack): string {
  const reason_code = case_pack.case.decision_reason_code;
  const all_reason_codes = [...case_pack.reason_codes.approve, ...case_pack.reason_codes.reject];
  return all_reason_codes.find((each_reason) => each_reason.code === reason_code)?.label ?? formatCodeLabel(reason_code);
}

/** Replaces the decision buttons once a case is decided: who decided, what was carried out, what the customer was told. */
export function CaseOutcome({ case_pack, execution_result }: { case_pack: CasePack; execution_result: Record<string, unknown> | null }) {
  const engine_case = case_pack.case;
  const is_rejected = engine_case.decision === "REJECTED";
  const Icon = is_rejected ? CircleX : CircleCheck;
  const customer_messages = case_pack.notifications.filter((notification) => notification.channel === "SMS");
  const latest_message = customer_messages.reduce<(typeof customer_messages)[number] | null>(
    (latest, notification) => (latest === null || notification.created_at > latest.created_at ? notification : latest),
    null,
  );
  return (
    <div role="status" className={joinClassNames("animate-slide-in rounded-lg border px-4 py-3", is_rejected ? "border-line bg-canvas" : "border-positive/30 bg-positive-soft")}>
      <p className={joinClassNames("flex items-center gap-2 font-semibold", is_rejected ? "text-ink" : "text-positive")}>
        <Icon className="size-5" aria-hidden />
        {engine_case.decision ? DECISION_LABELS[engine_case.decision] : formatCodeLabel(engine_case.status)}
        {engine_case.status === "EXECUTED" && !is_rejected ? " and carried out" : ""}
      </p>
      <p className="mt-0.5 text-sm text-ink-soft">
        {engine_case.decided_by_name ?? "Staff"} · {findReasonLabel(case_pack)} · {formatDateTime(engine_case.decided_at)}
      </p>
      {execution_result ? <ExecutionResultList execution_result={execution_result} /> : null}
      {latest_message ? (
        <p className="mt-3 flex gap-2 rounded-md bg-white px-3 py-2 text-sm">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
          <span>
            <span className="block text-xs font-semibold text-ink-faint">SMS sent to the customer</span>
            {latest_message.body}
          </span>
        </p>
      ) : null}
    </div>
  );
}
