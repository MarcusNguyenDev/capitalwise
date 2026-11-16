import {
  buildCaseCreatedSms,
  buildCaseDecidedSms,
} from './case_update_messages';
import { CaseMessageContext } from './types/notification.type';

function buildContext(
  overrides: Partial<CaseMessageContext>,
): CaseMessageContext {
  return {
    case_number: 'CASE-001101',
    call_id: null,
    customer_id: 'CUS-1001',
    action_code: 'REFUND_FEE',
    tier: 2,
    facts: {},
    params: {},
    response_due_on: null,
    execution_result: null,
    ...overrides,
  };
}

describe('case update SMS wording', () => {
  it('confirms an automatic card lock', () => {
    expect(
      buildCaseCreatedSms(
        buildContext({
          action_code: 'LOCK_CARD',
          tier: 1,
          execution_result: { card_last4: '4821' },
        }),
      ),
    ).toBe(
      'Your card ending 4821 has been temporarily locked. You can unlock it any time in the app.',
    );
  });

  it('acknowledges a fee refund request', () => {
    expect(buildCaseCreatedSms(buildContext({}))).toBe(
      "We've received your fee refund request (CASE-001101). You'll hear back within 4 business hours.",
    );
  });

  it('records a hardship notice with the response date and the helpline', () => {
    expect(
      buildCaseCreatedSms(
        buildContext({
          action_code: 'HARDSHIP_REQUEST',
          response_due_on: '2026-12-07',
        }),
      ),
    ).toBe(
      "We've recorded your hardship notice (CASE-001101). A specialist will respond by 7 December 2026. Free help: National Debt Helpline 1800 007 007.",
    );
  });

  it('reassures about a held payment without promising its release', () => {
    expect(
      buildCaseCreatedSms(
        buildContext({
          action_code: 'RELEASE_HELD_PAYMENT',
          tier: 3,
          facts: { held_amount: 18500 },
        }),
      ),
    ).toBe(
      'Your $18,500.00 payment is safely on hold while a specialist reviews it. We will never ask you to move money to keep it safe.',
    );
  });

  it('sends nothing for a human handover', () => {
    expect(
      buildCaseCreatedSms(
        buildContext({ action_code: 'HUMAN_CALLBACK', tier: 3 }),
      ),
    ).toBeNull();
    expect(
      buildCaseDecidedSms(
        buildContext({
          action_code: 'HUMAN_CALLBACK',
          tier: 3,
          is_approved: true,
        }),
      ),
    ).toBeNull();
  });

  it('tells the customer a refund was approved and credited', () => {
    expect(
      buildCaseDecidedSms(
        buildContext({ is_approved: true, execution_result: { amount: 15 } }),
      ),
    ).toBe('Your $15.00 fee refund has been approved and credited.');
  });

  it('tells the customer a refund was declined', () => {
    expect(buildCaseDecidedSms(buildContext({ is_approved: false }))).toBe(
      "We've reviewed your fee refund request (CASE-001101) and can't refund it this time. Reply or call us if you'd like to talk it through.",
    );
  });

  it('describes an approved hardship arrangement', () => {
    expect(
      buildCaseDecidedSms(
        buildContext({
          action_code: 'HARDSHIP_REQUEST',
          is_approved: true,
          execution_result: {
            arrangement_type: 'REPAYMENT_PAUSE',
            months: 3,
            account_nickname: 'Home loan',
            start_on: '2026-11-22',
          },
        }),
      ),
    ).toBe(
      "Your hardship request is approved: a 3-month repayment pause on your home loan from 22 November 2026. We'll write to confirm.",
    );
  });
});
