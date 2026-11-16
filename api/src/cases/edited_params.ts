import {
  ACTION_CODES,
  ARRANGEMENT_TYPES,
  MAX_ARRANGEMENT_MONTHS,
} from '../facts/constants/action_code.constant';
import { InvalidEditedParamsError } from './errors/invalid_edited_params.error';
import { CaseRecord } from './types/case_record.type';

// "Edit and approve": staff may change only the terms of an action, never
// what it applies to. Anything else in edited_params is ignored.

function mergeRefundTerms(
  case_record: CaseRecord,
  edited_params: Record<string, unknown>,
): Record<string, unknown> {
  if (edited_params.amount === undefined) {
    return case_record.params;
  }
  const fee_amount = Number(case_record.facts.fee_amount);
  const edited_amount = edited_params.amount;
  const is_valid_amount =
    typeof edited_amount === 'number' &&
    edited_amount > 0 &&
    edited_amount <= fee_amount;
  if (!is_valid_amount) {
    throw new InvalidEditedParamsError(
      `the refund must be more than 0 and no more than the fee of ${fee_amount.toFixed(2)}.`,
    );
  }
  return { ...case_record.params, amount: edited_amount };
}

function mergeArrangementTerms(
  case_record: CaseRecord,
  edited_params: Record<string, unknown>,
): Record<string, unknown> {
  const merged_params = { ...case_record.params };
  if (edited_params.arrangement_type !== undefined) {
    if (!ARRANGEMENT_TYPES.includes(String(edited_params.arrangement_type))) {
      throw new InvalidEditedParamsError(
        `arrangement_type must be one of ${ARRANGEMENT_TYPES.join(', ')}.`,
      );
    }
    merged_params.arrangement_type = edited_params.arrangement_type;
  }
  if (edited_params.months !== undefined) {
    const edited_months = edited_params.months;
    const is_valid_months =
      Number.isInteger(edited_months) &&
      (edited_months as number) >= 1 &&
      (edited_months as number) <= MAX_ARRANGEMENT_MONTHS;
    if (!is_valid_months) {
      throw new InvalidEditedParamsError(
        `months must be a whole number from 1 to ${MAX_ARRANGEMENT_MONTHS}.`,
      );
    }
    merged_params.months = edited_months;
  }
  return merged_params;
}

export function mergeEditedParams(
  case_record: CaseRecord,
  edited_params: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!edited_params) {
    return case_record.params;
  }
  if (case_record.action_code === ACTION_CODES.REFUND_FEE) {
    return mergeRefundTerms(case_record, edited_params);
  }
  if (case_record.action_code === ACTION_CODES.HARDSHIP_REQUEST) {
    return mergeArrangementTerms(case_record, edited_params);
  }
  return case_record.params;
}
