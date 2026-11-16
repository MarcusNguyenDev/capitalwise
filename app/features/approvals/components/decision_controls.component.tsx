"use client";

import { useState } from "react";

import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import type { CaseDecision, CaseDecisionResult, CasePack, ReasonCode } from "@/shared/types/case.type";
import { Button } from "@/shared/ui/button.component";

import { DEFAULT_APPROVE_REASON_CODE, DEFAULT_EDIT_REASON_CODE } from "../constants/approval_queue.constant";
import { EDITABLE_ACTION_CODES } from "../constants/editable_params.constant";
import { useCaseDecision } from "../hooks/use_case_decision.hook";
import { buildInitialEditedParams } from "../utils/read_case_params.util";

import { EditParamsFields } from "./edit_params_fields.component";

const CONFIRM_LABELS: Record<CaseDecision, string> = {
  APPROVED: "Confirm approval",
  EDITED_AND_APPROVED: "Approve with edited terms",
  REJECTED: "Confirm rejection",
};

function pickDefaultReasonCode(decision: CaseDecision, reason_codes: ReasonCode[]): string {
  const preferred_code = decision === "EDITED_AND_APPROVED" ? DEFAULT_EDIT_REASON_CODE : DEFAULT_APPROVE_REASON_CODE;
  return reason_codes.find((reason_code) => reason_code.code === preferred_code)?.code ?? reason_codes[0]?.code ?? "";
}

export function DecisionControls({ case_pack, onDecided }: { case_pack: CasePack; onDecided: (decision_result: CaseDecisionResult) => void }) {
  const engine_case = case_pack.case;
  const { current_staff } = useCurrentStaff();
  const { is_submitting, submitDecision } = useCaseDecision(engine_case.case_number, onDecided);
  const [chosen_decision, setChosenDecision] = useState<CaseDecision | null>(null);
  const [reason_code, setReasonCode] = useState("");
  const [edited_params, setEditedParams] = useState(() => buildInitialEditedParams(engine_case));
  const can_edit = EDITABLE_ACTION_CODES.includes(engine_case.action_code);

  const listReasonCodes = (decision: CaseDecision) => (decision === "REJECTED" ? case_pack.reason_codes.reject : case_pack.reason_codes.approve);

  const chooseDecision = (decision: CaseDecision) => {
    setChosenDecision(decision);
    setReasonCode(pickDefaultReasonCode(decision, listReasonCodes(decision)));
  };

  const confirmDecision = () => {
    if (!chosen_decision) {
      return;
    }
    void submitDecision({
      decision: chosen_decision,
      reason_code,
      edited_params: chosen_decision === "EDITED_AND_APPROVED" ? edited_params : undefined,
    });
  };

  return (
    <div className="rounded-2xl border-2 border-ink bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xl font-bold">Your decision</p>
          <p className="text-ink-soft">Deciding as {current_staff?.name ?? "the signed-in staff member"}. The customer is notified by SMS.</p>
        </div>
        <div className="flex gap-3">
          <Button variant={chosen_decision === "APPROVED" ? "primary" : "secondary"} size="large" onClick={() => chooseDecision("APPROVED")}>
            Approve
          </Button>
          {can_edit ? (
            <Button
              variant={chosen_decision === "EDITED_AND_APPROVED" ? "primary" : "secondary"}
              size="large"
              onClick={() => chooseDecision("EDITED_AND_APPROVED")}
            >
              Edit and approve
            </Button>
          ) : null}
          <Button variant={chosen_decision === "REJECTED" ? "primary" : "danger"} size="large" onClick={() => chooseDecision("REJECTED")}>
            Reject
          </Button>
        </div>
      </div>
      {chosen_decision ? (
        <div key={chosen_decision} className="mt-4 animate-slide-in space-y-4 border-t border-line pt-4">
          {chosen_decision === "EDITED_AND_APPROVED" ? (
            <EditParamsFields engine_case={engine_case} edited_params={edited_params} onChange={setEditedParams} />
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-4">
            <label className="block min-w-80">
              <span className="font-semibold">Reason code</span>
              <select
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-lg"
                value={reason_code}
                onChange={(change_event) => setReasonCode(change_event.target.value)}
              >
                {listReasonCodes(chosen_decision).map((each_reason) => (
                  <option key={each_reason.code} value={each_reason.code}>
                    {each_reason.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-3">
              <Button variant="ghost" disabled={is_submitting} onClick={() => setChosenDecision(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="large" disabled={is_submitting || !reason_code} onClick={confirmDecision}>
                {is_submitting ? "Recording…" : CONFIRM_LABELS[chosen_decision]}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
