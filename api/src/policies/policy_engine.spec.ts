import {
  HARDSHIP_REQUEST_POLICY_V1,
  HUMAN_CALLBACK_POLICY_V1,
  LOCK_CARD_POLICY_V1,
  REFUND_FEE_POLICY_V3,
  RELEASE_HELD_PAYMENT_POLICY_V1,
} from './fixtures/seeded_policies.fixture';
import { evaluatePolicy, explainPolicy } from './policy_engine';
import {
  PolicyCondition,
  PolicyDefinition,
  PolicyFacts,
} from './types/policy_definition.type';

function buildSingleRulePolicy(condition: PolicyCondition): PolicyDefinition {
  return {
    rules: [
      {
        id: 'RULE-1',
        when: [condition],
        route: 'AUTO',
        recommend: 'APPROVE',
        confidence: 0.9,
        reason: 'Condition held',
      },
    ],
    default: {
      id: 'RULE-DEFAULT',
      route: 'ESCALATE',
      recommend: 'ESCALATE',
      confidence: 0.5,
      reason: 'Nothing matched',
    },
  };
}

function matchesRule(condition: PolicyCondition, facts: PolicyFacts): boolean {
  return (
    evaluatePolicy(buildSingleRulePolicy(condition), facts).matched_rule_id ===
    'RULE-1'
  );
}

describe('evaluatePolicy operators', () => {
  it('eq matches identical primitives only', () => {
    const condition: PolicyCondition = { fact: 'flag', op: 'eq', value: true };
    expect(matchesRule(condition, { flag: true })).toBe(true);
    expect(matchesRule(condition, { flag: false })).toBe(false);
    expect(matchesRule(condition, { flag: 'true' })).toBe(false);
    expect(
      matchesRule(
        { fact: 'check', op: 'eq', value: 'NO_MATCH' },
        { check: 'NO_MATCH' },
      ),
    ).toBe(true);
    expect(
      matchesRule({ fact: 'count', op: 'eq', value: 0 }, { count: 0 }),
    ).toBe(true);
  });

  it('gt is strictly greater', () => {
    const condition: PolicyCondition = { fact: 'days', op: 'gt', value: 90 };
    expect(matchesRule(condition, { days: 91 })).toBe(true);
    expect(matchesRule(condition, { days: 90 })).toBe(false);
    expect(matchesRule(condition, { days: 12 })).toBe(false);
  });

  it('gte includes the boundary', () => {
    const condition: PolicyCondition = { fact: 'count', op: 'gte', value: 2 };
    expect(matchesRule(condition, { count: 3 })).toBe(true);
    expect(matchesRule(condition, { count: 2 })).toBe(true);
    expect(matchesRule(condition, { count: 1 })).toBe(false);
  });

  it('lt is strictly less', () => {
    const condition: PolicyCondition = { fact: 'score', op: 'lt', value: 0.5 };
    expect(matchesRule(condition, { score: 0.49 })).toBe(true);
    expect(matchesRule(condition, { score: 0.5 })).toBe(false);
  });

  it('lte includes the boundary', () => {
    const condition: PolicyCondition = { fact: 'amount', op: 'lte', value: 30 };
    expect(matchesRule(condition, { amount: 30 })).toBe(true);
    expect(matchesRule(condition, { amount: 15 })).toBe(true);
    expect(matchesRule(condition, { amount: 30.01 })).toBe(false);
  });

  it('numeric operators fail on values that are not numbers', () => {
    const condition: PolicyCondition = { fact: 'amount', op: 'lte', value: 30 };
    expect(matchesRule(condition, { amount: '15' })).toBe(false);
    expect(matchesRule(condition, { amount: Number.NaN })).toBe(false);
    expect(matchesRule(condition, { amount: true })).toBe(false);
  });

  it('in matches when the fact is one of the listed values', () => {
    const condition: PolicyCondition = {
      fact: 'fee_cause',
      op: 'in',
      value: ['OVERDRAWN', 'DISHONOUR'],
    };
    expect(matchesRule(condition, { fee_cause: 'DISHONOUR' })).toBe(true);
    expect(matchesRule(condition, { fee_cause: 'LATE_PAYMENT' })).toBe(false);
    expect(
      matchesRule(
        { fact: 'fee_cause', op: 'in', value: 'OVERDRAWN' },
        { fee_cause: 'OVERDRAWN' },
      ),
    ).toBe(false);
  });

  it('contains_any matches when the lists overlap', () => {
    const condition: PolicyCondition = {
      fact: 'signals',
      op: 'contains_any',
      value: ['URGENCY', 'SECRECY'],
    };
    expect(matchesRule(condition, { signals: ['CALM', 'SECRECY'] })).toBe(true);
    expect(matchesRule(condition, { signals: ['CALM'] })).toBe(false);
    expect(matchesRule(condition, { signals: [] })).toBe(false);
    expect(matchesRule(condition, { signals: 'SECRECY' })).toBe(false);
  });

  it('an unknown operator fails the condition instead of throwing', () => {
    const condition = {
      fact: 'flag',
      op: 'matches',
      value: true,
    } as unknown as PolicyCondition;
    expect(() => matchesRule(condition, { flag: true })).not.toThrow();
    expect(matchesRule(condition, { flag: true })).toBe(false);
  });
});

describe('evaluatePolicy missing facts', () => {
  it.each(['eq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains_any'] as const)(
    'a missing fact fails %s and never throws',
    (operator) => {
      const condition: PolicyCondition = {
        fact: 'absent',
        op: operator,
        value: 1,
      };
      expect(() => matchesRule(condition, {})).not.toThrow();
      expect(matchesRule(condition, {})).toBe(false);
      expect(matchesRule(condition, { absent: null })).toBe(false);
      expect(matchesRule(condition, { absent: undefined })).toBe(false);
    },
  );

  it('reports a missing fact with a null actual value', () => {
    const evaluation = evaluatePolicy(LOCK_CARD_POLICY_V1, {
      identity_verified: true,
    });
    expect(evaluation.matched_rule_id).toBe('LC-DEFAULT');
    expect(evaluation.conditions_evaluated).toEqual([
      {
        rule_id: 'LC-1',
        fact: 'identity_verified',
        op: 'eq',
        expected: true,
        actual: true,
        passed: true,
      },
      {
        rule_id: 'LC-1',
        fact: 'card_belongs_to_caller',
        op: 'eq',
        expected: true,
        actual: null,
        passed: false,
      },
    ]);
  });

  it('falls to the default when there are no facts at all', () => {
    expect(evaluatePolicy(REFUND_FEE_POLICY_V3, {}).matched_rule_id).toBe(
      'RF-DEFAULT',
    );
    expect(evaluatePolicy(HARDSHIP_REQUEST_POLICY_V1, {}).matched_rule_id).toBe(
      'HR-DEFAULT',
    );
    expect(evaluatePolicy(RELEASE_HELD_PAYMENT_POLICY_V1, {}).route).toBe(
      'ESCALATE',
    );
  });
});

describe('evaluatePolicy rule ordering', () => {
  const ordered_policy: PolicyDefinition = {
    rules: [
      {
        id: 'FIRST',
        when: [{ fact: 'amount', op: 'gte', value: 10 }],
        route: 'ESCALATE',
        recommend: 'ESCALATE',
        confidence: 0.9,
        reason: 'First',
      },
      {
        id: 'SECOND',
        when: [{ fact: 'amount', op: 'gte', value: 5 }],
        route: 'APPROVE',
        recommend: 'APPROVE',
        confidence: 0.8,
        reason: 'Second',
      },
      {
        id: 'THIRD',
        when: [{ fact: 'amount', op: 'gte', value: 1 }],
        route: 'AUTO',
        recommend: 'APPROVE',
        confidence: 0.7,
        reason: 'Third',
      },
    ],
    default: {
      id: 'DEFAULT',
      route: 'APPROVE',
      recommend: 'DECLINE',
      confidence: 0.4,
      reason: 'Default',
    },
  };

  it('first match wins even when later rules would also match', () => {
    const evaluation = evaluatePolicy(ordered_policy, { amount: 50 });
    expect(evaluation.matched_rule_id).toBe('FIRST');
    expect(evaluation.route).toBe('ESCALATE');
  });

  it('does not evaluate rules after the matched one', () => {
    const evaluation = evaluatePolicy(ordered_policy, { amount: 7 });
    expect(evaluation.matched_rule_id).toBe('SECOND');
    expect(
      evaluation.conditions_evaluated.map((condition) => condition.rule_id),
    ).toEqual(['FIRST', 'SECOND']);
    expect(
      evaluation.conditions_evaluated.map((condition) => condition.passed),
    ).toEqual([false, true]);
  });

  it('a rule needs ALL of its conditions to pass', () => {
    const evaluation = evaluatePolicy(REFUND_FEE_POLICY_V3, {
      refunds_last_12m: 0,
      tenure_years: 9,
      fee_amount: 45,
      vulnerability_signals: [],
    });
    expect(evaluation.matched_rule_id).toBe('RF-DEFAULT');
    const rf3_conditions = evaluation.conditions_evaluated.filter(
      (condition) => condition.rule_id === 'RF-3',
    );
    expect(rf3_conditions.map((condition) => condition.passed)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('returns the default with every condition listed when nothing matches', () => {
    const evaluation = evaluatePolicy(ordered_policy, { amount: 0 });
    expect(evaluation).toMatchObject({
      matched_rule_id: 'DEFAULT',
      route: 'APPROVE',
      recommend: 'DECLINE',
      confidence: 0.4,
      reason: 'Default',
    });
    expect(evaluation.conditions_evaluated).toHaveLength(3);
  });

  it('a policy with no rules always returns its default', () => {
    const evaluation = evaluatePolicy(HUMAN_CALLBACK_POLICY_V1, {
      reason: 'Wants a person',
    });
    expect(evaluation).toMatchObject({
      matched_rule_id: 'HC-DEFAULT',
      route: 'ESCALATE',
      recommend: 'ESCALATE',
      confidence: 1,
    });
    expect(evaluation.conditions_evaluated).toEqual([]);
  });

  it('is pure: the inputs are not changed and the result is repeatable', () => {
    const facts = {
      refunds_last_12m: 0,
      tenure_years: 9,
      fee_amount: 15,
      vulnerability_signals: [],
    };
    const facts_before = JSON.stringify(facts);
    const policy_before = JSON.stringify(REFUND_FEE_POLICY_V3);
    const first_evaluation = evaluatePolicy(REFUND_FEE_POLICY_V3, facts);
    const second_evaluation = evaluatePolicy(REFUND_FEE_POLICY_V3, facts);
    expect(second_evaluation).toEqual(first_evaluation);
    expect(JSON.stringify(facts)).toBe(facts_before);
    expect(JSON.stringify(REFUND_FEE_POLICY_V3)).toBe(policy_before);
  });
});

describe('evaluatePolicy personas (seeded policies)', () => {
  it('Sarah Mitchell locking her own card -> LC-1, Tier 1 auto', () => {
    const evaluation = evaluatePolicy(LOCK_CARD_POLICY_V1, {
      identity_verified: true,
      has_care_flag: false,
      card_belongs_to_caller: true,
      card_last4: '4821',
      card_status: 'ACTIVE',
    });
    expect(evaluation).toMatchObject({
      matched_rule_id: 'LC-1',
      route: 'AUTO',
      recommend: 'APPROVE',
      confidence: 0.99,
    });
  });

  it("an unverified caller, or someone else's card, never auto-locks", () => {
    expect(
      evaluatePolicy(LOCK_CARD_POLICY_V1, {
        identity_verified: false,
        card_belongs_to_caller: true,
      }),
    ).toMatchObject({ matched_rule_id: 'LC-DEFAULT', route: 'ESCALATE' });
    expect(
      evaluatePolicy(LOCK_CARD_POLICY_V1, {
        identity_verified: true,
        card_belongs_to_caller: false,
      }),
    ).toMatchObject({ matched_rule_id: 'LC-DEFAULT', route: 'ESCALATE' });
  });

  it('Daniel Okafor, first $15 overdrawn fee after 9 years -> RF-3 APPROVE/APPROVE 0.92', () => {
    const evaluation = evaluatePolicy(REFUND_FEE_POLICY_V3, {
      identity_verified: true,
      has_care_flag: false,
      fee_txn_id: 'TXN-F1002',
      fee_amount: 15,
      fee_cause: 'OVERDRAWN',
      fee_already_refunded: false,
      refunds_last_12m: 0,
      tenure_years: 9,
      vulnerability_signals: [],
    });
    expect(evaluation).toMatchObject({
      matched_rule_id: 'RF-3',
      route: 'APPROVE',
      recommend: 'APPROVE',
      confidence: 0.92,
      reason: 'First refund, long-standing customer, low-value fee',
    });
    expect(
      evaluation.conditions_evaluated.map((condition) => condition.rule_id),
    ).toEqual(['RF-1', 'RF-2', 'RF-3', 'RF-3', 'RF-3']);
  });

  it('Priya Sharma, income down 79.8% and a repayment due in 6 days -> HR-3 with a 3-month pause proposal', () => {
    const evaluation = evaluatePolicy(HARDSHIP_REQUEST_POLICY_V1, {
      identity_verified: true,
      has_care_flag: false,
      income_drop_pct: 79.8,
      recent_30d_income: 1587.2,
      baseline_30d_income: 7850,
      repayment_due_in_days: 6,
      days_in_arrears: 0,
      repayment_amount: 3412,
      offset_balance: 4000,
      recent_hardship_enquiry: true,
      customer_statement: 'I lost my job five weeks ago.',
    });
    expect(evaluation).toMatchObject({
      matched_rule_id: 'HR-3',
      route: 'APPROVE',
      recommend: 'APPROVE',
      confidence: 0.8,
      proposal: { arrangement_type: 'REPAYMENT_PAUSE', months: 3 },
    });
  });

  it('a hardship request with a care flag or deep arrears goes straight to a specialist', () => {
    const priya_facts = {
      income_drop_pct: 79.8,
      repayment_due_in_days: 6,
      days_in_arrears: 0,
    };
    expect(
      evaluatePolicy(HARDSHIP_REQUEST_POLICY_V1, {
        ...priya_facts,
        has_care_flag: true,
      }),
    ).toMatchObject({ matched_rule_id: 'HR-1', route: 'ESCALATE' });
    expect(
      evaluatePolicy(HARDSHIP_REQUEST_POLICY_V1, {
        ...priya_facts,
        has_care_flag: false,
        days_in_arrears: 91,
      }),
    ).toMatchObject({ matched_rule_id: 'HR-2', route: 'ESCALATE' });
    expect(
      evaluatePolicy(HARDSHIP_REQUEST_POLICY_V1, {
        ...priya_facts,
        has_care_flag: false,
        income_drop_pct: 20,
      }),
    ).toMatchObject({
      matched_rule_id: 'HR-DEFAULT',
      route: 'APPROVE',
      confidence: 0.6,
    });
  });

  it('Margaret Collins, $18,500 to a payee whose name did not match -> SC-1 ESCALATE/DECLINE', () => {
    const evaluation = evaluatePolicy(RELEASE_HELD_PAYMENT_POLICY_V1, {
      identity_verified: true,
      has_care_flag: false,
      held_amount: 18500,
      payee_name: 'Bank Security Safe Account',
      payee_name_check: 'NO_MATCH',
      payee_name_check_returned: 'Kestrel Ridge Trading Pty Ltd',
      payee_age_hours: 0.8,
      device_trusted: false,
      device_age_minutes: 52,
      declined_then_retry: true,
      limit_raised_recently: true,
      risk_score: 0.94,
      customer_age: 78,
      scam_coaching_signals: ['TOLD_TO_MOVE_MONEY', 'SAFE_ACCOUNT'],
    });
    expect(evaluation).toMatchObject({
      matched_rule_id: 'SC-1',
      route: 'ESCALATE',
      recommend: 'DECLINE',
      confidence: 0.95,
    });
  });

  it('releasing held money is never automatic, whatever the facts say', () => {
    const clean_facts = {
      payee_name_check: 'MATCH',
      device_trusted: true,
      scam_coaching_signals: [],
    };
    expect(
      evaluatePolicy(RELEASE_HELD_PAYMENT_POLICY_V1, clean_facts),
    ).toMatchObject({ matched_rule_id: 'SC-DEFAULT', route: 'ESCALATE' });
    expect(
      evaluatePolicy(RELEASE_HELD_PAYMENT_POLICY_V1, {
        ...clean_facts,
        device_trusted: false,
      }),
    ).toMatchObject({
      matched_rule_id: 'SC-2',
      route: 'ESCALATE',
      recommend: 'DECLINE',
    });
    expect(
      evaluatePolicy(RELEASE_HELD_PAYMENT_POLICY_V1, {
        ...clean_facts,
        scam_coaching_signals: ['SECRECY'],
      }),
    ).toMatchObject({
      matched_rule_id: 'SC-3',
      route: 'ESCALATE',
      recommend: 'DECLINE',
    });
  });

  it('Tom Barker, third late fee refund in 12 months -> RF-2 APPROVE/DECLINE 0.85', () => {
    const evaluation = evaluatePolicy(REFUND_FEE_POLICY_V3, {
      identity_verified: true,
      has_care_flag: false,
      fee_txn_id: 'TXN-F1005',
      fee_amount: 20,
      fee_cause: 'LATE_PAYMENT',
      fee_already_refunded: false,
      refunds_last_12m: 2,
      tenure_years: 5,
      vulnerability_signals: [],
    });
    expect(evaluation).toMatchObject({
      matched_rule_id: 'RF-2',
      route: 'APPROVE',
      recommend: 'DECLINE',
      confidence: 0.85,
      reason: 'Two or more refunds in the last 12 months',
    });
  });

  it('Ben Hartley, customer for only 1 year -> RF-DEFAULT', () => {
    const evaluation = evaluatePolicy(REFUND_FEE_POLICY_V3, {
      identity_verified: true,
      has_care_flag: false,
      fee_txn_id: 'TXN-F3004',
      fee_amount: 15,
      fee_cause: 'OVERDRAWN',
      fee_already_refunded: false,
      refunds_last_12m: 0,
      tenure_years: 1,
      vulnerability_signals: [],
    });
    expect(evaluation).toMatchObject({
      matched_rule_id: 'RF-DEFAULT',
      route: 'APPROVE',
      recommend: 'APPROVE',
      confidence: 0.7,
    });
  });

  it('Ava Kowalski, one earlier refund -> RF-DEFAULT', () => {
    const evaluation = evaluatePolicy(REFUND_FEE_POLICY_V3, {
      identity_verified: true,
      has_care_flag: false,
      fee_txn_id: 'TXN-F3003',
      fee_amount: 15,
      fee_cause: 'OVERDRAWN',
      fee_already_refunded: false,
      refunds_last_12m: 1,
      tenure_years: 4,
      vulnerability_signals: [],
    });
    expect(evaluation).toMatchObject({
      matched_rule_id: 'RF-DEFAULT',
      route: 'APPROVE',
      recommend: 'APPROVE',
      confidence: 0.7,
    });
  });

  it('a fee refund with a vulnerability signal -> RF-1 ESCALATE, ahead of every other rule', () => {
    const evaluation = evaluatePolicy(REFUND_FEE_POLICY_V3, {
      identity_verified: true,
      has_care_flag: false,
      fee_amount: 15,
      refunds_last_12m: 0,
      tenure_years: 9,
      vulnerability_signals: ['CONFUSION'],
    });
    expect(evaluation).toMatchObject({
      matched_rule_id: 'RF-1',
      route: 'ESCALATE',
      recommend: 'ESCALATE',
      confidence: 0.9,
    });
    expect(evaluation.conditions_evaluated).toHaveLength(1);
  });
});

describe('explainPolicy', () => {
  const daniel_facts = {
    refunds_last_12m: 0,
    tenure_years: 9,
    fee_amount: 15,
    vulnerability_signals: [],
  };

  it('evaluates every rule and flags only the one that decided', () => {
    const rule_explanations = explainPolicy(REFUND_FEE_POLICY_V3, daniel_facts);
    expect(rule_explanations.map((rule) => rule.rule_id)).toEqual([
      'RF-1',
      'RF-2',
      'RF-3',
      'RF-DEFAULT',
    ]);
    expect(rule_explanations.map((rule) => rule.is_matched)).toEqual([
      false,
      false,
      true,
      false,
    ]);
    expect(rule_explanations.map((rule) => rule.is_default)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(rule_explanations[2]).toMatchObject({
      route: 'APPROVE',
      recommend: 'APPROVE',
      confidence: 0.92,
    });
    expect(rule_explanations[2].conditions).toEqual([
      {
        rule_id: 'RF-3',
        fact: 'refunds_last_12m',
        op: 'eq',
        expected: 0,
        actual: 0,
        passed: true,
      },
      {
        rule_id: 'RF-3',
        fact: 'tenure_years',
        op: 'gte',
        expected: 2,
        actual: 9,
        passed: true,
      },
      {
        rule_id: 'RF-3',
        fact: 'fee_amount',
        op: 'lte',
        expected: 30,
        actual: 15,
        passed: true,
      },
    ]);
  });

  it('still shows the conditions of rules after the matched one', () => {
    const rule_explanations = explainPolicy(RELEASE_HELD_PAYMENT_POLICY_V1, {
      payee_name_check: 'NO_MATCH',
      device_trusted: false,
      scam_coaching_signals: ['URGENCY'],
    });
    expect(rule_explanations.map((rule) => rule.is_matched)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(rule_explanations[1].conditions[0]).toMatchObject({
      fact: 'device_trusted',
      actual: false,
      passed: true,
    });
    expect(rule_explanations[2].conditions[0].passed).toBe(true);
  });

  it('flags the default when no rule matched', () => {
    const rule_explanations = explainPolicy(REFUND_FEE_POLICY_V3, {
      ...daniel_facts,
      tenure_years: 1,
    });
    const default_explanation = rule_explanations[rule_explanations.length - 1];
    expect(default_explanation).toMatchObject({
      rule_id: 'RF-DEFAULT',
      is_matched: true,
      is_default: true,
      conditions: [],
    });
    expect(rule_explanations.filter((rule) => rule.is_matched)).toHaveLength(1);
  });
});
