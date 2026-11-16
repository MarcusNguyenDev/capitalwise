"use client";

import { useState } from "react";

import { decideCase } from "@/shared/api_client/engine_api.client";
import { describeError } from "@/shared/http/service_request.error";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import type { CaseDecisionRequest, CaseDecisionResult } from "@/shared/types/case.type";
import { useToast } from "@/shared/ui/toast.provider";

import { DECISION_LABELS } from "../constants/approval_queue.constant";

export type DecisionInput = Omit<CaseDecisionRequest, "staff_id">;

/** Submits one decision as the staff member selected in the header. */
export function useCaseDecision(case_number: string, onDecided: (decision_result: CaseDecisionResult) => void) {
  const { current_staff_id } = useCurrentStaff();
  const { showToast } = useToast();
  const [is_submitting, setIsSubmitting] = useState(false);

  const submitDecision = async (decision_input: DecisionInput) => {
    setIsSubmitting(true);
    try {
      const decision_result = await decideCase(case_number, { staff_id: current_staff_id, ...decision_input });
      showToast({
        title: `${case_number}: ${DECISION_LABELS[decision_input.decision]}`,
        description: decision_result.is_executed ? "The action was executed and the customer was notified." : "The customer was notified.",
        tone: "success",
      });
      onDecided(decision_result);
    } catch (error) {
      showToast({ title: `Could not decide ${case_number}`, description: describeError(error), tone: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return { is_submitting, submitDecision };
}
