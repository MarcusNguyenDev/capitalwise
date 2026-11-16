import { ACTION_CODES } from '../facts/constants/action_code.constant';
import {
  AUTO_TIER,
  ESCALATION_TIER,
} from '../policies/constants/route_tier.constant';

export interface ProposalMessageContext {
  case_number: string;
  action_code: string;
  tier: number;
  is_executed: boolean;
  staff_name: string | null;
  expected_timing: string;
  card_last4: string | null;
}

const UNNAMED_SPECIALIST = 'A specialist from our team';

// One plain sentence the AI can safely say. It states what happened and who
// has it, and never promises an outcome.
export function buildCustomerMessage(
  message_context: ProposalMessageContext,
): string {
  const { action_code, case_number, expected_timing, tier } = message_context;
  const specialist = message_context.staff_name ?? UNNAMED_SPECIALIST;
  if (action_code === ACTION_CODES.LOCK_CARD && message_context.is_executed) {
    return `Your card ending ${message_context.card_last4} is now temporarily locked. You can unlock it any time in the app.`;
  }
  if (tier === ESCALATION_TIER) {
    return action_code === ACTION_CODES.RELEASE_HELD_PAYMENT
      ? `Your payment is safely on hold for now. ${specialist} will speak with you in ${expected_timing}. Your case number is ${case_number}.`
      : `${specialist} will join you in ${expected_timing}. Your case number is ${case_number}.`;
  }
  if (tier === AUTO_TIER) {
    return `That's done. Your case number is ${case_number}.`;
  }
  if (action_code === ACTION_CODES.HARDSHIP_REQUEST) {
    return `I've recorded your hardship notice as case ${case_number}. ${specialist} will review it ${expected_timing}.`;
  }
  return `I've sent your request to our team as case ${case_number}. ${specialist} is reviewing it and you'll hear back ${expected_timing}.`;
}
