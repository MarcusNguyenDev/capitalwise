import { PolicyDefinition } from '../types/policy_definition.type';

// Mirrors the active policy definitions in db/02_seed.sql (engine.policies).
// Keep the two in step: the e2e suite checks the live database against the
// same expected rules.

export const LOCK_CARD_POLICY_V1: PolicyDefinition = {
  rules: [
    {
      id: 'LC-1',
      when: [
        { fact: 'identity_verified', op: 'eq', value: true },
        { fact: 'card_belongs_to_caller', op: 'eq', value: true },
      ],
      route: 'AUTO',
      recommend: 'APPROVE',
      confidence: 0.99,
      reason:
        'Verified caller locking their own card. Low risk and reversible.',
    },
  ],
  default: {
    id: 'LC-DEFAULT',
    route: 'ESCALATE',
    recommend: 'ESCALATE',
    confidence: 0.5,
    reason: 'Card ownership or identity could not be confirmed.',
  },
};

export const REFUND_FEE_POLICY_V3: PolicyDefinition = {
  rules: [
    {
      id: 'RF-1',
      when: [
        {
          fact: 'vulnerability_signals',
          op: 'contains_any',
          value: [
            'CONFUSION',
            'DISTRESS',
            'BEREAVEMENT',
            'SERIOUS_ILLNESS',
            'FINANCIAL_ABUSE',
            'FAMILY_VIOLENCE',
          ],
        },
      ],
      route: 'ESCALATE',
      recommend: 'ESCALATE',
      confidence: 0.9,
      reason: 'Vulnerability signals present, a specialist handles the request',
    },
    {
      id: 'RF-2',
      when: [{ fact: 'refunds_last_12m', op: 'gte', value: 2 }],
      route: 'APPROVE',
      recommend: 'DECLINE',
      confidence: 0.85,
      reason: 'Two or more refunds in the last 12 months',
    },
    {
      id: 'RF-3',
      when: [
        { fact: 'refunds_last_12m', op: 'eq', value: 0 },
        { fact: 'tenure_years', op: 'gte', value: 2 },
        { fact: 'fee_amount', op: 'lte', value: 30 },
      ],
      route: 'APPROVE',
      recommend: 'APPROVE',
      confidence: 0.92,
      reason: 'First refund, long-standing customer, low-value fee',
    },
  ],
  default: {
    id: 'RF-DEFAULT',
    route: 'APPROVE',
    recommend: 'APPROVE',
    confidence: 0.7,
    reason: 'No specific rule matched. Staff review.',
  },
};

export const HARDSHIP_REQUEST_POLICY_V1: PolicyDefinition = {
  rules: [
    {
      id: 'HR-1',
      when: [{ fact: 'has_care_flag', op: 'eq', value: true }],
      route: 'ESCALATE',
      recommend: 'ESCALATE',
      confidence: 0.9,
      reason: 'Care flag present, specialist handles directly',
    },
    {
      id: 'HR-2',
      when: [{ fact: 'days_in_arrears', op: 'gt', value: 90 }],
      route: 'ESCALATE',
      recommend: 'ESCALATE',
      confidence: 0.9,
      reason: 'More than 90 days in arrears, specialist handles directly',
    },
    {
      id: 'HR-3',
      when: [
        { fact: 'income_drop_pct', op: 'gte', value: 50 },
        { fact: 'repayment_due_in_days', op: 'lte', value: 14 },
      ],
      route: 'APPROVE',
      recommend: 'APPROVE',
      confidence: 0.8,
      reason: 'Verified income loss and imminent repayment',
      proposal: { arrangement_type: 'REPAYMENT_PAUSE', months: 3 },
    },
  ],
  default: {
    id: 'HR-DEFAULT',
    route: 'APPROVE',
    recommend: 'APPROVE',
    confidence: 0.6,
    reason: 'No specific rule matched. Hardship specialist review.',
  },
};

export const RELEASE_HELD_PAYMENT_POLICY_V1: PolicyDefinition = {
  rules: [
    {
      id: 'SC-1',
      when: [{ fact: 'payee_name_check', op: 'eq', value: 'NO_MATCH' }],
      route: 'ESCALATE',
      recommend: 'DECLINE',
      confidence: 0.95,
      reason: 'Payee name check did not match. Keep the payment held.',
    },
    {
      id: 'SC-2',
      when: [{ fact: 'device_trusted', op: 'eq', value: false }],
      route: 'ESCALATE',
      recommend: 'DECLINE',
      confidence: 0.9,
      reason: 'Payment made from an untrusted device. Keep the payment held.',
    },
    {
      id: 'SC-3',
      when: [
        {
          fact: 'scam_coaching_signals',
          op: 'contains_any',
          value: [
            'TOLD_TO_MOVE_MONEY',
            'URGENCY',
            'SECRECY',
            'SAFE_ACCOUNT',
            'INVESTMENT_OPPORTUNITY',
            'REMOTE_ACCESS',
            'THIRD_PARTY_ON_LINE',
          ],
        },
      ],
      route: 'ESCALATE',
      recommend: 'DECLINE',
      confidence: 0.9,
      reason: 'Scam coaching signals heard on the call. Keep the payment held.',
    },
  ],
  default: {
    id: 'SC-DEFAULT',
    route: 'ESCALATE',
    recommend: 'ESCALATE',
    confidence: 0.6,
    reason:
      'Releasing held money is never automatic. A fraud specialist decides.',
  },
};

export const HUMAN_CALLBACK_POLICY_V1: PolicyDefinition = {
  rules: [],
  default: {
    id: 'HC-DEFAULT',
    route: 'ESCALATE',
    recommend: 'ESCALATE',
    confidence: 1.0,
    reason: 'The customer asked for, or needs, a person.',
  },
};

export const SEEDED_ACTIVE_POLICIES: Record<string, PolicyDefinition> = {
  LOCK_CARD: LOCK_CARD_POLICY_V1,
  REFUND_FEE: REFUND_FEE_POLICY_V3,
  HARDSHIP_REQUEST: HARDSHIP_REQUEST_POLICY_V1,
  RELEASE_HELD_PAYMENT: RELEASE_HELD_PAYMENT_POLICY_V1,
  HUMAN_CALLBACK: HUMAN_CALLBACK_POLICY_V1,
};
