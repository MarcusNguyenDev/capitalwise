import { PolicyDefinition } from '../types/policy_definition.type';

// Generated from the engine.policies rows in db/02_seed.sql. Keep the two in
// step: the e2e suite checks the live database against the active ones.

export const LOCK_CARD_POLICY_V1: PolicyDefinition = {
  rules: [
    {
      id: 'LC-1',
      when: [
        {
          fact: 'identity_verified',
          op: 'eq',
          value: true,
        },
        {
          fact: 'card_belongs_to_caller',
          op: 'eq',
          value: true,
        },
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
      when: [
        {
          fact: 'refunds_last_12m',
          op: 'gte',
          value: 2,
        },
      ],
      route: 'APPROVE',
      recommend: 'DECLINE',
      confidence: 0.85,
      reason: 'Two or more refunds in the last 12 months',
    },
    {
      id: 'RF-3',
      when: [
        {
          fact: 'refunds_last_12m',
          op: 'eq',
          value: 0,
        },
        {
          fact: 'tenure_years',
          op: 'gte',
          value: 2,
        },
        {
          fact: 'fee_amount',
          op: 'lte',
          value: 30,
        },
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
      when: [
        {
          fact: 'has_care_flag',
          op: 'eq',
          value: true,
        },
      ],
      route: 'ESCALATE',
      recommend: 'ESCALATE',
      confidence: 0.9,
      reason: 'Care flag present, specialist handles directly',
    },
    {
      id: 'HR-2',
      when: [
        {
          fact: 'days_in_arrears',
          op: 'gt',
          value: 90,
        },
      ],
      route: 'ESCALATE',
      recommend: 'ESCALATE',
      confidence: 0.9,
      reason: 'More than 90 days in arrears, specialist handles directly',
    },
    {
      id: 'HR-3',
      when: [
        {
          fact: 'income_drop_pct',
          op: 'gte',
          value: 50,
        },
        {
          fact: 'repayment_due_in_days',
          op: 'lte',
          value: 14,
        },
      ],
      route: 'APPROVE',
      recommend: 'APPROVE',
      confidence: 0.8,
      reason: 'Verified income loss and imminent repayment',
      proposal: {
        arrangement_type: 'REPAYMENT_PAUSE',
        months: 3,
      },
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
      when: [
        {
          fact: 'payee_name_check',
          op: 'eq',
          value: 'NO_MATCH',
        },
      ],
      route: 'ESCALATE',
      recommend: 'DECLINE',
      confidence: 0.95,
      reason: 'Payee name check did not match. Keep the payment held.',
    },
    {
      id: 'SC-2',
      when: [
        {
          fact: 'device_trusted',
          op: 'eq',
          value: false,
        },
      ],
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

export const LOCK_CARD_POLICY_V2: PolicyDefinition = {
  rules: [
    {
      id: 'LC-1',
      when: [
        {
          fact: 'identity_level',
          op: 'gte',
          value: 1,
        },
        {
          fact: 'card_belongs_to_caller',
          op: 'eq',
          value: true,
        },
      ],
      route: 'AUTO',
      recommend: 'APPROVE',
      confidence: 0.99,
      reason:
        'Identity confirmed and the caller is locking their own card. Low risk and reversible.',
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

export const REPORT_LOST_STOLEN_POLICY_V1: PolicyDefinition = {
  rules: [
    {
      id: 'RL-1',
      when: [
        {
          fact: 'identity_level',
          op: 'gte',
          value: 1,
        },
        {
          fact: 'card_belongs_to_caller',
          op: 'eq',
          value: true,
        },
      ],
      route: 'AUTO',
      recommend: 'APPROVE',
      confidence: 0.98,
      reason:
        'Identity confirmed and the caller is reporting their own card. Blocking it protects them.',
    },
  ],
  default: {
    id: 'RL-DEFAULT',
    route: 'ESCALATE',
    recommend: 'ESCALATE',
    confidence: 0.5,
    reason: 'Card ownership or identity could not be confirmed.',
  },
};

export const UNLOCK_CARD_POLICY_V1: PolicyDefinition = {
  rules: [
    {
      id: 'UC-1',
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
      recommend: 'ESCALATE',
      confidence: 0.9,
      reason:
        'Scam signals heard on the call. A fraud specialist checks before the card is unlocked.',
    },
    {
      id: 'UC-2',
      when: [
        {
          fact: 'card_status',
          op: 'in',
          value: ['BLOCKED_LOST', 'BLOCKED_STOLEN', 'CANCELLED'],
        },
      ],
      route: 'AUTO',
      recommend: 'DECLINE',
      confidence: 0.99,
      reason: "A blocked card can't be unlocked; a replacement can be ordered.",
    },
    {
      id: 'UC-3',
      when: [
        {
          fact: 'card_status',
          op: 'eq',
          value: 'TEMP_LOCKED',
        },
        {
          fact: 'identity_level',
          op: 'gte',
          value: 2,
        },
      ],
      route: 'AUTO',
      recommend: 'APPROVE',
      confidence: 0.95,
      reason:
        'Identity confirmed to level 2 and the card is only temporarily locked.',
    },
  ],
  default: {
    id: 'UC-DEFAULT',
    route: 'ESCALATE',
    recommend: 'ESCALATE',
    confidence: 0.5,
    reason:
      'The card could not be unlocked automatically. A specialist checks.',
  },
};

export const REPLACE_CARD_POLICY_V1: PolicyDefinition = {
  rules: [
    {
      id: 'RC-1',
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
      recommend: 'ESCALATE',
      confidence: 0.9,
      reason:
        'Scam signals heard on the call. A specialist checks before a new card is sent.',
    },
    {
      id: 'RC-2',
      when: [
        {
          fact: 'address_age_days',
          op: 'lte',
          value: 30,
        },
      ],
      route: 'ESCALATE',
      recommend: 'ESCALATE',
      confidence: 0.9,
      reason: 'Recent address change: a specialist confirms where to send it.',
    },
    {
      id: 'RC-3',
      when: [
        {
          fact: 'replacements_last_12m',
          op: 'gte',
          value: 3,
        },
      ],
      route: 'ESCALATE',
      recommend: 'ESCALATE',
      confidence: 0.85,
      reason:
        'Three or more replacement cards in the last 12 months. A specialist checks.',
    },
    {
      id: 'RC-4',
      when: [
        {
          fact: 'identity_level',
          op: 'gte',
          value: 2,
        },
        {
          fact: 'card_belongs_to_caller',
          op: 'eq',
          value: true,
        },
      ],
      route: 'AUTO',
      recommend: 'APPROVE',
      confidence: 0.95,
      reason:
        'Identity confirmed to level 2. The new card goes to the address on file and the old card is blocked.',
    },
  ],
  default: {
    id: 'RC-DEFAULT',
    route: 'ESCALATE',
    recommend: 'ESCALATE',
    confidence: 0.5,
    reason: 'Card ownership or identity could not be confirmed to level 2.',
  },
};

export const ACTIVATE_CARD_POLICY_V1: PolicyDefinition = {
  rules: [
    {
      id: 'AC-1',
      when: [
        {
          fact: 'card_status',
          op: 'eq',
          value: 'INACTIVE',
        },
        {
          fact: 'card_belongs_to_caller',
          op: 'eq',
          value: true,
        },
        {
          fact: 'identity_level',
          op: 'gte',
          value: 2,
        },
      ],
      route: 'AUTO',
      recommend: 'APPROVE',
      confidence: 0.97,
      reason:
        'Identity confirmed to level 2 and the caller is activating their own new card.',
    },
  ],
  default: {
    id: 'AC-DEFAULT',
    route: 'ESCALATE',
    recommend: 'ESCALATE',
    confidence: 0.5,
    reason:
      'The card is not a new card waiting to be activated. A specialist checks.',
  },
};

export const REFUND_FEE_POLICY_V4: PolicyDefinition = {
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
      when: [
        {
          fact: 'refunds_last_12m',
          op: 'gte',
          value: 2,
        },
      ],
      route: 'AUTO',
      recommend: 'DECLINE',
      confidence: 0.9,
      reason:
        'Two or more refunds in the last 12 months. Declined on the spot; the customer can ask for a specialist review.',
    },
    {
      id: 'RF-4',
      when: [
        {
          fact: 'fee_amount',
          op: 'gt',
          value: 50,
        },
      ],
      route: 'APPROVE',
      recommend: 'APPROVE',
      confidence: 0.75,
      reason: 'Fee over $50. A staff member decides.',
    },
    {
      id: 'RF-3',
      when: [
        {
          fact: 'refunds_last_12m',
          op: 'eq',
          value: 0,
        },
        {
          fact: 'tenure_years',
          op: 'gte',
          value: 2,
        },
        {
          fact: 'fee_amount',
          op: 'lte',
          value: 30,
        },
      ],
      route: 'AUTO',
      recommend: 'APPROVE',
      confidence: 0.92,
      reason:
        'First refund, long-standing customer, low-value fee. Automatic since staff agreed with this rule in 93% of 45 decisions (earned autonomy, signed off by Alex Chen).',
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

export const RAISE_DISPUTE_POLICY_V1: PolicyDefinition = {
  rules: [
    {
      id: 'RD-1',
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
      recommend: 'ESCALATE',
      confidence: 0.9,
      reason:
        'Scam signals heard on the call. A fraud specialist handles the dispute.',
    },
    {
      id: 'RD-2',
      when: [
        {
          fact: 'dispute_reason',
          op: 'eq',
          value: 'UNRECOGNISED',
        },
        {
          fact: 'txn_amount',
          op: 'gt',
          value: 500,
        },
      ],
      route: 'ESCALATE',
      recommend: 'ESCALATE',
      confidence: 0.9,
      reason:
        'Unrecognised transaction over $500: possible fraud, a fraud specialist handles it.',
    },
    {
      id: 'RD-3',
      when: [
        {
          fact: 'identity_level',
          op: 'gte',
          value: 2,
        },
        {
          fact: 'dispute_reason',
          op: 'eq',
          value: 'DUPLICATE',
        },
        {
          fact: 'is_duplicate_confirmed',
          op: 'eq',
          value: true,
        },
        {
          fact: 'txn_amount',
          op: 'lte',
          value: 500,
        },
      ],
      route: 'AUTO',
      recommend: 'APPROVE',
      confidence: 0.95,
      reason:
        "Duplicate confirmed by the bank's records (same merchant and amount, both posted within 30 minutes). Lodged with a provisional credit.",
      proposal: {
        provisional_credit: true,
      },
    },
    {
      id: 'RD-4',
      when: [
        {
          fact: 'txn_amount',
          op: 'gt',
          value: 2000,
        },
      ],
      route: 'APPROVE',
      recommend: 'APPROVE',
      confidence: 0.7,
      reason:
        'Transaction over $2,000. A staff member reviews the dispute before it is lodged.',
    },
  ],
  default: {
    id: 'RD-DEFAULT',
    route: 'AUTO',
    recommend: 'APPROVE',
    confidence: 0.8,
    reason:
      'Dispute lodged for investigation, with no provisional credit until it is resolved.',
  },
};

export const REQUEST_STATEMENT_POLICY_V1: PolicyDefinition = {
  rules: [
    {
      id: 'RS-1',
      when: [
        {
          fact: 'identity_level',
          op: 'gte',
          value: 1,
        },
      ],
      route: 'AUTO',
      recommend: 'APPROVE',
      confidence: 0.99,
      reason:
        'Identity confirmed. Statements go only to the address or email on file.',
    },
  ],
  default: {
    id: 'RS-DEFAULT',
    route: 'ESCALATE',
    recommend: 'ESCALATE',
    confidence: 0.5,
    reason: 'Identity could not be confirmed.',
  },
};

export const UPDATE_PREFERENCES_POLICY_V1: PolicyDefinition = {
  rules: [
    {
      id: 'UP-1',
      when: [
        {
          fact: 'identity_level',
          op: 'gte',
          value: 2,
        },
      ],
      route: 'AUTO',
      recommend: 'APPROVE',
      confidence: 0.98,
      reason:
        'Identity confirmed to level 2 changing how the bank contacts them.',
    },
  ],
  default: {
    id: 'UP-DEFAULT',
    route: 'ESCALATE',
    recommend: 'ESCALATE',
    confidence: 0.5,
    reason: 'Identity could not be confirmed to level 2.',
  },
};

export const PAYMENT_ARRANGEMENT_POLICY_V1: PolicyDefinition = {
  rules: [
    {
      id: 'PA-1',
      when: [
        {
          fact: 'has_care_flag',
          op: 'eq',
          value: true,
        },
      ],
      route: 'ESCALATE',
      recommend: 'ESCALATE',
      confidence: 0.9,
      skill: 'CARE',
      reason: 'Care flag present, a specialist arranges the right support.',
    },
    {
      id: 'PA-2',
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
      skill: 'CARE',
      reason:
        'Vulnerability signals heard on the call, a specialist arranges the right support.',
    },
    {
      id: 'PA-3',
      when: [
        {
          fact: 'identity_level',
          op: 'gte',
          value: 2,
        },
        {
          fact: 'days_in_arrears',
          op: 'lte',
          value: 30,
        },
        {
          fact: 'arrangement_weeks',
          op: 'lte',
          value: 8,
        },
      ],
      route: 'AUTO',
      recommend: 'APPROVE',
      confidence: 0.9,
      reason:
        'No more than 30 days behind and an arrangement of 8 weeks or less. Set up now with late fees paused.',
    },
  ],
  default: {
    id: 'PA-DEFAULT',
    route: 'APPROVE',
    recommend: 'APPROVE',
    confidence: 0.7,
    reason:
      'A longer arrangement or deeper arrears. A hardship specialist decides.',
  },
};

export const SERVICE_REQUEST_POLICY_V1: PolicyDefinition = {
  rules: [
    {
      id: 'SR-1',
      when: [
        {
          fact: 'request_type',
          op: 'in',
          value: [
            'CHANGE_ADDRESS',
            'CHANGE_PHONE',
            'CHANGE_EMAIL',
            'INCREASE_LIMIT',
            'ADD_PAYEE',
            'TRANSFER_MONEY',
            'CLOSE_ACCOUNT',
          ],
        },
      ],
      route: 'ESCALATE',
      recommend: 'ESCALATE',
      confidence: 0.95,
      reason: 'Security-sensitive change: a specialist completes it with you.',
    },
  ],
  default: {
    id: 'SR-DEFAULT',
    route: 'APPROVE',
    recommend: 'APPROVE',
    confidence: 0.7,
    reason: 'A staff member completes the request and calls back.',
  },
};

export const SEEDED_ACTIVE_POLICIES: Record<string, PolicyDefinition> = {
  HARDSHIP_REQUEST: HARDSHIP_REQUEST_POLICY_V1,
  RELEASE_HELD_PAYMENT: RELEASE_HELD_PAYMENT_POLICY_V1,
  HUMAN_CALLBACK: HUMAN_CALLBACK_POLICY_V1,
  LOCK_CARD: LOCK_CARD_POLICY_V2,
  REPORT_LOST_STOLEN: REPORT_LOST_STOLEN_POLICY_V1,
  UNLOCK_CARD: UNLOCK_CARD_POLICY_V1,
  REPLACE_CARD: REPLACE_CARD_POLICY_V1,
  ACTIVATE_CARD: ACTIVATE_CARD_POLICY_V1,
  REFUND_FEE: REFUND_FEE_POLICY_V4,
  RAISE_DISPUTE: RAISE_DISPUTE_POLICY_V1,
  REQUEST_STATEMENT: REQUEST_STATEMENT_POLICY_V1,
  UPDATE_PREFERENCES: UPDATE_PREFERENCES_POLICY_V1,
  PAYMENT_ARRANGEMENT: PAYMENT_ARRANGEMENT_POLICY_V1,
  SERVICE_REQUEST: SERVICE_REQUEST_POLICY_V1,
};
