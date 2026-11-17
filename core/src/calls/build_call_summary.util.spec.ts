import { buildCallSummary } from './build_call_summary.util';

const BASE_CALL = {
  intent: 'Lost card',
  identity_verified: true,
  identity_level: 1 as const,
  identity_method: 'KNOWLEDGE' as const,
  is_identity_locked: false,
  customer_id: 'CUS-1001',
  assigned_staff_id: null,
  status: 'AI_ACTIVE' as const,
};

describe('buildCallSummary', () => {
  it('describes intent, identity and the cases raised', () => {
    const call_summary = buildCallSummary({ ...BASE_CALL, identity_level: 2 }, [
      {
        case_number: 'CASE-001101',
        action_code: 'REPORT_LOST_STOLEN',
        status: 'AUTO_EXECUTED',
        tier: 1,
      },
      {
        case_number: 'CASE-001102',
        action_code: 'UNLOCK_CARD',
        status: 'AUTO_DECLINED',
        tier: 1,
      },
    ]);
    expect(call_summary).toBe(
      'Lost card. Identity confirmed by questions, level 2. Cases raised: CASE-001101 REPORT_LOST_STOLEN (completed automatically); CASE-001102 UNLOCK_CARD (declined by policy).',
    );
  });

  it('names the app method', () => {
    expect(
      buildCallSummary({ ...BASE_CALL, identity_method: 'APP_PUSH' }, []),
    ).toContain('Identity confirmed in the app, level 1.');
  });

  it('handles an unconfirmed call with no cases and a human on the line', () => {
    const call_summary = buildCallSummary(
      {
        ...BASE_CALL,
        intent: null,
        identity_verified: false,
        identity_level: 0,
        identity_method: null,
        assigned_staff_id: 'STF-02',
        status: 'HUMAN_ACTIVE',
      },
      [],
    );
    expect(call_summary).toBe(
      'General enquiry. Identity not confirmed. No cases raised. A staff member joined the call.',
    );
  });

  it('says when identity was locked after failed checks', () => {
    expect(
      buildCallSummary(
        {
          ...BASE_CALL,
          identity_verified: false,
          identity_level: 0,
          identity_method: null,
          is_identity_locked: true,
        },
        [],
      ),
    ).toContain('Identity locked after failed checks.');
  });

  it('says when the caller ID was not recognised', () => {
    const call_summary = buildCallSummary(
      {
        ...BASE_CALL,
        identity_verified: false,
        identity_level: 0,
        identity_method: null,
        customer_id: null,
      },
      [],
    );
    expect(call_summary).toContain('Caller ID not recognised');
  });
});
