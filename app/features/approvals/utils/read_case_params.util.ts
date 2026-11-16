import type { EngineCase } from "@/shared/types/case.type";

import { ARRANGEMENT_TYPES } from "../constants/editable_params.constant";

const DEFAULT_ARRANGEMENT_MONTHS = 3;

function readNumber(value: unknown): number | null {
  const parsed_number = typeof value === "string" ? Number(value) : value;
  return typeof parsed_number === "number" && Number.isFinite(parsed_number) ? parsed_number : null;
}

/** The dollar amount a case is about, when it has one. */
export function readCaseAmount(engine_case: EngineCase): number | null {
  return (
    readNumber(engine_case.params.amount) ?? readNumber(engine_case.facts.fee_amount) ?? readNumber(engine_case.facts.held_amount)
  );
}

export function readFeeAmount(engine_case: EngineCase): number | null {
  return readNumber(engine_case.facts.fee_amount);
}

/** Starting values for "Edit and approve": the terms the AI proposed. */
export function buildInitialEditedParams(engine_case: EngineCase): Record<string, unknown> {
  if (engine_case.action_code === "REFUND_FEE") {
    return { amount: readCaseAmount(engine_case) ?? 0 };
  }
  if (engine_case.action_code === "HARDSHIP_REQUEST") {
    return {
      arrangement_type: engine_case.params.arrangement_type ?? ARRANGEMENT_TYPES[0],
      months: readNumber(engine_case.params.months) ?? DEFAULT_ARRANGEMENT_MONTHS,
    };
  }
  return {};
}
