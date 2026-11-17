"use client";

import { useState } from "react";

import type { CaseDecision, CasePack, ReasonCode } from "@/shared/types/case.type";
import { Button } from "@/shared/ui/button.component";
import { Dialog } from "@/shared/ui/dialog.component";

import { DEFAULT_APPROVE_REASON_CODE, DEFAULT_EDIT_REASON_CODE } from "../constants/approval_queue.constant";
import type { DecisionInput } from "../hooks/use_case_decision.hook";
import { buildInitialEditedParams } from "../utils/read_case_params.util";
import { EditParamsFields } from "./edit_params_fields.component";

const DIALOG_TITLES: Record<CaseDecision, string> = {
  APPROVED: "Approve",
  EDITED_AND_APPROVED: "Edit the terms and approve",
  REJECTED: "Reject",
};

const CONFIRM_LABELS: Record<CaseDecision, string> = {
  APPROVED: "Approve",
  EDITED_AND_APPROVED: "Approve with these terms",
  REJECTED: "Reject",
};

function pickDefaultReasonCode(decision: CaseDecision, reason_codes: ReasonCode[]): string {
  const preferred_code = decision === "EDITED_AND_APPROVED" ? DEFAULT_EDIT_REASON_CODE : DEFAULT_APPROVE_REASON_CODE;
  return reason_codes.find((reason_code) => reason_code.code === preferred_code)?.code ?? reason_codes[0]?.code ?? "";
}

interface DecisionDialogProps {
  case_pack: CasePack;
  decision: CaseDecision;
  staff_name: string;
  is_submitting: boolean;
  onClose: () => void;
  onSubmit: (decision_input: DecisionInput) => void;
}

/** Confirms one decision with its reason code (and edited terms), so no single click decides a case. */
export function DecisionDialog({ case_pack, decision, staff_name, is_submitting, onClose, onSubmit }: DecisionDialogProps) {
  const engine_case = case_pack.case;
  const reason_codes = decision === "REJECTED" ? case_pack.reason_codes.reject : case_pack.reason_codes.approve;
  const [reason_code, setReasonCode] = useState(() => pickDefaultReasonCode(decision, reason_codes));
  const [edited_params, setEditedParams] = useState(() => buildInitialEditedParams(engine_case));

  return (
    <Dialog
      is_open
      onOpenChange={(is_open) => !is_open && onClose()}
      title={`${DIALOG_TITLES[decision]}: ${engine_case.customer_name}`}
      description={`Recorded as ${staff_name}. The customer is told by SMS straight away.`}
      footer={
        <>
          <Button onClick={onClose} disabled={is_submitting}>
            Cancel
          </Button>
          <Button
            data-autofocus={decision === "REJECTED" ? undefined : true}
            variant={decision === "REJECTED" ? "danger" : "primary"}
            is_loading={is_submitting}
            disabled={!reason_code}
            onClick={() =>
              onSubmit({ decision, reason_code, edited_params: decision === "EDITED_AND_APPROVED" ? edited_params : undefined })
            }
          >
            {CONFIRM_LABELS[decision]}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {decision === "EDITED_AND_APPROVED" ? <EditParamsFields engine_case={engine_case} edited_params={edited_params} onChange={setEditedParams} /> : null}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Reason</span>
          <select
            data-autofocus={decision === "REJECTED" ? true : undefined}
            className="h-9 rounded-md border border-line-strong bg-white px-2.5 text-sm"
            value={reason_code}
            onChange={(change_event) => setReasonCode(change_event.target.value)}
          >
            {reason_codes.map((each_reason) => (
              <option key={each_reason.code} value={each_reason.code}>
                {each_reason.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Dialog>
  );
}
