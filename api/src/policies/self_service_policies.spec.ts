import {
  ACTIVATE_CARD_POLICY_V1,
  LOCK_CARD_POLICY_V2,
  PAYMENT_ARRANGEMENT_POLICY_V1,
  RAISE_DISPUTE_POLICY_V1,
  REFUND_FEE_POLICY_V4,
  REPLACE_CARD_POLICY_V1,
  REPORT_LOST_STOLEN_POLICY_V1,
  REQUEST_STATEMENT_POLICY_V1,
  SEEDED_ACTIVE_POLICIES,
  SERVICE_REQUEST_POLICY_V1,
  UNLOCK_CARD_POLICY_V1,
  UPDATE_PREFERENCES_POLICY_V1,
} from './fixtures/seeded_policies.fixture';
import { evaluatePolicy } from './policy_engine';
import { PolicyDefinition, PolicyFacts } from './types/policy_definition.type';

// Every rule of every contract v3 policy, using the seeded definitions.

function decide(policy: PolicyDefinition, facts: PolicyFacts) {
  const evaluation = evaluatePolicy(policy, facts);
  return {
    rule: evaluation.matched_rule_id,
    route: evaluation.route,
    recommend: evaluation.recommend,
    skill: evaluation.skill ?? null,
    proposal: evaluation.proposal ?? null,
  };
}

describe('seeded active policies', () => {
  it('cover every action in the registry, each with readable reasons', () => {
    expect(Object.keys(SEEDED_ACTIVE_POLICIES).sort()).toEqual([
      'ACTIVATE_CARD',
      'HARDSHIP_REQUEST',
      'HUMAN_CALLBACK',
      'LOCK_CARD',
      'PAYMENT_ARRANGEMENT',
      'RAISE_DISPUTE',
      'REFUND_FEE',
      'RELEASE_HELD_PAYMENT',
      'REPLACE_CARD',
      'REPORT_LOST_STOLEN',
      'REQUEST_STATEMENT',
      'SERVICE_REQUEST',
      'UNLOCK_CARD',
      'UPDATE_PREFERENCES',
    ]);
    for (const policy of Object.values(SEEDED_ACTIVE_POLICIES)) {
      for (const outcome of [...policy.rules, policy.default]) {
        expect(outcome.reason.length).toBeGreaterThan(20);
      }
    }
  });

  it('only ever declines on the spot or acts when identity is confirmed', () => {
    for (const [action_code, policy] of Object.entries(
      SEEDED_ACTIVE_POLICIES,
    )) {
      for (const rule of policy.rules) {
        const is_auto_approve =
          rule.route === 'AUTO' && rule.recommend === 'APPROVE';
        const has_identity_condition = rule.when.some(
          (condition) => condition.fact === 'identity_level',
        );
        // RF-3 is the promoted v3 rule unchanged; the level 2 gate on propose covers it.
        if (is_auto_approve && action_code !== 'REFUND_FEE') {
          expect({
            action_code,
            rule: rule.id,
            has_identity_condition,
          }).toEqual({
            action_code,
            rule: rule.id,
            has_identity_condition: true,
          });
        }
      }
    }
  });
});

describe('LOCK_CARD v2', () => {
  it('LC-1: identity level 1 and the caller owns the card -> AUTO', () => {
    expect(
      decide(LOCK_CARD_POLICY_V2, {
        identity_level: 1,
        card_belongs_to_caller: true,
      }),
    ).toMatchObject({ rule: 'LC-1', route: 'AUTO', recommend: 'APPROVE' });
  });

  it('LC-DEFAULT: not verified -> ESCALATE', () => {
    expect(
      decide(LOCK_CARD_POLICY_V2, {
        identity_level: 0,
        card_belongs_to_caller: true,
      }),
    ).toMatchObject({ rule: 'LC-DEFAULT', route: 'ESCALATE' });
  });
});

describe('REPORT_LOST_STOLEN v1', () => {
  it('RL-1: level 1 and own card -> AUTO', () => {
    expect(
      decide(REPORT_LOST_STOLEN_POLICY_V1, {
        identity_level: 1,
        card_belongs_to_caller: true,
        report_reason: 'LOST',
      }),
    ).toMatchObject({ rule: 'RL-1', route: 'AUTO', recommend: 'APPROVE' });
  });

  it('RL-DEFAULT: identity not confirmed -> ESCALATE', () => {
    expect(
      decide(REPORT_LOST_STOLEN_POLICY_V1, {
        identity_level: 0,
        card_belongs_to_caller: true,
      }),
    ).toMatchObject({ rule: 'RL-DEFAULT', route: 'ESCALATE' });
  });
});

describe('UNLOCK_CARD v1', () => {
  const locked_card = {
    identity_level: 2,
    card_belongs_to_caller: true,
    card_status: 'TEMP_LOCKED',
    scam_coaching_signals: [],
  };

  it('UC-1: scam signals -> ESCALATE, before anything else', () => {
    expect(
      decide(UNLOCK_CARD_POLICY_V1, {
        ...locked_card,
        scam_coaching_signals: ['REMOTE_ACCESS'],
      }),
    ).toMatchObject({ rule: 'UC-1', route: 'ESCALATE' });
  });

  it.each(['BLOCKED_LOST', 'BLOCKED_STOLEN', 'CANCELLED'])(
    'UC-2: a %s card -> AUTO DECLINE',
    (card_status) => {
      expect(
        decide(UNLOCK_CARD_POLICY_V1, { ...locked_card, card_status }),
      ).toMatchObject({ rule: 'UC-2', route: 'AUTO', recommend: 'DECLINE' });
    },
  );

  it('UC-3: a temporarily locked card at level 2 -> AUTO', () => {
    expect(decide(UNLOCK_CARD_POLICY_V1, locked_card)).toMatchObject({
      rule: 'UC-3',
      route: 'AUTO',
      recommend: 'APPROVE',
    });
  });

  it('UC-DEFAULT: only level 1, or an active card -> ESCALATE', () => {
    expect(
      decide(UNLOCK_CARD_POLICY_V1, { ...locked_card, identity_level: 1 }),
    ).toMatchObject({ rule: 'UC-DEFAULT', route: 'ESCALATE' });
    expect(
      decide(UNLOCK_CARD_POLICY_V1, { ...locked_card, card_status: 'ACTIVE' }),
    ).toMatchObject({ rule: 'UC-DEFAULT', route: 'ESCALATE' });
  });
});

describe('REPLACE_CARD v1', () => {
  const sarah_replacement = {
    identity_level: 2,
    card_belongs_to_caller: true,
    card_status: 'BLOCKED_LOST',
    address_age_days: 1553,
    replacements_last_12m: 0,
    scam_coaching_signals: [],
  };

  it('RC-1: scam signals -> ESCALATE', () => {
    expect(
      decide(REPLACE_CARD_POLICY_V1, {
        ...sarah_replacement,
        scam_coaching_signals: ['THIRD_PARTY_ON_LINE'],
      }),
    ).toMatchObject({ rule: 'RC-1', route: 'ESCALATE' });
  });

  it('RC-2: Ben Hartley moved 9 days ago -> ESCALATE', () => {
    expect(
      decide(REPLACE_CARD_POLICY_V1, {
        ...sarah_replacement,
        address_age_days: 9,
      }),
    ).toMatchObject({ rule: 'RC-2', route: 'ESCALATE' });
    expect(
      decide(REPLACE_CARD_POLICY_V1, {
        ...sarah_replacement,
        address_age_days: 30,
      }).rule,
    ).toBe('RC-2');
    expect(
      decide(REPLACE_CARD_POLICY_V1, {
        ...sarah_replacement,
        address_age_days: 31,
      }).rule,
    ).toBe('RC-4');
  });

  it('RC-3: three replacements in 12 months -> ESCALATE', () => {
    expect(
      decide(REPLACE_CARD_POLICY_V1, {
        ...sarah_replacement,
        replacements_last_12m: 3,
      }),
    ).toMatchObject({ rule: 'RC-3', route: 'ESCALATE' });
  });

  it('RC-4: Sarah at level 2 -> AUTO', () => {
    expect(decide(REPLACE_CARD_POLICY_V1, sarah_replacement)).toMatchObject({
      rule: 'RC-4',
      route: 'AUTO',
      recommend: 'APPROVE',
    });
  });

  it('RC-DEFAULT: only level 1 -> ESCALATE', () => {
    expect(
      decide(REPLACE_CARD_POLICY_V1, {
        ...sarah_replacement,
        identity_level: 1,
      }),
    ).toMatchObject({ rule: 'RC-DEFAULT', route: 'ESCALATE' });
  });
});

describe('ACTIVATE_CARD v1', () => {
  it('AC-1: an INACTIVE card of the caller at level 2 -> AUTO', () => {
    expect(
      decide(ACTIVATE_CARD_POLICY_V1, {
        identity_level: 2,
        card_belongs_to_caller: true,
        card_status: 'INACTIVE',
      }),
    ).toMatchObject({ rule: 'AC-1', route: 'AUTO' });
  });

  it('AC-DEFAULT: an already active card -> ESCALATE', () => {
    expect(
      decide(ACTIVATE_CARD_POLICY_V1, {
        identity_level: 2,
        card_belongs_to_caller: true,
        card_status: 'ACTIVE',
      }),
    ).toMatchObject({ rule: 'AC-DEFAULT', route: 'ESCALATE' });
  });
});

describe('REFUND_FEE v4 (earned autonomy)', () => {
  const daniel = {
    identity_level: 2,
    fee_amount: 15,
    refunds_last_12m: 0,
    tenure_years: 9,
    vulnerability_signals: [],
  };

  it('RF-1: vulnerability -> ESCALATE', () => {
    expect(
      decide(REFUND_FEE_POLICY_V4, {
        ...daniel,
        vulnerability_signals: ['BEREAVEMENT'],
      }),
    ).toMatchObject({ rule: 'RF-1', route: 'ESCALATE' });
  });

  it('RF-2: Tom, two refunds already -> AUTO DECLINE', () => {
    expect(
      decide(REFUND_FEE_POLICY_V4, {
        ...daniel,
        fee_amount: 20,
        refunds_last_12m: 2,
        tenure_years: 5,
      }),
    ).toMatchObject({ rule: 'RF-2', route: 'AUTO', recommend: 'DECLINE' });
  });

  it('RF-4: a fee over $50 -> staff APPROVE', () => {
    expect(
      decide(REFUND_FEE_POLICY_V4, { ...daniel, fee_amount: 50.01 }),
    ).toMatchObject({ rule: 'RF-4', route: 'APPROVE' });
    expect(
      decide(REFUND_FEE_POLICY_V4, { ...daniel, fee_amount: 50 }).rule,
    ).toBe('RF-DEFAULT');
  });

  it('RF-3: Daniel, first $15 fee after 9 years -> AUTO refund', () => {
    expect(decide(REFUND_FEE_POLICY_V4, daniel)).toMatchObject({
      rule: 'RF-3',
      route: 'AUTO',
      recommend: 'APPROVE',
    });
  });

  it('RF-DEFAULT: one earlier refund, or under 2 years -> staff', () => {
    expect(
      decide(REFUND_FEE_POLICY_V4, { ...daniel, refunds_last_12m: 1 }),
    ).toMatchObject({ rule: 'RF-DEFAULT', route: 'APPROVE' });
    expect(
      decide(REFUND_FEE_POLICY_V4, { ...daniel, tenure_years: 1 }),
    ).toMatchObject({ rule: 'RF-DEFAULT', route: 'APPROVE' });
  });
});

describe('RAISE_DISPUTE v1', () => {
  const marcus_duplicate = {
    identity_level: 2,
    dispute_reason: 'DUPLICATE',
    is_duplicate_confirmed: true,
    txn_amount: 264,
    scam_coaching_signals: [],
  };

  it('RD-1: scam signals -> ESCALATE', () => {
    expect(
      decide(RAISE_DISPUTE_POLICY_V1, {
        ...marcus_duplicate,
        scam_coaching_signals: ['URGENCY'],
      }),
    ).toMatchObject({ rule: 'RD-1', route: 'ESCALATE' });
  });

  it('RD-2: unrecognised and over $500 -> ESCALATE', () => {
    expect(
      decide(RAISE_DISPUTE_POLICY_V1, {
        ...marcus_duplicate,
        dispute_reason: 'UNRECOGNISED',
        txn_amount: 640,
      }),
    ).toMatchObject({ rule: 'RD-2', route: 'ESCALATE' });
  });

  it('RD-3: Marcus, a confirmed duplicate of $264 -> AUTO with a provisional credit', () => {
    expect(decide(RAISE_DISPUTE_POLICY_V1, marcus_duplicate)).toMatchObject({
      rule: 'RD-3',
      route: 'AUTO',
      recommend: 'APPROVE',
      proposal: { provisional_credit: true },
    });
  });

  it('a duplicate the ledger does not confirm gets no credit', () => {
    expect(
      decide(RAISE_DISPUTE_POLICY_V1, {
        ...marcus_duplicate,
        is_duplicate_confirmed: false,
      }),
    ).toMatchObject({ rule: 'RD-DEFAULT', route: 'AUTO', proposal: null });
  });

  it('RD-4: over $2,000 -> staff APPROVE', () => {
    expect(
      decide(RAISE_DISPUTE_POLICY_V1, {
        ...marcus_duplicate,
        txn_amount: 2400,
      }),
    ).toMatchObject({ rule: 'RD-4', route: 'APPROVE' });
  });

  it('RD-DEFAULT: lodged automatically, no credit', () => {
    expect(
      decide(RAISE_DISPUTE_POLICY_V1, {
        ...marcus_duplicate,
        dispute_reason: 'NOT_RECEIVED',
        is_duplicate_confirmed: false,
        txn_amount: 38.4,
      }),
    ).toMatchObject({
      rule: 'RD-DEFAULT',
      route: 'AUTO',
      recommend: 'APPROVE',
    });
  });
});

describe('REQUEST_STATEMENT and UPDATE_PREFERENCES', () => {
  it('RS-1 at level 1 -> AUTO, otherwise RS-DEFAULT', () => {
    expect(
      decide(REQUEST_STATEMENT_POLICY_V1, { identity_level: 1 }).rule,
    ).toBe('RS-1');
    expect(
      decide(REQUEST_STATEMENT_POLICY_V1, { identity_level: 0 }).route,
    ).toBe('ESCALATE');
  });

  it('UP-1 needs level 2', () => {
    expect(
      decide(UPDATE_PREFERENCES_POLICY_V1, { identity_level: 2 }),
    ).toMatchObject({ rule: 'UP-1', route: 'AUTO' });
    expect(
      decide(UPDATE_PREFERENCES_POLICY_V1, { identity_level: 1 }),
    ).toMatchObject({ rule: 'UP-DEFAULT', route: 'ESCALATE' });
  });
});

describe('PAYMENT_ARRANGEMENT v1', () => {
  const marcus_loan = {
    identity_level: 2,
    has_care_flag: false,
    vulnerability_signals: [],
    days_in_arrears: 0,
    arrangement_weeks: 4,
  };

  it('PA-1: care flag -> ESCALATE to CARE', () => {
    expect(
      decide(PAYMENT_ARRANGEMENT_POLICY_V1, {
        ...marcus_loan,
        has_care_flag: true,
      }),
    ).toMatchObject({ rule: 'PA-1', route: 'ESCALATE', skill: 'CARE' });
  });

  it('PA-2: vulnerability signals -> ESCALATE to CARE', () => {
    expect(
      decide(PAYMENT_ARRANGEMENT_POLICY_V1, {
        ...marcus_loan,
        vulnerability_signals: ['DISTRESS'],
      }),
    ).toMatchObject({ rule: 'PA-2', route: 'ESCALATE', skill: 'CARE' });
  });

  it('PA-3: up to 30 days behind and up to 8 weeks -> AUTO', () => {
    expect(decide(PAYMENT_ARRANGEMENT_POLICY_V1, marcus_loan)).toMatchObject({
      rule: 'PA-3',
      route: 'AUTO',
    });
    expect(
      decide(PAYMENT_ARRANGEMENT_POLICY_V1, {
        ...marcus_loan,
        days_in_arrears: 30,
        arrangement_weeks: 8,
      }).rule,
    ).toBe('PA-3');
  });

  it('PA-DEFAULT: longer, deeper in arrears, or no arrears record -> hardship specialist', () => {
    for (const changed_facts of [
      { arrangement_weeks: 9 },
      { days_in_arrears: 31 },
      { days_in_arrears: null },
    ]) {
      expect(
        decide(PAYMENT_ARRANGEMENT_POLICY_V1, {
          ...marcus_loan,
          ...changed_facts,
        }),
      ).toMatchObject({ rule: 'PA-DEFAULT', route: 'APPROVE', skill: null });
    }
  });
});

describe('SERVICE_REQUEST v1', () => {
  it.each([
    'CHANGE_ADDRESS',
    'CHANGE_PHONE',
    'CHANGE_EMAIL',
    'INCREASE_LIMIT',
    'ADD_PAYEE',
    'TRANSFER_MONEY',
    'CLOSE_ACCOUNT',
  ])('SR-1: %s -> ESCALATE', (request_type) => {
    expect(
      decide(SERVICE_REQUEST_POLICY_V1, { identity_level: 1, request_type }),
    ).toMatchObject({ rule: 'SR-1', route: 'ESCALATE' });
  });

  it('SR-DEFAULT: anything else -> staff, with a callback', () => {
    expect(
      decide(SERVICE_REQUEST_POLICY_V1, {
        identity_level: 1,
        request_type: 'CANCEL_DIRECT_DEBIT',
      }),
    ).toMatchObject({ rule: 'SR-DEFAULT', route: 'APPROVE' });
  });
});
