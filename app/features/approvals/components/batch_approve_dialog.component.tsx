"use client";

import { useState } from "react";

import { batchApproveCases } from "@/shared/api_client/engine_api.client";
import { formatCurrency } from "@/shared/format/format_values.util";
import { describeError } from "@/shared/http/service_request.error";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import type { BatchApproveResult, BatchGroup } from "@/shared/types/case.type";
import { Button } from "@/shared/ui/button.component";
import { DataTable } from "@/shared/ui/data_table.component";
import { Dialog } from "@/shared/ui/dialog.component";
import { useToast } from "@/shared/ui/toast.provider";

import { DEFAULT_APPROVE_REASON_CODE } from "../constants/approval_queue.constant";

interface BatchApproveDialogProps {
  batch_group: BatchGroup | null;
  onClose: () => void;
  onApproved: (batch_result: BatchApproveResult) => void;
}

type BatchCase = BatchGroup["cases"][number];

function describeBatchResult(batch_result: BatchApproveResult): string {
  const failed_summary = batch_result.failed.map((failure) => `${failure.case_number}: ${failure.message}`).join(" ");
  return batch_result.failed.length === 0
    ? "Every action was carried out and each customer was sent an SMS."
    : `${batch_result.failed.length} could not be approved. ${failed_summary}`;
}

/** Lists every case in the group before one approval is recorded against each of them. */
export function BatchApproveDialog({ batch_group, onClose, onApproved }: BatchApproveDialogProps) {
  const { current_staff, current_staff_id } = useCurrentStaff();
  const { showToast } = useToast();
  const [is_submitting, setIsSubmitting] = useState(false);

  const approveAll = async (approved_group: BatchGroup) => {
    setIsSubmitting(true);
    try {
      const batch_result = await batchApproveCases({
        staff_id: current_staff_id,
        case_numbers: approved_group.cases.map((batch_case) => batch_case.case_number),
        reason_code: DEFAULT_APPROVE_REASON_CODE,
      });
      showToast({
        title: `${batch_result.approved.length} of ${approved_group.case_count} cases approved`,
        description: describeBatchResult(batch_result),
        tone: batch_result.failed.length === 0 ? "success" : "error",
      });
      onApproved(batch_result);
    } catch (error) {
      showToast({ title: "Batch approval failed", description: describeError(error), tone: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      is_open={batch_group !== null}
      onOpenChange={(is_open) => !is_open && onClose()}
      title={batch_group?.label ?? "Batch approval"}
      width="large"
      description={
        batch_group ? (
          <>
            The AI proposed each of these and policy rule <span className="font-mono font-semibold text-ink">{batch_group.matched_rule_id}</span> recommends approval:{" "}
            {batch_group.route_reason}. Your approval is recorded on every case as “meets policy”.
          </>
        ) : null
      }
      footer={
        <>
          <Button onClick={onClose} disabled={is_submitting}>
            Cancel
          </Button>
          <Button variant="primary" is_loading={is_submitting} onClick={() => batch_group && void approveAll(batch_group)}>
            Approve all {batch_group?.case_count} as {current_staff?.name ?? current_staff_id}
          </Button>
        </>
      }
    >
      {batch_group ? (
        <DataTable<BatchCase>
          caption="Cases in this batch"
          rows={batch_group.cases}
          readRowKey={(batch_case) => batch_case.case_number}
          columns={[
            { key: "customer", header: "Customer", class_name: "whitespace-nowrap font-medium", renderCell: (batch_case) => batch_case.customer_name },
            { key: "summary", header: "Summary", class_name: "text-ink-soft", renderCell: (batch_case) => batch_case.summary },
            { key: "case", header: "Case", class_name: "whitespace-nowrap font-mono text-xs text-ink-faint", renderCell: (batch_case) => batch_case.case_number },
            { key: "amount", header: "Amount", is_numeric: true, renderCell: (batch_case) => formatCurrency(batch_case.amount) },
          ]}
          footer={
            <tr className="border-t border-line-strong">
              <td colSpan={3} className="py-2 text-sm font-semibold">
                Total
              </td>
              <td className="py-2 text-right text-sm font-semibold tabular-nums">{formatCurrency(batch_group.total_amount)}</td>
            </tr>
          }
        />
      ) : null}
    </Dialog>
  );
}
