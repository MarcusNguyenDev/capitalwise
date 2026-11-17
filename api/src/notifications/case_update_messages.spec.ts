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
      'Your card ending 4821 has been temporarily locked. Call us any time to unlock it.',
    );
  });

  it('never sends the customer to the app', () => {
    for (const action_code of [
      'LOCK_CARD',
      'REPORT_LOST_STOLEN',
      'UNLOCK_CARD',
      'ACTIVATE_CARD',
    ]) {
      expect(
        buildCaseCreatedSms(
          buildContext({
            action_code,
            tier: 1,
            execution_result: { card_last4: '4821' },
          }),
        ),
      ).not.toMatch(/\bapp\b/i);
    }
  });

  it('tells the customer where and when the replacement card arrives', () => {
    expect(
      buildCaseCreatedSms(
        buildContext({
          action_code: 'REPLACE_CARD',
          tier: 1,
          execution_result: {
            delivery_suburb: 'Burleigh Heads',
            expected_by: '2026-11-24',
          },
        }),
      ),
    ).toBe(
      'Your replacement card is on its way to your address in Burleigh Heads and should arrive by Tuesday 24 November. Your old card is now blocked.',
    );
  });

  it('explains a fee refund declined on the spot and offers a review', () => {
    expect(
      buildCaseCreatedSms(
        buildContext({
          tier: 1,
          status: 'AUTO_DECLINED',
          facts: { fee_amount: 20, refunds_last_12m: 2 },
        }),
      ),
    ).toBe(
      "We've looked at your request to refund the $20.00 fee (CASE-001101) and can't refund it this time. If you'd like a specialist to look at it again, just call us.",
    );
  });

  it('confirms a dispute and its provisional credit', () => {
    expect(
      buildCaseCreatedSms(
        buildContext({
          action_code: 'RAISE_DISPUTE',
          tier: 1,
          execution_result: {
            amount: 264,
            merchant: 'Northshore Electronics',
            provisional_credit_txn_id: 'TXN-100500',
            provisional_credit_amount: 264,
            expected_by: '2026-11-24',
          },
        }),
      ),
    ).toBe(
      "We've lodged your dispute for $264.00 at Northshore Electronics (CASE-001101) and credited $264.00 while we investigate. We'll tell you the outcome by Tuesday 24 November.",
    );
  });

  it('confirms a payment arrangement with its end date', () => {
    expect(
      buildCaseCreatedSms(
        buildContext({
          action_code: 'PAYMENT_ARRANGEMENT',
          tier: 1,
          execution_result: {
            weeks: 4,
            account_nickname: 'Home loan',
            end_on: '2026-12-15',
          },
        }),
      ),
    ).toBe(
      'Your 4-week payment arrangement on your home loan is in place until Tuesday 15 December. Late fees are paused.',
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
