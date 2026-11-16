import { buildCallSummary } from './build_call_summary.util';

describe('buildCallSummary', () => {
  it('describes intent, identity and the cases raised', () => {
    const call_summary = buildCallSummary(
      {
        intent: 'Lost card',
        identity_verified: true,
        customer_id: 'CUS-1001',
        assigned_staff_id: null,
        status: 'AI_ACTIVE',
      },
      [
        {
          case_number: 'CASE-001101',
          action_code: 'LOCK_CARD',
          status: 'AUTO_EXECUTED',
          tier: 1,
        },
      ],
    );
    expect(call_summary).toBe(
      'Lost card. Identity verified by app push. Cases raised: CASE-001101 LOCK_CARD (completed automatically).',
    );
  });

  it('handles an unverified call with no cases and a human on the line', () => {
    const call_summary = buildCallSummary(
      {
        intent: null,
        identity_verified: false,
        customer_id: 'CUS-1001',
        assigned_staff_id: 'STF-02',
        status: 'HUMAN_ACTIVE',
      },
      [],
    );
    expect(call_summary).toBe(
      'General enquiry. Identity not verified. No cases raised. A staff member joined the call.',
    );
  });

  it('says when the caller ID was not recognised', () => {
    const call_summary = buildCallSummary(
      {
        intent: null,
        identity_verified: false,
        customer_id: null,
        assigned_staff_id: null,
        status: 'AI_ACTIVE',
      },
      [],
    );
    expect(call_summary).toContain('Caller ID not recognised.');
  });
});
