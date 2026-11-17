import {
  buildCustomerMessage,
  ProposalMessageContext,
  resolveProposalOutcome,
} from './proposal_messages';

function buildContext(
  overrides: Partial<ProposalMessageContext>,
): ProposalMessageContext {
  return {
    case_number: 'CASE-001105',
    action_code: 'REPLACE_CARD',
    status: 'AUTO_EXECUTED',
    matched_rule_id: 'RC-4',
    staff_name: null,
    expected_timing: 'straight away',
    facts: {},
    execution_result: null,
    ...overrides,
  };
}

describe('resolveProposalOutcome', () => {
  it.each([
    ['AUTO_EXECUTED', 'DONE'],
    ['EXECUTED', 'DONE'],
    ['AUTO_DECLINED', 'DECLINED'],
    ['REJECTED', 'DECLINED'],
    ['ESCALATED', 'WITH_SPECIALIST'],
    ['PENDING_APPROVAL', 'PENDING_REVIEW'],
  ])('%s -> %s', (status, outcome) => {
    expect(resolveProposalOutcome(status)).toBe(outcome);
  });
});

describe('buildCustomerMessage', () => {
  it('says where and when a replacement card arrives (the owner wording)', () => {
    expect(
      buildCustomerMessage(
        buildContext({
          execution_result: {
            delivery_suburb: 'Elanora',
            expected_by: '2026-11-23',
          },
        }),
      ),
    ).toBe(
      "I've ordered a replacement card. It will arrive at your address in Elanora by Monday 23 November, and your old card is now blocked.",
    );
  });

  it('confirms a refund is back in the account', () => {
    expect(
      buildCustomerMessage(
        buildContext({
          action_code: 'REFUND_FEE',
          matched_rule_id: 'RF-3',
          execution_result: {
            amount: 15,
            fee_description: 'Overdrawn fee',
            account_nickname: 'Everyday',
          },
        }),
      ),
    ).toBe(
      "I've refunded the $15.00 overdrawn fee, and it's back in your everyday account now.",
    );
  });

  it('explains a refund declined on the spot and offers a review', () => {
    expect(
      buildCustomerMessage(
        buildContext({
          action_code: 'REFUND_FEE',
          status: 'AUTO_DECLINED',
          matched_rule_id: 'RF-2',
          facts: { fee_amount: 20, refunds_last_12m: 2 },
        }),
      ),
    ).toBe(
      "I'm sorry, I can't refund the $20.00 fee, because there have already been 2 fee refunds in the last 12 months, but if you'd like, I can ask a specialist to review it.",
    );
  });

  it('says why a specialist is needed and that they have the context', () => {
    expect(
      buildCustomerMessage(
        buildContext({
          status: 'ESCALATED',
          matched_rule_id: 'RC-2',
          staff_name: 'Jordan Lee',
          expected_timing: 'about 1 minute',
        }),
      ),
    ).toBe(
      'Because your address changed recently, Jordan Lee will join you in about 1 minute to confirm where to send your new card and already has the full details; your case number is CASE-001105.',
    );
    expect(
      buildCustomerMessage(
        buildContext({
          action_code: 'SERVICE_REQUEST',
          status: 'ESCALATED',
          matched_rule_id: 'SR-1',
          staff_name: 'Jordan Lee',
          expected_timing: 'about 1 minute',
        }),
      ),
    ).toContain('For your security, Jordan Lee will join you');
  });

  it('describes a dispute with a provisional credit', () => {
    expect(
      buildCustomerMessage(
        buildContext({
          action_code: 'RAISE_DISPUTE',
          matched_rule_id: 'RD-3',
          execution_result: {
            amount: 264,
            merchant: 'Northshore Electronics',
            provisional_credit_txn_id: 'TXN-100900',
            provisional_credit_amount: 264,
            expected_by: '2026-11-24',
          },
        }),
      ),
    ).toBe(
      "I've lodged a dispute for the $264.00 charge from Northshore Electronics and put $264.00 back in your account while we investigate, and we'll let you know the outcome by Tuesday 24 November.",
    );
  });

  it('lists preference changes in plain words', () => {
    expect(
      buildCustomerMessage(
        buildContext({
          action_code: 'UPDATE_PREFERENCES',
          execution_result: {
            changed: { large_print_letters: true, sms_alerts: false },
          },
        }),
      ),
    ).toBe(
      'Done: from now on our letters will come in large print and SMS alerts are off.',
    );
  });

  it('never mentions the app', () => {
    for (const action_code of [
      'LOCK_CARD',
      'REPORT_LOST_STOLEN',
      'UNLOCK_CARD',
    ]) {
      expect(
        buildCustomerMessage(
          buildContext({
            action_code,
            execution_result: { card_last4: '4821' },
          }),
        ),
      ).not.toMatch(/\bapp\b/i);
    }
  });
});
