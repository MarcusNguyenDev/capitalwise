"use client";

import { useState } from "react";

import { batchApproveCases } from "@/shared/api_client/engine_api.client";
import { formatCurrency } from "@/shared/format/format_values.util";
import { describeError } from "@/shared/http/service_request.error";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import type { BatchApproveResult, BatchGroup } from "@/shared/types/case.type";
import { Button } from "@/shared/ui/button.component";
import { Modal } from "@/shared/ui/modal.component";
import { useToast } from "@/shared/ui/toast.provider";

import { DEFAULT_APPROVE_REASON_CODE } from "../constants/approval_queue.constant";

interface BatchApproveDialogProps {
  batch_group: BatchGroup;
  onClose: () => void;
  onApproved: (batch_result: BatchApproveResult) => void;
}

function describeBatchResult(batch_result: BatchApproveResult): string {
  const failed_summary = batch_result.failed.map((failure) => `${failure.case_number}: ${failure.message}`).join(" ");
  return batch_result.failed.length === 0
    ? "Every action was executed and each customer was notified by SMS."
    : `${batch_result.failed.length} could not be approved. ${failed_summary}`;
}

export function BatchApproveDialog({ batch_group, onClose, onApproved }: BatchApproveDialogProps) {
  const { current_staff, current_staff_id } = useCurrentStaff();
  const { showToast } = useToast();
  const [is_submitting, setIsSubmitting] = useState(false);

  const approveAll = async () => {
    setIsSubmitting(true);
    try {
      const batch_result = await batchApproveCases({
        staff_id: current_staff_id,
        case_numbers: batch_group.cases.map((batch_case) => batch_case.case_number),
        reason_code: DEFAULT_APPROVE_REASON_CODE,
      });
      showToast({
        title: `${batch_result.approved.length} of ${batch_group.case_count} cases approved`,
        description: describeBatchResult(batch_result),
        tone: batch_result.failed.length === 0 ? "success" : "error",
      });
      onApproved(batch_result);
    } catch (error) {
      showToast({ title: "Batch approval failed", description: describeError(error), tone: "error" });
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={batch_group.label}
      onClose={onClose}
      width_class_name="max-w-4xl"
      footer={
        <>
          <Button onClick={onClose} disabled={is_submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={approveAll} disabled={is_submitting}>
            {is_submitting ? "Approving…" : `Approve all ${batch_group.case_count} as ${current_staff?.name ?? current_staff_id}`}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-lg text-ink-soft">
        The AI proposed each of these and policy rule <span className="font-mono font-semibold text-ink">{batch_group.matched_rule_id}</span>{" "}
        recommended approval: {batch_group.route_reason}. Your approval is recorded against every case with reason code{" "}
        <span className="font-mono font-semibold text-ink">{DEFAULT_APPROVE_REASON_CODE}</span>.
      </p>
      <table className="w-full text-left">
        <thead>
          <tr className="text-sm uppercase tracking-wide text-ink-faint">
            <th className="py-2 font-semibold">Case</th>
            <th className="py-2 font-semibold">Customer</th>
            <th className="py-2 font-semibold">Summary</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {batch_group.cases.map((batch_case) => (
            <tr key={batch_case.case_number} className="border-t border-line align-top">
              <td className="whitespace-nowrap py-2 pr-4 font-mono text-sm">{batch_case.case_number}</td>
              <td className="whitespace-nowrap py-2 pr-4 font-semibold">{batch_case.customer_name}</td>
              <td className="py-2 pr-4 text-ink-soft">{batch_case.summary}</td>
              <td className="py-2 text-right font-mono font-semibold">{formatCurrency(batch_case.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ink">
            <td colSpan={3} className="py-2 font-bold">
              Total
            </td>
            <td className="py-2 text-right font-mono font-bold">{formatCurrency(batch_group.total_amount)}</td>
          </tr>
        </tfoot>
      </table>
    </Modal>
  );
}
