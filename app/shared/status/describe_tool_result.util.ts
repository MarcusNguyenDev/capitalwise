import type { ProposalOutcome } from "@/shared/types/case.type";
import type { BadgeTone } from "@/shared/ui/badge.component";

import { PROPOSAL_OUTCOME_LABELS, PROPOSAL_OUTCOME_TONES } from "./status_wording.constant";

export interface ToolResultStatus {
  label: string;
  tone: BadgeTone;
}

/** Refusals that are part of the normal flow, said in words rather than as a bare "Refused". */
const EXPECTED_REFUSAL_STATUSES: Record<string, ToolResultStatus> = {
  IDENTITY_LEVEL_REQUIRED: { label: "Identity check needed first", tone: "attention" },
  IDENTITY_LOCKED: { label: "Identity locked", tone: "danger" },
  LEVEL_ONE_REQUIRED: { label: "Level 1 needed first", tone: "attention" },
};

function isProposalOutcome(value: unknown): value is ProposalOutcome {
  return typeof value === "string" && value in PROPOSAL_OUTCOME_LABELS;
}

function readErrorCode(tool_result: Record<string, unknown>): string | null {
  const error = tool_result.error;
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return typeof tool_result.code === "string" ? tool_result.code : null;
}

function describeIdentityAnswers(tool_result: Record<string, unknown>): ToolResultStatus | null {
  if (tool_result.is_locked === true) {
    return { label: "Locked after failed checks", tone: "danger" };
  }
  if (tool_result.is_passed === true) {
    return { label: typeof tool_result.identity_level === "number" ? `Confirmed, level ${tool_result.identity_level}` : "Confirmed", tone: "positive" };
  }
  return tool_result.is_passed === false ? { label: "Answers did not match", tone: "attention" } : null;
}

/**
 * The one status worth showing for a tool result, when it says more than
 * "done": a proposal's outcome, an identity check's result, or an expected
 * refusal. Null means the caller shows its plain done or refused badge.
 */
export function describeToolResult(tool_result: Record<string, unknown> | null | undefined): ToolResultStatus | null {
  if (!tool_result) {
    return null;
  }
  const error_code = readErrorCode(tool_result);
  if (error_code && EXPECTED_REFUSAL_STATUSES[error_code]) {
    return EXPECTED_REFUSAL_STATUSES[error_code];
  }
  if (isProposalOutcome(tool_result.outcome)) {
    return { label: PROPOSAL_OUTCOME_LABELS[tool_result.outcome], tone: PROPOSAL_OUTCOME_TONES[tool_result.outcome] };
  }
  return describeIdentityAnswers(tool_result);
}
