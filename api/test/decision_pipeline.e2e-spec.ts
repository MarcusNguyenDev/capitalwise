import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { CallRecord } from '../src/call_records/types/call_record.type';
import { DatabaseService } from '../src/database/database.service';
import { FactBuilderService } from '../src/facts/fact_builder.service';
import { normaliseSoftSignals } from '../src/facts/utils/merge_soft_signals.util';
import { SEEDED_ACTIVE_POLICIES } from '../src/policies/fixtures/seeded_policies.fixture';
import { PoliciesService } from '../src/policies/policies.service';
import { SYSTEM_ACTOR } from '../src/shared_kernel/constants/system_actor.constant';
import { configureApplication } from '../src/shared_kernel/setup/configure_application';

// Runs against the real local database (root docker compose). The suite
// resets the demo data first, so it is repeatable.

const RESET_TIMEOUT_MS = 120_000;

interface TestCaller {
  customer_id: string | null;
  customer_name: string | null;
  caller_number: string;
  identity_verified: boolean;
}

const SARAH: TestCaller = {
  customer_id: 'CUS-1001',
  customer_name: 'Sarah Mitchell',
  caller_number: '+61491570156',
  identity_verified: true,
};
const DANIEL: TestCaller = {
  customer_id: 'CUS-1002',
  customer_name: 'Daniel Okafor',
  caller_number: '+61491570157',
  identity_verified: true,
};
const PRIYA: TestCaller = {
  customer_id: 'CUS-1003',
  customer_name: 'Priya Sharma',
  caller_number: '+61491570158',
  identity_verified: true,
};
const MARGARET: TestCaller = {
  customer_id: 'CUS-1004',
  customer_name: 'Margaret Collins',
  caller_number: '+61491570159',
  identity_verified: true,
};

describe('api decision pipeline (e2e)', () => {
  let app: INestApplication;
  let database: DatabaseService;
  let fact_builder_service: FactBuilderService;
  let policies_service: PoliciesService;
  let priya_case_number: string;

  const api = () => request(app.getHttpServer());

  async function startCall(test_caller: TestCaller): Promise<string> {
    return database.runInTransaction(SYSTEM_ACTOR, async (transaction) => {
      const call_rows = await transaction.query<{ call_id: string }>(
        `INSERT INTO engine.calls (caller_number, customer_id, customer_name, channel, status, handled_by_agent_id, identity_verified, verified_at)
         VALUES ($1, $2, $3, 'BROWSER', 'AI_ACTIVE', 'AI-01', $4, CASE WHEN $4 THEN now() END)
         RETURNING call_id`,
        [
          test_caller.caller_number,
          test_caller.customer_id,
          test_caller.customer_name,
          test_caller.identity_verified,
        ],
      );
      return call_rows[0].call_id;
    });
  }

  async function decidePersona(
    test_caller: TestCaller,
    action_code: string,
    params: Record<string, unknown>,
    vulnerability_signals: string[] = [],
  ) {
    const built_facts = await fact_builder_service.buildFacts({
      action_code,
      call: { call_id: 'not-stored', identity_verified: true } as CallRecord,
      customer_id: test_caller.customer_id as string,
      params,
      customer_statement: 'In my own words.',
      soft_signals: normaliseSoftSignals({ vulnerability_signals }),
    });
    const policy_decision = await policies_service.decide(
      action_code,
      built_facts.facts,
    );
    return {
      facts: built_facts.facts,
      resolved_params: built_facts.resolved_params,
      evaluation: policy_decision.evaluation,
    };
  }

  async function readDateFromToday(day_count: number): Promise<string> {
    const date_rows = await database.query<{ target_date: string }>(
      `SELECT current_date + $1::int AS target_date`,
      [day_count],
    );
    return date_rows[0].target_date;
  }

  beforeAll(async () => {
    const testing_module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = testing_module.createNestApplication();
    configureApplication(app);
    await app.init();
    database = app.get(DatabaseService);
    fact_builder_service = app.get(FactBuilderService);
    policies_service = app.get(PoliciesService);
    await api().post('/api/demo/reset').expect(200, { is_reset: true });
  }, RESET_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
  });

  describe('seeded state', () => {
    it('is healthy and in demo mode', async () => {
      await api().get('/api/health').expect(200, { status: 'ok' });
      const config_response = await api().get('/api/demo/config').expect(200);
      expect(config_response.body).toEqual({
        bank_name: expect.any(String),
        is_demo_mode: true,
      });
    });

    it('starts with 11 fee refund cases in the inbox and one batch group of 8', async () => {
      const inbox_response = await api()
        .get('/api/approvals/inbox')
        .expect(200);
      expect(inbox_response.body).toHaveLength(11);
      const groups_response = await api()
        .get('/api/approvals/batch_groups')
        .expect(200);
      expect(groups_response.body).toHaveLength(1);
      expect(groups_response.body[0]).toMatchObject({
        group_key: 'REFUND_FEE:APPROVE:RF-3',
        case_count: 8,
        total_amount: 110,
        label: 'Approve 8 matching fee refunds',
      });
    });

    it('reports the earned autonomy agreement rates', async () => {
      const autonomy_response = await api()
        .get('/api/resources/autonomy')
        .expect(200);
      const stats_by_action = Object.fromEntries(
        autonomy_response.body.stats.map((stats: { action_code: string }) => [
          stats.action_code,
          stats,
        ]),
      );
      expect(stats_by_action.REFUND_FEE).toMatchObject({
        decided_cases: 45,
        agreement_pct: 93.3,
        is_eligible: true,
      });
      expect(stats_by_action.REFUND_FEE.headline).toBe(
        'Fee refunds under $30, first request: 93% staff agreement over 45 decisions. Propose promoting to Tier 1?',
      );
      expect(stats_by_action.HARDSHIP_REQUEST).toMatchObject({
        decided_cases: 25,
        agreement_pct: 80,
        is_eligible: false,
      });
    });

    it('has the same active policies as the unit test fixture', async () => {
      for (const [action_code, expected_definition] of Object.entries(
        SEEDED_ACTIVE_POLICIES,
      )) {
        const policy = await policies_service.getActivePolicy(action_code);
        expect(policy.definition).toEqual(expected_definition);
      }
    });
  });

  describe('FactBuilder + PolicyEngine against the seeded bank', () => {
    it('Sarah LOCK_CARD -> LC-1 AUTO', async () => {
      const { facts, evaluation } = await decidePersona(SARAH, 'LOCK_CARD', {
        card_id: 'CRD-10011',
      });
      expect(facts).toMatchObject({
        identity_verified: true,
        card_belongs_to_caller: true,
        card_last4: '4821',
        card_status: 'ACTIVE',
      });
      expect(evaluation).toMatchObject({
        matched_rule_id: 'LC-1',
        route: 'AUTO',
        recommend: 'APPROVE',
      });
    });

    it('Daniel REFUND_FEE TXN-F1002 -> RF-3 APPROVE/APPROVE 0.92', async () => {
      const { facts, resolved_params, evaluation } = await decidePersona(
        DANIEL,
        'REFUND_FEE',
        { fee_txn_id: 'TXN-F1002' },
      );
      expect(facts).toMatchObject({
        fee_amount: 15,
        fee_cause: 'OVERDRAWN',
        fee_already_refunded: false,
        refunds_last_12m: 0,
        tenure_years: 9,
      });
      expect(resolved_params).toEqual({
        fee_txn_id: 'TXN-F1002',
        account_id: 'ACC-10021',
        amount: 15,
      });
      expect(evaluation).toMatchObject({
        matched_rule_id: 'RF-3',
        route: 'APPROVE',
        recommend: 'APPROVE',
        confidence: 0.92,
      });
    });

    it('Priya HARDSHIP_REQUEST -> HR-3 APPROVE/APPROVE 0.8 with a 3-month pause proposal', async () => {
      const { facts, resolved_params, evaluation } = await decidePersona(
        PRIYA,
        'HARDSHIP_REQUEST',
        {},
      );
      expect(resolved_params).toEqual({ account_id: 'ACC-10031' });
      expect(facts).toMatchObject({
        has_care_flag: false,
        repayment_due_in_days: 6,
        days_in_arrears: 0,
        repayment_amount: 3412,
        offset_balance: 4000,
        recent_hardship_enquiry: true,
      });
      expect(facts.income_drop_pct).toBeGreaterThanOrEqual(50);
      expect(evaluation).toMatchObject({
        matched_rule_id: 'HR-3',
        route: 'APPROVE',
        recommend: 'APPROVE',
        confidence: 0.8,
        proposal: { arrangement_type: 'REPAYMENT_PAUSE', months: 3 },
      });
    });

    it('Margaret RELEASE_HELD_PAYMENT TXN-H1004 -> SC-1 ESCALATE/DECLINE', async () => {
      const { facts, evaluation } = await decidePersona(
        MARGARET,
        'RELEASE_HELD_PAYMENT',
        { txn_id: 'TXN-H1004' },
      );
      expect(facts).toMatchObject({
        held_amount: 18500,
        payee_name: 'Bank Security Safe Account',
        payee_name_check: 'NO_MATCH',
        payee_name_check_returned: 'Kestrel Ridge Trading Pty Ltd',
        device_trusted: false,
        declined_then_retry: true,
        limit_raised_recently: true,
        risk_score: 0.94,
        customer_age: 78,
      });
      expect(evaluation).toMatchObject({
        matched_rule_id: 'SC-1',
        route: 'ESCALATE',
        recommend: 'DECLINE',
      });
    });

    it('Tom REFUND_FEE TXN-F1005 -> RF-2 APPROVE/DECLINE 0.85', async () => {
      const tom: TestCaller = { ...SARAH, customer_id: 'CUS-1005' };
      const { facts, evaluation } = await decidePersona(tom, 'REFUND_FEE', {
        fee_txn_id: 'TXN-F1005',
      });
      expect(facts).toMatchObject({
        fee_amount: 20,
        fee_cause: 'LATE_PAYMENT',
        refunds_last_12m: 2,
      });
      expect(evaluation).toMatchObject({
        matched_rule_id: 'RF-2',
        route: 'APPROVE',
        recommend: 'DECLINE',
        confidence: 0.85,
      });
    });

    it.each([
      ['Ben Hartley', 'CUS-3004', 'TXN-F3004'],
      ['Ava Kowalski', 'CUS-3003', 'TXN-F3003'],
    ])(
      '%s REFUND_FEE -> RF-DEFAULT',
      async (_name, customer_id, fee_txn_id) => {
        const { evaluation } = await decidePersona(
          { ...SARAH, customer_id },
          'REFUND_FEE',
          { fee_txn_id },
        );
        expect(evaluation).toMatchObject({
          matched_rule_id: 'RF-DEFAULT',
          route: 'APPROVE',
          recommend: 'APPROVE',
          confidence: 0.7,
        });
      },
    );

    it('REFUND_FEE with a vulnerability signal -> RF-1 ESCALATE', async () => {
      const { evaluation } = await decidePersona(
        DANIEL,
        'REFUND_FEE',
        { fee_txn_id: 'TXN-F1002' },
        ['CONFUSION'],
      );
      expect(evaluation).toMatchObject({
        matched_rule_id: 'RF-1',
        route: 'ESCALATE',
        recommend: 'ESCALATE',
      });
    });
  });

  describe('guard rails on proposals', () => {
    it('rejects an unverified caller, an unknown action, a missing call and model-claimed facts', async () => {
      const unverified_call_id = await startCall({
        ...SARAH,
        identity_verified: false,
      });
      const verified_call_id = await startCall(SARAH);
      const proposal = {
        call_id: unverified_call_id,
        action_code: 'LOCK_CARD',
        params: { card_id: 'CRD-10011' },
        summary: 'Lock the card.',
      };

      const unverified_response = await api()
        .post('/api/actions/propose')
        .send(proposal)
        .expect(403);
      expect(unverified_response.body).toMatchObject({
        status_code: 403,
        error_code: 'IDENTITY_NOT_VERIFIED',
      });

      const unknown_action_response = await api()
        .post('/api/actions/propose')
        .send({ ...proposal, action_code: 'WIRE_MONEY' })
        .expect(400);
      expect(unknown_action_response.body.error_code).toBe(
        'UNKNOWN_ACTION_CODE',
      );

      const missing_call_response = await api()
        .post('/api/actions/propose')
        .send({ ...proposal, call_id: '00000000-0000-4000-8000-000000000000' })
        .expect(404);
      expect(missing_call_response.body.error_code).toBe('CALL_NOT_FOUND');

      const someone_elses_fee = await api()
        .post('/api/actions/propose')
        .send({
          ...proposal,
          call_id: verified_call_id,
          action_code: 'REFUND_FEE',
          params: { fee_txn_id: 'TXN-F1002' },
        })
        .expect(403);
      expect(someone_elses_fee.body.error_code).toBe('FEE_NOT_OWNED');

      const daniel_call_id = await startCall(DANIEL);
      const inflated_amount = await api()
        .post('/api/actions/propose')
        .send({
          call_id: daniel_call_id,
          action_code: 'REFUND_FEE',
          params: { fee_txn_id: 'TXN-F1002', amount: 150 },
          summary: 'Refund.',
        })
        .expect(400);
      expect(inflated_amount.body.error_code).toBe('AMOUNT_MISMATCH');

      const not_a_fee = await api()
        .post('/api/actions/propose')
        .send({
          call_id: daniel_call_id,
          action_code: 'REFUND_FEE',
          params: { fee_txn_id: 'TXN-D1002' },
          summary: 'Refund.',
        })
        .expect(400);
      expect(not_a_fee.body.error_code).toBe('NOT_A_FEE');

      await api()
        .post('/api/actions/propose')
        .send({ call_id: 'not-a-uuid', action_code: 'LOCK_CARD', summary: '' })
        .expect(400);
    });

    it("never lets a banking route read another customer's account", async () => {
      const response = await api()
        .get('/api/banking/customers/CUS-1001/loans/ACC-10031')
        .expect(403);
      expect(response.body.error_code).toBe('ACCOUNT_NOT_OWNED');
      const held_response = await api()
        .get('/api/banking/customers/CUS-1004/held_payments')
        .expect(200);
      expect(JSON.stringify(held_response.body)).not.toMatch(
        /risk_score|hold_reason/,
      );
    });
  });

  describe('Sarah: lost card (Tier 1, automatic)', () => {
    it('locks the card instantly, sends an SMS and audits the AI actor with rule LC-1', async () => {
      const call_id = await startCall(SARAH);
      const proposal = {
        call_id,
        action_code: 'LOCK_CARD',
        params: { card_id: 'CRD-10011' },
        summary: 'Sarah lost her debit card and asked for it to be locked.',
      };
      const proposal_response = await api()
        .post('/api/actions/propose')
        .send(proposal)
        .expect(200);
      const proposal_result = proposal_response.body;
      expect(proposal_result).toMatchObject({
        action_code: 'LOCK_CARD',
        tier: 1,
        route: 'AUTO',
        status: 'AUTO_EXECUTED',
        matched_rule_id: 'LC-1',
        policy_id: 'POL-LOCK_CARD-1',
        handled_by: null,
        is_executed: true,
        execution_result: {
          card_id: 'CRD-10011',
          card_last4: '4821',
          card_status: 'TEMP_LOCKED',
        },
      });
      expect(proposal_result.execution_result.last_transaction).toMatchObject({
        merchant: 'Pulse Gym Cafe',
        amount: 8.5,
        status: 'PENDING',
      });
      expect(proposal_result.customer_message).toContain('4821');

      const overview_response = await api()
        .get('/api/banking/customers/CUS-1001/overview')
        .expect(200);
      expect(overview_response.body.cards).toEqual([
        expect.objectContaining({
          card_id: 'CRD-10011',
          status: 'TEMP_LOCKED',
        }),
      ]);

      const notifications_response = await api()
        .get('/api/notifications')
        .query({ call_id })
        .expect(200);
      expect(notifications_response.body).toEqual([
        expect.objectContaining({
          customer_id: 'CUS-1001',
          case_number: proposal_result.case_number,
          channel: 'SMS',
          kind: 'CASE_UPDATE',
          body: 'Your card ending 4821 has been temporarily locked. You can unlock it any time in the app.',
        }),
      ]);

      const audit_response = await api()
        .get('/api/audit/events')
        .query({ case_number: proposal_result.case_number })
        .expect(200);
      const events_by_type = Object.fromEntries(
        audit_response.body.events.map((event: { event_type: string }) => [
          event.event_type,
          event,
        ]),
      );
      expect(events_by_type.CASE_CREATED).toMatchObject({
        actor_type: 'AI',
        actor_id: 'AI-01',
        actor_name: 'AI Specialist 01',
      });
      expect(events_by_type.CASE_CREATED.detail).toMatchObject({
        matched_rule_id: 'LC-1',
        tier: 1,
        status: 'AUTO_EXECUTED',
      });
      expect(events_by_type.POLICY_EVALUATED.detail).toMatchObject({
        matched_rule_id: 'LC-1',
        route: 'AUTO',
        policy_version: 1,
      });
      expect(
        events_by_type.POLICY_EVALUATED.detail.conditions_evaluated,
      ).toHaveLength(2);
      expect(events_by_type.ACTION_EXECUTED).toMatchObject({
        actor_type: 'AI',
        actor_id: 'AI-01',
      });
      expect(events_by_type.NOTIFICATION_SENT).toBeDefined();

      const repeat_response = await api()
        .post('/api/actions/propose')
        .send(proposal)
        .expect(200);
      expect(repeat_response.body.case_number).toBe(
        proposal_result.case_number,
      );
      expect(repeat_response.body.execution_result.card_status).toBe(
        'TEMP_LOCKED',
      );
    });
  });

  describe('Priya: hardship (Tier 2, approved by a specialist)', () => {
    it('raises an HR-3 case for Sam Patel with the 21-day response date', async () => {
      const call_id = await startCall(PRIYA);
      const proposal_response = await api()
        .post('/api/actions/propose')
        .send({
          call_id,
          action_code: 'HARDSHIP_REQUEST',
          params: { account_id: 'ACC-10031' },
          summary:
            'Priya lost her job five weeks ago and cannot make the next home loan repayment.',
          customer_statement:
            'I lost my job five weeks ago and I am worried about the repayment next week.',
          soft_signals: {
            quotes: ['I am worried about the repayment next week'],
          },
        })
        .expect(200);
      const proposal_result = proposal_response.body;
      priya_case_number = proposal_result.case_number;
      const response_due_on = await readDateFromToday(21);
      expect(proposal_result).toMatchObject({
        tier: 2,
        route: 'APPROVE',
        status: 'PENDING_APPROVAL',
        recommendation: 'APPROVE',
        confidence: 0.8,
        matched_rule_id: 'HR-3',
        required_skill: 'HARDSHIP',
        handled_by: {
          staff_id: 'STF-03',
          name: 'Sam Patel',
          role: 'HARDSHIP_SPECIALIST',
        },
        response_due_on,
        expected_wait_minutes: null,
        is_executed: false,
        execution_result: null,
      });
      expect(proposal_result.expected_timing).toContain(
        'within 2 business days, and no later than',
      );

      const pack_response = await api()
        .get(`/api/cases/${priya_case_number}`)
        .expect(200);
      expect(pack_response.body.case).toMatchObject({
        params: {
          account_id: 'ACC-10031',
          arrangement_type: 'REPAYMENT_PAUSE',
          months: 3,
        },
        assigned_staff_name: 'Sam Patel',
        model: 'gpt-realtime',
        prompt_version: '1.1',
      });
      expect(
        pack_response.body.evidence
          .slice(0, 5)
          .map((evidence: { fact: string }) => evidence.fact),
      ).toEqual([
        'income_drop_pct',
        'repayment_due_in_days',
        'days_in_arrears',
        'has_care_flag',
        'customer_statement',
      ]);
      expect(pack_response.body.evidence[0]).toMatchObject({
        source: 'bank.v_income_rolling',
        is_required: true,
      });
      expect(pack_response.body.reason_codes.approve).toHaveLength(4);
      expect(pack_response.body.notifications[0].body).toContain(
        `We've recorded your hardship notice (${priya_case_number}).`,
      );
      expect(pack_response.body.notifications[0].body).toContain(
        'National Debt Helpline 1800 007 007',
      );

      const inbox_response = await api()
        .get('/api/approvals/inbox')
        .expect(200);
      expect(inbox_response.body[0]).toMatchObject({
        case_number: priya_case_number,
        priority: 2,
        response_due_on,
      });
    });

    it('records the arrangement and texts Priya when Sam approves', async () => {
      const decision = {
        staff_id: 'STF-03',
        decision: 'APPROVED',
        reason_code: 'MEETS_POLICY',
      };
      const decision_response = await api()
        .post(`/api/cases/${priya_case_number}/decision`)
        .send(decision)
        .expect(200);
      expect(decision_response.body).toMatchObject({
        is_executed: true,
        case: {
          status: 'EXECUTED',
          decision: 'APPROVED',
          decided_by: 'STF-03',
          decided_by_name: 'Sam Patel',
        },
        execution_result: {
          account_id: 'ACC-10031',
          arrangement_type: 'REPAYMENT_PAUSE',
          months: 3,
          status: 'APPROVED',
          case_number: priya_case_number,
        },
      });

      const loan_response = await api()
        .get('/api/banking/customers/CUS-1003/loans/ACC-10031')
        .expect(200);
      expect(loan_response.body.arrangements).toEqual([
        expect.objectContaining({
          customer_id: 'CUS-1003',
          arrangement_type: 'REPAYMENT_PAUSE',
          status: 'APPROVED',
          notice_channel: 'PHONE',
          case_number: priya_case_number,
          response_due_on: await readDateFromToday(21),
        }),
      ]);

      const notifications_response = await api()
        .get('/api/notifications')
        .query({ customer_id: 'CUS-1003', limit: 1 })
        .expect(200);
      expect(notifications_response.body[0]).toMatchObject({
        channel: 'SMS',
        case_number: priya_case_number,
      });
      expect(notifications_response.body[0].body).toMatch(
        /^Your hardship request is approved: a 3-month repayment pause on your home loan from \d+ \w+ \d{4}\. We'll write to confirm\.$/,
      );

      const repeat_response = await api()
        .post(`/api/cases/${priya_case_number}/decision`)
        .send(decision)
        .expect(409);
      expect(repeat_response.body.error_code).toBe('CASE_ALREADY_DECIDED');
    });

    it('explains the decision: every condition, the versions and the approver', async () => {
      const explanation_response = await api()
        .get(`/api/explanations/cases/${priya_case_number}`)
        .expect(200);
      const explanation = explanation_response.body;
      expect(
        explanation.rules.map((rule: { rule_id: string }) => rule.rule_id),
      ).toEqual(['HR-1', 'HR-2', 'HR-3', 'HR-DEFAULT']);
      expect(
        explanation.rules.map(
          (rule: { is_matched: boolean }) => rule.is_matched,
        ),
      ).toEqual([false, false, true, false]);
      expect(explanation.rules[0].conditions).toEqual([
        {
          rule_id: 'HR-1',
          fact: 'has_care_flag',
          op: 'eq',
          expected: true,
          actual: false,
          passed: false,
        },
      ]);
      expect(explanation.rules[1].conditions).toEqual([
        {
          rule_id: 'HR-2',
          fact: 'days_in_arrears',
          op: 'gt',
          expected: 90,
          actual: 0,
          passed: false,
        },
      ]);
      expect(explanation.rules[2].conditions).toEqual([
        {
          rule_id: 'HR-3',
          fact: 'income_drop_pct',
          op: 'gte',
          expected: 50,
          actual: expect.any(Number),
          passed: true,
        },
        {
          rule_id: 'HR-3',
          fact: 'repayment_due_in_days',
          op: 'lte',
          expected: 14,
          actual: 6,
          passed: true,
        },
      ]);
      expect(explanation.outcome).toEqual({
        route: 'APPROVE',
        tier: 2,
        recommendation: 'APPROVE',
        confidence: 0.8,
        matched_rule_id: 'HR-3',
        reason: 'Verified income loss and imminent repayment',
      });
      expect(explanation.versions).toEqual({
        model: 'gpt-realtime',
        prompt_version: '1.1',
        policy_id: 'POL-HARDSHIP_REQUEST-1',
        policy_version: 1,
        policy_approved_by: 'STF-01',
      });
      expect(explanation.human_decision).toMatchObject({
        decision: 'APPROVED',
        reason_code: 'MEETS_POLICY',
        reason_label: 'Meets policy',
        decided_by: 'STF-03',
        decided_by_name: 'Sam Patel',
        decided_by_role: 'HARDSHIP_SPECIALIST',
      });
      expect(explanation.customer_said).toEqual({
        statement:
          'I lost my job five weeks ago and I am worried about the repayment next week.',
        quotes: ['I am worried about the repayment next week'],
      });
      expect(
        explanation.facts.find(
          (fact: { fact: string }) => fact.fact === 'income_drop_pct',
        ),
      ).toMatchObject({
        source: 'bank.v_income_rolling',
        label: expect.any(String),
      });
      const trail_event_types = explanation.audit_trail.map(
        (event: { event_type: string }) => event.event_type,
      );
      expect(trail_event_types).toEqual(
        expect.arrayContaining([
          'CASE_CREATED',
          'POLICY_EVALUATED',
          'CASE_DECIDED',
          'ACTION_EXECUTED',
          'CASE_STATUS_CHANGED',
          'NOTIFICATION_SENT',
        ]),
      );
      expect(
        explanation.audit_trail.find(
          (event: { event_type: string }) =>
            event.event_type === 'CASE_DECIDED',
        ),
      ).toMatchObject({
        actor_type: 'STAFF',
        actor_id: 'STF-03',
        actor_name: 'Sam Patel',
      });
      expect(explanation.customer_explanation).toContain('Hi Priya');
      expect(explanation.customer_explanation).toContain('rule HR-3');
      expect(explanation.customer_explanation).toContain(
        'Sam Patel reviewed the case and approved it',
      );
    });
  });

  describe('Margaret: scam coaching (Tier 3, payment stays held)', () => {
    let margaret_call_id: string;
    let margaret_case_number: string;

    async function expectPaymentStillHeld(): Promise<void> {
      const held_response = await api()
        .get('/api/banking/customers/CUS-1004/held_payments')
        .expect(200);
      expect(held_response.body.held_payments).toEqual([
        expect.objectContaining({
          txn_id: 'TXN-H1004',
          status: 'HELD',
          amount: 18500,
        }),
      ]);
    }

    it('routes a RELEASE_HELD_PAYMENT case to Morgan Taylor and releases nothing', async () => {
      margaret_call_id = await startCall(MARGARET);
      const concern_response = await api()
        .post('/api/actions/flag_concern')
        .send({
          call_id: margaret_call_id,
          type: 'SCAM_COACHING',
          quotes: [
            'The bank security team told me to move it to a safe account',
          ],
          signals: ['TOLD_TO_MOVE_MONEY', 'SAFE_ACCOUNT', 'URGENCY'],
        })
        .expect(200);
      margaret_case_number = concern_response.body.case_number;
      expect(concern_response.body).toMatchObject({
        action_code: 'RELEASE_HELD_PAYMENT',
        tier: 3,
        route: 'ESCALATE',
        status: 'ESCALATED',
        recommendation: 'DECLINE',
        matched_rule_id: 'SC-1',
        required_skill: 'FRAUD',
        handled_by: {
          staff_id: 'STF-04',
          name: 'Morgan Taylor',
          role: 'FRAUD_SPECIALIST',
        },
        expected_wait_minutes: 1,
        expected_timing: 'about 1 minute',
        is_executed: false,
        risk_level: 'HIGH',
        concern_type: 'SCAM_COACHING',
      });
      await expectPaymentStillHeld();

      const pack_response = await api()
        .get(`/api/cases/${margaret_case_number}`)
        .expect(200);
      expect(pack_response.body.case).toMatchObject({
        params: { txn_id: 'TXN-H1004' },
      });
      expect(
        pack_response.body.case.soft_signals.scam_coaching_signals,
      ).toEqual(['TOLD_TO_MOVE_MONEY', 'SAFE_ACCOUNT', 'URGENCY']);
      expect(pack_response.body.notifications[0].body).toBe(
        'Your $18,500.00 payment is safely on hold while a specialist reviews it. We will never ask you to move money to keep it safe.',
      );

      const escalations_response = await api()
        .get('/api/dashboard/escalations')
        .expect(200);
      expect(escalations_response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            escalation_key: `CASE:${margaret_case_number}`,
            kind: 'CASE',
            tier: 3,
            assigned_staff_name: 'Morgan Taylor',
          }),
        ]),
      );
    });

    it('merges a second concern into the same case instead of duplicating it', async () => {
      const concern_response = await api()
        .post('/api/actions/flag_concern')
        .send({
          call_id: margaret_call_id,
          type: 'SCAM_COACHING',
          quotes: ['They said not to tell anyone'],
          signals: ['SECRECY'],
        })
        .expect(200);
      expect(concern_response.body.case_number).toBe(margaret_case_number);
      const pack_response = await api()
        .get(`/api/cases/${margaret_case_number}`)
        .expect(200);
      expect(
        pack_response.body.case.soft_signals.scam_coaching_signals,
      ).toEqual(['TOLD_TO_MOVE_MONEY', 'SAFE_ACCOUNT', 'URGENCY', 'SECRECY']);
      expect(pack_response.body.case.soft_signals.quotes).toHaveLength(2);
      expect(pack_response.body.case).toMatchObject({
        matched_rule_id: 'SC-1',
        assigned_staff_id: 'STF-04',
        status: 'ESCALATED',
      });
    });

    it('refuses a release from staff without the FRAUD skill', async () => {
      const decision_response = await api()
        .post(`/api/cases/${margaret_case_number}/decision`)
        .send({
          staff_id: 'STF-02',
          decision: 'APPROVED',
          reason_code: 'VERIFIED_WITH_CUSTOMER',
        })
        .expect(403);
      expect(decision_response.body.error_code).toBe('SKILL_REQUIRED');
      const pack_response = await api()
        .get(`/api/cases/${margaret_case_number}`)
        .expect(200);
      expect(pack_response.body.case).toMatchObject({
        status: 'ESCALATED',
        decision: null,
      });
      await expectPaymentStillHeld();
    });

    it('keeps the $18,500 held when the fraud specialist rejects the release', async () => {
      const decision_response = await api()
        .post(`/api/cases/${margaret_case_number}/decision`)
        .send({
          staff_id: 'STF-04',
          decision: 'REJECTED',
          reason_code: 'SUSPECTED_SCAM',
        })
        .expect(200);
      expect(decision_response.body).toMatchObject({
        is_executed: false,
        execution_result: null,
        case: { status: 'REJECTED', decided_by_name: 'Morgan Taylor' },
      });
      await expectPaymentStillHeld();
    });
  });

  describe('batch approval of the 8 recommended fee refunds', () => {
    it('writes 8 FEE_REFUND ledger rows that each reverse their fee', async () => {
      const groups_response = await api()
        .get('/api/approvals/batch_groups')
        .expect(200);
      const case_numbers: string[] = groups_response.body[0].cases.map(
        (batch_case: { case_number: string }) => batch_case.case_number,
      );
      expect(case_numbers).toHaveLength(8);

      const batch_response = await api()
        .post('/api/approvals/batch_approve')
        .send({ staff_id: 'STF-02', case_numbers, reason_code: 'MEETS_POLICY' })
        .expect(200);
      expect(batch_response.body.failed).toEqual([]);
      expect(batch_response.body.approved).toHaveLength(8);

      const refund_rows = await database.query<{
        txn_id: string;
        amount: number;
        reverses_txn_id: string;
        status: string;
        fee_type: string;
      }>(
        `SELECT refund.txn_id, refund.amount, refund.reverses_txn_id, refund.status, fee.txn_type AS fee_type
         FROM bank.transactions AS refund
         JOIN bank.transactions AS fee ON fee.txn_id = refund.reverses_txn_id
         WHERE refund.txn_type = 'FEE_REFUND' AND refund.reverses_txn_id = ANY($1::text[])`,
        [
          [
            'TXN-F2001',
            'TXN-F2002',
            'TXN-F2003',
            'TXN-F2004',
            'TXN-F2005',
            'TXN-F2006',
            'TXN-F2007',
            'TXN-F2008',
          ],
        ],
      );
      expect(refund_rows).toHaveLength(8);
      expect(
        new Set(refund_rows.map((refund_row) => refund_row.reverses_txn_id))
          .size,
      ).toBe(8);
      expect(
        refund_rows.every(
          (refund_row) =>
            refund_row.status === 'POSTED' &&
            refund_row.amount > 0 &&
            refund_row.fee_type === 'FEE',
        ),
      ).toBe(true);
      expect(
        refund_rows.reduce((total, refund_row) => total + refund_row.amount, 0),
      ).toBe(110);

      const liam_notifications = await api()
        .get('/api/notifications')
        .query({ customer_id: 'CUS-2001', limit: 1 })
        .expect(200);
      expect(liam_notifications.body[0].body).toBe(
        'Your $15.00 fee refund has been approved and credited.',
      );
      const liam_fees = await api()
        .get('/api/banking/customers/CUS-2001/fee_history')
        .expect(200);
      expect(liam_fees.body).toMatchObject({
        refunds_last_12m: 1,
        fees: [
          expect.objectContaining({ txn_id: 'TXN-F2001', is_refunded: true }),
        ],
      });

      await api().get('/api/approvals/batch_groups').expect(200, []);
      const retry_response = await api()
        .post('/api/approvals/batch_approve')
        .send({
          staff_id: 'STF-02',
          case_numbers: [case_numbers[0]],
          reason_code: 'MEETS_POLICY',
        })
        .expect(200);
      expect(retry_response.body.approved).toEqual([]);
      expect(retry_response.body.failed).toEqual([
        expect.objectContaining({ case_number: case_numbers[0] }),
      ]);
    });
  });

  describe('vulnerability and human handover', () => {
    it('re-routes a pending fee refund to a CARE specialist when vulnerability is flagged', async () => {
      const call_id = await startCall(DANIEL);
      const proposal_response = await api()
        .post('/api/actions/propose')
        .send({
          call_id,
          action_code: 'REFUND_FEE',
          params: { fee_txn_id: 'TXN-F1002' },
          summary: 'Daniel asked for his $15 overdrawn fee back.',
        })
        .expect(200);
      expect(proposal_response.body).toMatchObject({
        tier: 2,
        matched_rule_id: 'RF-3',
        confidence: 0.92,
        handled_by: { name: 'Jordan Lee' },
        expected_timing: 'within 4 business hours',
      });

      const concern_response = await api()
        .post('/api/actions/flag_concern')
        .send({
          call_id,
          type: 'VULNERABILITY',
          quotes: ['I do not really understand what is happening'],
        })
        .expect(200);
      expect(concern_response.body).toMatchObject({
        case_number: proposal_response.body.case_number,
        tier: 3,
        status: 'ESCALATED',
        matched_rule_id: 'RF-1',
        required_skill: 'CARE',
        handled_by: { staff_id: 'STF-03', name: 'Sam Patel' },
        risk_level: 'HIGH',
        concern_type: 'VULNERABILITY',
      });
      const cases_response = await api()
        .get('/api/cases')
        .query({ call_id })
        .expect(200);
      expect(cases_response.body).toHaveLength(1);
      expect(cases_response.body[0].facts.vulnerability_signals).toEqual([
        'CONFUSION',
      ]);
    });

    it('gets an unverified, unknown caller a person and closes the case when they join', async () => {
      const call_id = await startCall({
        customer_id: null,
        customer_name: null,
        caller_number: '+61491579999',
        identity_verified: false,
      });
      const proposal_response = await api()
        .post('/api/actions/propose')
        .send({
          call_id,
          action_code: 'HUMAN_CALLBACK',
          params: { reason: 'Wants to talk to a person about a letter.' },
          summary: 'Caller asked for a person.',
        })
        .expect(200);
      expect(proposal_response.body).toMatchObject({
        tier: 3,
        status: 'ESCALATED',
        matched_rule_id: 'HC-DEFAULT',
        required_skill: 'FRONTLINE',
        handled_by: { name: 'Jordan Lee' },
      });

      await api()
        .post('/api/notifications/identity_check')
        .send({ call_id })
        .expect(409);

      const joined_response = await api()
        .post('/api/actions/human_joined')
        .send({ call_id, staff_id: 'STF-02' })
        .expect(200);
      expect(joined_response.body).toEqual({
        closed_case_numbers: [proposal_response.body.case_number],
      });
      const cases_response = await api()
        .get('/api/cases')
        .query({ call_id })
        .expect(200);
      expect(cases_response.body[0]).toMatchObject({
        customer_id: 'UNKNOWN',
        customer_name: 'Unknown caller',
        status: 'EXECUTED',
        decision: 'APPROVED',
        decision_reason_code: 'HUMAN_JOINED',
        decided_by: 'STF-02',
      });
    });
  });

  describe('identity push', () => {
    it('is approved by the customer and audited as IDENTITY_VERIFIED', async () => {
      const call_id = await startCall({ ...SARAH, identity_verified: false });
      const push_response = await api()
        .post('/api/notifications/identity_check')
        .send({ call_id })
        .expect(201);
      expect(push_response.body).toMatchObject({
        customer_id: 'CUS-1001',
        channel: 'APP_PUSH',
        kind: 'IDENTITY_CHECK',
        body: 'Is this you calling the bank right now?',
        status: 'SENT',
      });
      const notification_id = push_response.body.notification_id;

      const approve_response = await api()
        .post(`/api/notifications/${notification_id}/response`)
        .send({ response: 'APPROVED' })
        .expect(200);
      expect(approve_response.body).toMatchObject({
        notification_id,
        status: 'APPROVED',
      });
      await api()
        .post(`/api/notifications/${notification_id}/response`)
        .send({ response: 'DENIED' })
        .expect(409);
      const expire_response = await api()
        .post(`/api/notifications/${notification_id}/expire`)
        .expect(200);
      expect(expire_response.body.status).toBe('APPROVED');

      const audit_response = await api()
        .get('/api/audit/events')
        .query({ call_id, event_type: 'IDENTITY_VERIFIED' })
        .expect(200);
      expect(audit_response.body.events).toEqual([
        expect.objectContaining({
          actor_type: 'CUSTOMER',
          actor_id: 'CUS-1001',
        }),
      ]);
    });
  });

  describe('audit ledger', () => {
    it('rejects an attempt to rewrite history', async () => {
      const tamper_response = await api()
        .post('/api/audit/tamper_test')
        .expect(200);
      expect(tamper_response.body.is_rejected).toBe(true);
      expect(tamper_response.body.attempted_sql).toMatch(
        /^UPDATE engine\.audit_events SET actor_id = 'tampered' WHERE event_id = \d+$/,
      );
      expect(tamper_response.body.database_error).toContain('append-only');
      const tampered_rows = await database.query(
        `SELECT 1 FROM engine.audit_events WHERE actor_id = 'tampered'`,
      );
      expect(tampered_rows).toHaveLength(0);
    });

    it('filters and pages newest first', async () => {
      const first_page = await api()
        .get('/api/audit/events')
        .query({ actor_type: 'STAFF', limit: 5 })
        .expect(200);
      expect(first_page.body.events).toHaveLength(5);
      expect(first_page.body.total_count).toBeGreaterThan(5);
      expect(first_page.body.event_types).toEqual(
        expect.arrayContaining([
          'CASE_CREATED',
          'POLICY_EVALUATED',
          'ACTION_EXECUTED',
          'DEMO_RESET',
        ]),
      );
      const occurred_times = first_page.body.events.map(
        (event: { occurred_at: string }) => Date.parse(event.occurred_at),
      );
      expect(
        [...occurred_times].sort((first, second) => second - first),
      ).toEqual(occurred_times);
      const second_page = await api()
        .get('/api/audit/events')
        .query({
          actor_type: 'STAFF',
          limit: 5,
          before_event_id: first_page.body.events[4].event_id,
        })
        .expect(200);
      const first_page_ids = first_page.body.events.map(
        (event: { event_id: number }) => event.event_id,
      );
      expect(
        second_page.body.events.some((event: { event_id: number }) =>
          first_page_ids.includes(event.event_id),
        ),
      ).toBe(false);
    });
  });

  describe('supporting read models', () => {
    it('serves the dashboard, resources, compare and replay endpoints', async () => {
      const kpis_response = await api().get('/api/dashboard/kpis').expect(200);
      expect(kpis_response.body).toMatchObject({
        staff_available: 4,
        cases_auto_resolved_today: 1,
      });
      expect(Object.keys(kpis_response.body).sort()).toEqual([
        'avg_ai_response_ms',
        'calls_today',
        'cases_auto_resolved_today',
        'handled_by_ai',
        'live_calls',
        'needing_attention',
        'staff_available',
        'with_humans',
      ]);

      const workforce_response = await api()
        .get('/api/resources/workforce')
        .expect(200);
      expect(workforce_response.body.staff).toHaveLength(5);
      expect(workforce_response.body.ai_agents).toHaveLength(4);

      const status_response = await api()
        .patch('/api/resources/staff/STF-05/status')
        .send({ status: 'AVAILABLE' })
        .expect(200);
      expect(status_response.body).toMatchObject({
        staff_id: 'STF-05',
        status: 'AVAILABLE',
      });
      await api()
        .patch('/api/resources/staff/STF-05/status')
        .send({ status: 'ON_BREAK' })
        .expect(200);
      await api()
        .patch('/api/resources/staff/STF-05/status')
        .send({ status: 'ASLEEP' })
        .expect(400);

      const routing_response = await api()
        .get('/api/resources/routing')
        .expect(200);
      expect(
        routing_response.body.queues.map(
          (queue: { skill: string }) => queue.skill,
        ),
      ).toEqual(['FRONTLINE', 'HARDSHIP', 'FRAUD', 'CARE']);
      expect(routing_response.body.recent_routes.length).toBeGreaterThan(0);

      const registry_response = await api()
        .get('/api/resources/registry')
        .expect(200);
      const refund_action = registry_response.body.actions.find(
        (action: { action_code: string }) =>
          action.action_code === 'REFUND_FEE',
      );
      expect(refund_action.active_policy).toMatchObject({
        policy_id: 'POL-REFUND_FEE-3',
        version: 3,
      });
      expect(
        refund_action.policy_history.map(
          (policy: { version: number }) => policy.version,
        ),
      ).toEqual([3, 2]);

      const prompts_response = await api()
        .get('/api/resources/prompt_versions')
        .expect(200);
      expect(
        prompts_response.body.map(
          (prompt: { version: string }) => prompt.version,
        ),
      ).toEqual(['1.1', '1.0']);

      const compare_response = await api().get('/api/compare').expect(200);
      expect(compare_response.body.legacy_journey.steps).toHaveLength(5);
      expect(
        compare_response.body.ai_journey.steps.find(
          (step: { label: string }) =>
            step.label === 'Identity confirmed by app push',
        ),
      ).toMatchObject({ duration_seconds: 38, is_measured: true });
      expect(compare_response.body.measured.sample_call_count).toBe(11);
      expect(compare_response.body.ai_journey.total_seconds).toBeLessThan(
        compare_response.body.legacy_journey.total_seconds,
      );

      const calls_response = await api()
        .get('/api/explanations/calls')
        .query({ status: 'ended', limit: 3 })
        .expect(200);
      expect(calls_response.body).toHaveLength(3);
      const timeline_response = await api()
        .get(
          `/api/explanations/calls/${calls_response.body[0].call_id}/timeline`,
        )
        .expect(200);
      expect(timeline_response.body.events).toHaveLength(15);
      expect(
        timeline_response.body.events.filter(
          (event: { kind: string }) => event.kind === 'TOOL',
        ),
      ).toHaveLength(4);
    });

    it('records an autonomy proposal that only a team leader can sign off, without touching live policy', async () => {
      await api()
        .post('/api/resources/autonomy/proposals')
        .send({ staff_id: 'STF-02', action_code: 'HARDSHIP_REQUEST' })
        .expect(409);
      const proposal_response = await api()
        .post('/api/resources/autonomy/proposals')
        .send({ staff_id: 'STF-02', action_code: 'REFUND_FEE' })
        .expect(201);
      expect(proposal_response.body).toMatchObject({
        action_code: 'REFUND_FEE',
        matched_rule_id: 'RF-3',
        status: 'PENDING_SIGN_OFF',
        proposed_by: 'STF-02',
        proposed_by_name: 'Jordan Lee',
      });
      const proposal_id = proposal_response.body.proposal_id;

      const refused_response = await api()
        .post(`/api/resources/autonomy/proposals/${proposal_id}/sign_off`)
        .send({ staff_id: 'STF-02' })
        .expect(403);
      expect(refused_response.body.error_code).toBe('TEAM_LEADER_REQUIRED');
      const signed_response = await api()
        .post(`/api/resources/autonomy/proposals/${proposal_id}/sign_off`)
        .send({ staff_id: 'STF-01' })
        .expect(200);
      expect(signed_response.body).toMatchObject({
        status: 'SIGNED_OFF',
        signed_off_by: 'STF-01',
      });

      const policy = await policies_service.getActivePolicy('REFUND_FEE');
      expect(policy.definition).toEqual(SEEDED_ACTIVE_POLICIES.REFUND_FEE);
      const autonomy_response = await api()
        .get('/api/resources/autonomy')
        .expect(200);
      expect(autonomy_response.body.proposals).toHaveLength(1);
    });
  });
});
