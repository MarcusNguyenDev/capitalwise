import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import {
  addBusinessDays,
  addCalendarDays,
  getBankToday,
} from '../src/shared_kernel/utils/bank_calendar.util';
import { formatSpokenDate } from '../src/shared_kernel/utils/format_spoken_date.util';
import { configureApplication } from '../src/shared_kernel/setup/configure_application';
import {
  applyCoreIdentityUpdate,
  startTestCall,
  TestCaller,
} from './support/test_calls';

// Contract v3 against the real local database: conversational identity with
// step-up, the verified-caller gate, and the self-service actions. The suite
// resets the demo data first, so it is repeatable.

const RESET_TIMEOUT_MS = 120_000;

const SARAH: TestCaller = {
  customer_id: 'CUS-1001',
  customer_name: 'Sarah Mitchell',
  caller_number: '+61491570156',
  identity_level: 0,
};
const DANIEL: TestCaller = {
  customer_id: 'CUS-1002',
  customer_name: 'Daniel Okafor',
  caller_number: '+61491570157',
  identity_level: 2,
};
const MARGARET: TestCaller = {
  customer_id: 'CUS-1004',
  customer_name: 'Margaret Collins',
  caller_number: '+61491570159',
  identity_level: 0,
};
const TOM: TestCaller = {
  customer_id: 'CUS-1005',
  customer_name: 'Tom Barker',
  caller_number: '+61491570110',
  identity_level: 2,
};
const MARCUS: TestCaller = {
  customer_id: 'CUS-1007',
  customer_name: 'Marcus Edward',
  caller_number: '+61491576801',
  identity_level: 2,
};
const BEN: TestCaller = {
  customer_id: 'CUS-3004',
  customer_name: 'Ben Hartley',
  caller_number: '+61491575789',
  identity_level: 2,
};
// A landline that is not on file: no caller-ID customer.
const LANDLINE: TestCaller = {
  customer_id: null,
  customer_name: null,
  caller_number: '+61755501234',
  identity_level: 0,
};

interface QuestionView {
  question_id: string;
  kind: string;
  prompt: string;
}

describe('identity and self-service actions (e2e)', () => {
  let app: INestApplication;
  let database: DatabaseService;

  const api = () => request(app.getHttpServer());

  function startCall(test_caller: TestCaller): Promise<string> {
    return startTestCall(database, test_caller);
  }

  async function startCheck(call_id: string, level: 1 | 2) {
    const response = await api()
      .post('/api/identity/challenges')
      .send({ call_id, level })
      .expect(201);
    return response.body as {
      challenge_id: string;
      level: number;
      questions: QuestionView[];
      guidance: string;
    };
  }

  function answer(
    call_id: string,
    challenge_id: string,
    answers: { question_id: string; answer: string }[],
  ) {
    return api()
      .post(`/api/identity/challenges/${challenge_id}/answers`)
      .send({ call_id, answers });
  }

  async function passLevelOne(
    call_id: string,
    spoken: { name: string; date_of_birth: string; postcode: string },
  ) {
    const check = await startCheck(call_id, 1);
    const response = await answer(call_id, check.challenge_id, [
      { question_id: 'Q1', answer: spoken.name },
      { question_id: 'Q2', answer: spoken.date_of_birth },
      { question_id: 'Q3', answer: spoken.postcode },
    ]).expect(200);
    return response.body;
  }

  function propose(
    call_id: string,
    action_code: string,
    params: Record<string, unknown>,
  ) {
    return api()
      .post('/api/actions/propose')
      .send({ call_id, action_code, params, summary: `${action_code} test.` });
  }

  async function readCardStatus(card_id: string): Promise<string> {
    const card_rows = await database.query<{ status: string }>(
      `SELECT status FROM bank.cards WHERE card_id = $1`,
      [card_id],
    );
    return card_rows[0].status;
  }

  async function readCallAuditEvents(call_id: string) {
    const response = await api()
      .get('/api/audit/events')
      .query({ call_id, limit: 100 })
      .expect(200);
    return response.body.events as {
      event_type: string;
      actor_type: string;
      actor_id: string | null;
      case_number: string | null;
      detail: Record<string, unknown>;
    }[];
  }

  beforeAll(async () => {
    const testing_module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = testing_module.createNestApplication();
    configureApplication(app);
    await app.init();
    database = app.get(DatabaseService);
    await api().post('/api/demo/reset').expect(200, { is_reset: true });
  }, RESET_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
  });

  describe('caller details for the simulated phone (demo mode)', () => {
    it("gives the answers to the caller's own identity questions", async () => {
      const details_response = await api()
        .get('/api/demo/callers/CUS-3002/details')
        .expect(200);
      expect(details_response.body).toMatchObject({
        customer_id: 'CUS-3002',
        full_name: 'Dorothy Evans',
        date_of_birth: '1942-05-12',
        postcode: '4225',
        last_income: { amount: 1144.4, kind: 'GOVT_BENEFIT' },
        card_last_fours: [expect.stringMatching(/^\d{4}$/)],
      });
    });

    it('answers 404 for an unknown customer', async () => {
      const details_response = await api()
        .get('/api/demo/callers/CUS-9999/details')
        .expect(404);
      expect(details_response.body.error_code).toBe('CUSTOMER_NOT_FOUND');
    });
  });

  describe('Sarah: level 1, then level 2 when the task needs it', () => {
    let call_id: string;

    it('refuses account reads and level 2 before level 1', async () => {
      call_id = await startCall(SARAH);
      const overview_response = await api()
        .get('/api/banking/customers/CUS-1001/overview')
        .query({ call_id })
        .expect(403);
      expect(overview_response.body).toEqual({
        status_code: 403,
        error_code: 'IDENTITY_LEVEL_REQUIRED',
        message:
          'Confirm identity to level 1 first: call start_identity_check with level 1.',
        required_level: 1,
        current_level: 0,
      });
      const level_two_response = await api()
        .post('/api/identity/challenges')
        .send({ call_id, level: 2 })
        .expect(409);
      expect(level_two_response.body.error_code).toBe('LEVEL_ONE_REQUIRED');
    });

    it('asks name, date of birth and postcode, and passes on forgiving answers', async () => {
      const check = await startCheck(call_id, 1);
      expect(check).toMatchObject({
        level: 1,
        challenge_id: expect.stringMatching(/^IDC-\d{6}$/),
        guidance: expect.stringContaining('one at a time'),
      });
      expect(check.questions.map((question) => question.kind)).toEqual([
        'FULL_NAME',
        'DATE_OF_BIRTH',
        'POSTCODE',
      ]);

      const incomplete_response = await answer(call_id, check.challenge_id, [
        { question_id: 'Q1', answer: 'Sarah Mitchell' },
      ]).expect(400);
      expect(incomplete_response.body.error_code).toBe(
        'IDENTITY_ANSWERS_INCOMPLETE',
      );

      const passed_response = await answer(call_id, check.challenge_id, [
        { question_id: 'Q1', answer: "It's sarah mitchell" },
        { question_id: 'Q2', answer: 'the 14th of September 1992' },
        { question_id: 'Q3', answer: 'four two two oh' },
      ]).expect(200);
      expect(passed_response.body).toEqual({
        is_passed: true,
        identity_level: 1,
        method: 'KNOWLEDGE',
        customer_id: 'CUS-1001',
        first_name: 'Sarah',
        full_name: 'Sarah Mitchell',
        remaining_attempts: 2,
        is_locked: false,
        concern_case_number: null,
      });

      const identity_response = await api()
        .get(`/api/identity/calls/${call_id}`)
        .expect(200);
      expect(identity_response.body).toEqual({
        call_id,
        identity_level: 1,
        method: 'KNOWLEDGE',
        is_locked: false,
        failed_attempts: 0,
        customer_id: 'CUS-1001',
        concern_case_number: null,
      });
    });

    it('gives a level 1 caller a reduced overview and no level 2 lookups', async () => {
      const overview_response = await api()
        .get('/api/banking/customers/CUS-1001/overview')
        .query({ call_id })
        .expect(200);
      expect(overview_response.body).toEqual({
        customer_id: 'CUS-1001',
        first_name: 'Sarah',
        identity_level: 1,
        is_reduced_view: true,
        accounts: [
          {
            account_id: 'ACC-10011',
            nickname: 'Everyday',
            category: 'TRANSACTION',
            product_name: 'Everyday Account',
          },
        ],
        cards: [
          {
            card_id: 'CRD-10011',
            card_type: 'DEBIT',
            status: 'ACTIVE',
            account_nickname: 'Everyday',
          },
        ],
      });

      for (const lookup_path of [
        'transactions',
        'fee_history',
        'income_summary',
        'loans/ACC-10011',
        'held_payments',
      ]) {
        const lookup_response = await api()
          .get(`/api/banking/customers/CUS-1001/${lookup_path}`)
          .query({ call_id })
          .expect(403);
        expect(lookup_response.body).toEqual({
          status_code: 403,
          error_code: 'IDENTITY_LEVEL_REQUIRED',
          message:
            'Confirm identity to level 2 first: call start_identity_check with level 2.',
          required_level: 2,
          current_level: 1,
        });
      }

      const someone_else = await api()
        .get('/api/banking/customers/CUS-1002/overview')
        .query({ call_id })
        .expect(403);
      expect(someone_else.body.error_code).toBe('CUSTOMER_NOT_VERIFIED_CALLER');
    });

    it('locks, then permanently blocks the lost card at level 1', async () => {
      const lock_response = await propose(call_id, 'LOCK_CARD', {
        card_id: 'CRD-10011',
      }).expect(200);
      expect(lock_response.body).toMatchObject({
        status: 'AUTO_EXECUTED',
        outcome: 'DONE',
        matched_rule_id: 'LC-1',
        policy_id: 'POL-LOCK_CARD-2',
      });
      expect(lock_response.body.customer_message).toBe(
        "Your debit card is now temporarily locked, so nobody can use it, and we can unlock it whenever you're ready.",
      );

      const report_response = await propose(call_id, 'REPORT_LOST_STOLEN', {
        card_id: 'CRD-10011',
        reason: 'lost',
      }).expect(200);
      // Level 1 only: no card digits and no last transaction come back.
      expect(report_response.body).toMatchObject({
        action_code: 'REPORT_LOST_STOLEN',
        tier: 1,
        status: 'AUTO_EXECUTED',
        outcome: 'DONE',
        matched_rule_id: 'RL-1',
        execution_result: {
          card_id: 'CRD-10011',
          card_type: 'DEBIT',
          previous_status: 'TEMP_LOCKED',
          card_status: 'BLOCKED_LOST',
          reason: 'LOST',
        },
        customer_message:
          "I've blocked your debit card for good, so nobody can use it, and I can order you a replacement whenever you're ready.",
      });
      expect(JSON.stringify(report_response.body)).not.toMatch(
        /4821|Pulse|last_transaction|card_last4/,
      );
      // The stored result keeps the detail for staff and the audit trail.
      const executed_events = await readCallAuditEvents(call_id);
      expect(
        executed_events.find(
          (event) =>
            event.event_type === 'ACTION_EXECUTED' &&
            event.case_number === report_response.body.case_number,
        )?.detail,
      ).toMatchObject({
        result: {
          card_last4: '4821',
          last_transaction: { merchant: 'Pulse Gym Cafe', amount: 8.5 },
        },
      });
      expect(await readCardStatus('CRD-10011')).toBe('BLOCKED_LOST');
    });

    it('needs level 2 to order a replacement', async () => {
      const refused_response = await propose(call_id, 'REPLACE_CARD', {
        card_id: 'CRD-10011',
      }).expect(403);
      expect(refused_response.body).toEqual({
        status_code: 403,
        error_code: 'IDENTITY_LEVEL_REQUIRED',
        message:
          'Confirm identity to level 2 first: call start_identity_check with level 2.',
        required_level: 2,
        current_level: 1,
      });
    });

    it('steps up with a question about her own recent activity', async () => {
      const check = await startCheck(call_id, 2);
      expect(check.questions).toEqual([
        {
          question_id: 'Q1',
          kind: 'LAST_INCOME_AMOUNT',
          prompt: 'Roughly how much was your last pay into your account?',
        },
        {
          question_id: 'Q2',
          kind: 'RECENT_CARD_MERCHANT',
          prompt:
            'Can you tell me the name of a shop or business where you used your card in the last week?',
        },
      ]);
      expect(check.guidance).toBe(
        "Ask one of these two; offer the other if the caller can't answer. Submit what the caller said.",
      );
      const passed_response = await answer(call_id, check.challenge_id, [
        { question_id: 'Q1', answer: "I'm not sure" },
        { question_id: 'Q2', answer: 'the Pulse gym cafe' },
      ]).expect(200);
      expect(passed_response.body).toMatchObject({
        is_passed: true,
        identity_level: 2,
        customer_id: 'CUS-1001',
        first_name: 'Sarah',
      });

      const overview_response = await api()
        .get('/api/banking/customers/CUS-1001/overview')
        .query({ call_id })
        .expect(200);
      expect(overview_response.body).toMatchObject({
        customer_id: 'CUS-1001',
        identity_level: 2,
        is_reduced_view: false,
        suburb: 'Burleigh Heads',
        preferences: { sms_alerts: true, large_print_letters: false },
        cards: [
          expect.objectContaining({ card_id: 'CRD-10011', last4: '4821' }),
        ],
      });
      expect(overview_response.body).not.toHaveProperty('date_of_birth');
      expect(overview_response.body).not.toHaveProperty('postcode');
      expect(overview_response.body).not.toHaveProperty('street_address');
      const transactions_response = await api()
        .get('/api/banking/customers/CUS-1001/transactions')
        .query({ call_id })
        .expect(200);
      expect(transactions_response.body.account_id).toBe('ACC-10011');
    });

    it('orders the replacement card to the address on file (AUTO)', async () => {
      const expected_by = addBusinessDays(getBankToday(), 5);
      const replace_response = await propose(call_id, 'REPLACE_CARD', {
        card_id: 'CRD-10011',
      }).expect(200);
      expect(replace_response.body).toMatchObject({
        status: 'AUTO_EXECUTED',
        outcome: 'DONE',
        matched_rule_id: 'RC-4',
        policy_id: 'POL-REPLACE_CARD-1',
        execution_result: {
          replaces_card_id: 'CRD-10011',
          old_card_status: 'BLOCKED_LOST',
          new_card_id: expect.stringMatching(/^CRD-9\d{4}$/),
          new_card_status: 'INACTIVE',
          delivery_suburb: 'Burleigh Heads',
          expected_by,
        },
        customer_message: `I've ordered a replacement card. It will arrive at your address in Burleigh Heads by ${formatSpokenDate(expected_by)}, and your old card is now blocked.`,
      });
      const new_card_id = replace_response.body.execution_result.new_card_id;
      const order_rows = await database.query(
        `SELECT customer_id, replaces_card_id, new_card_id, delivery_suburb, status, expected_by, case_number
         FROM bank.card_orders WHERE new_card_id = $1`,
        [new_card_id],
      );
      expect(order_rows).toEqual([
        {
          customer_id: 'CUS-1001',
          replaces_card_id: 'CRD-10011',
          new_card_id,
          delivery_suburb: 'Burleigh Heads',
          status: 'ORDERED',
          expected_by,
          case_number: replace_response.body.case_number,
        },
      ]);
      expect(await readCardStatus('CRD-10011')).toBe('BLOCKED_LOST');
      expect(await readCardStatus(new_card_id)).toBe('INACTIVE');

      const activate_response = await propose(call_id, 'ACTIVATE_CARD', {
        card_id: new_card_id,
      }).expect(200);
      expect(activate_response.body).toMatchObject({
        status: 'AUTO_EXECUTED',
        matched_rule_id: 'AC-1',
      });
      expect(await readCardStatus(new_card_id)).toBe('ACTIVE');
    });

    it('audits every identity step without the answers', async () => {
      const events = await readCallAuditEvents(call_id);
      const identity_events = events
        .filter((event) => event.event_type.startsWith('IDENTITY_'))
        .reverse();
      expect(identity_events.map((event) => event.event_type)).toEqual([
        'IDENTITY_CHECK_STARTED',
        'IDENTITY_CHECK_PASSED',
        'IDENTITY_VERIFIED',
        'IDENTITY_CHECK_STARTED',
        'IDENTITY_CHECK_PASSED',
        'IDENTITY_VERIFIED',
      ]);
      expect(
        identity_events.filter(
          (event) => event.event_type === 'IDENTITY_VERIFIED',
        ),
      ).toEqual([
        expect.objectContaining({
          actor_type: 'CUSTOMER',
          actor_id: 'CUS-1001',
          detail: expect.objectContaining({ method: 'KNOWLEDGE', level: 1 }),
        }),
        expect.objectContaining({
          detail: expect.objectContaining({ method: 'KNOWLEDGE', level: 2 }),
        }),
      ]);
      const audit_text = JSON.stringify(identity_events);
      expect(audit_text).not.toMatch(/1992|4220|Pulse|Mitchell|3180/i);
      const attempt_rows = await database.query(
        `SELECT level, question_kinds, is_passed, resolved_customer_id
         FROM engine.identity_attempts WHERE call_id = $1 ORDER BY created_at`,
        [call_id],
      );
      expect(attempt_rows).toEqual([
        {
          level: 1,
          question_kinds: ['FULL_NAME', 'DATE_OF_BIRTH', 'POSTCODE'],
          is_passed: true,
          resolved_customer_id: 'CUS-1001',
        },
        {
          level: 2,
          question_kinds: ['LAST_INCOME_AMOUNT', 'RECENT_CARD_MERCHANT'],
          is_passed: true,
          resolved_customer_id: 'CUS-1001',
        },
      ]);
    });
  });

  describe('card replacement after a recent address change', () => {
    it('goes to a specialist for Ben Hartley, who moved 9 days ago', async () => {
      const call_id = await startCall(BEN);
      const response = await propose(call_id, 'REPLACE_CARD', {
        card_id: 'CRD-30041',
      }).expect(200);
      expect(response.body).toMatchObject({
        tier: 3,
        status: 'ESCALATED',
        outcome: 'WITH_SPECIALIST',
        matched_rule_id: 'RC-2',
        reason:
          'Recent address change: a specialist confirms where to send it.',
        required_skill: 'FRONTLINE',
        handled_by: { name: 'Jordan Lee' },
        is_executed: false,
      });
      expect(response.body.customer_message).toMatch(
        /^Because your address changed recently, Jordan Lee will join you in about \d+ minutes? to confirm where to send your new card and already has the full details; your case number is CASE-\d{6}\.$/,
      );
      expect(await readCardStatus('CRD-30041')).toBe('ACTIVE');
      const order_rows = await database.query(
        `SELECT 1 FROM bank.card_orders WHERE customer_id = 'CUS-3004'`,
      );
      expect(order_rows).toHaveLength(0);
    });
  });

  describe('fee refunds under REFUND_FEE v4', () => {
    it('refunds Daniel automatically (RF-3, earned autonomy)', async () => {
      const call_id = await startCall(DANIEL);
      const response = await propose(call_id, 'REFUND_FEE', {
        fee_txn_id: 'TXN-F1002',
      }).expect(200);
      expect(response.body).toMatchObject({
        tier: 1,
        route: 'AUTO',
        status: 'AUTO_EXECUTED',
        outcome: 'DONE',
        matched_rule_id: 'RF-3',
        policy_id: 'POL-REFUND_FEE-4',
        policy_version: 4,
        is_executed: true,
        execution_result: {
          fee_txn_id: 'TXN-F1002',
          account_id: 'ACC-10021',
          amount: 15,
        },
        customer_message:
          "I've refunded the $15.00 overdrawn fee, and it's back in your everyday account now.",
      });
      const refund_rows = await database.query(
        `SELECT amount, status FROM bank.transactions WHERE reverses_txn_id = 'TXN-F1002' AND txn_type = 'FEE_REFUND'`,
      );
      expect(refund_rows).toEqual([{ amount: 15, status: 'POSTED' }]);
    });

    it("declines Tom's third refund on the spot and executes nothing (RF-2)", async () => {
      const call_id = await startCall(TOM);
      const response = await propose(call_id, 'REFUND_FEE', {
        fee_txn_id: 'TXN-F1005',
      }).expect(200);
      expect(response.body).toMatchObject({
        tier: 1,
        route: 'AUTO',
        status: 'AUTO_DECLINED',
        outcome: 'DECLINED',
        recommendation: 'DECLINE',
        matched_rule_id: 'RF-2',
        is_executed: false,
        execution_result: null,
        handled_by: null,
        customer_message:
          "I'm sorry, I can't refund the $20.00 fee, because there have already been 2 fee refunds in the last 12 months, but if you'd like, I can ask a specialist to review it.",
      });
      const refund_rows = await database.query(
        `SELECT 1 FROM bank.transactions WHERE reverses_txn_id = 'TXN-F1005'`,
      );
      expect(refund_rows).toHaveLength(0);
      const notifications_response = await api()
        .get('/api/notifications')
        .query({ call_id })
        .expect(200);
      expect(notifications_response.body).toEqual([
        expect.objectContaining({
          channel: 'SMS',
          case_number: response.body.case_number,
          body: expect.stringContaining("can't refund it this time"),
        }),
      ]);
      const repeat_response = await propose(call_id, 'REFUND_FEE', {
        fee_txn_id: 'TXN-F1005',
      }).expect(200);
      expect(repeat_response.body.case_number).toBe(response.body.case_number);

      const inbox_response = await api()
        .get('/api/approvals/inbox')
        .expect(200);
      expect(inbox_response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            case_number: 'CASE-001100',
            status: 'PENDING_APPROVAL',
          }),
        ]),
      );
    });
  });

  describe('Marcus: dispute, payment arrangement and preferences', () => {
    let call_id: string;

    async function readEverydayBalance(): Promise<number> {
      const balance_rows = await database.query<{ current_balance: number }>(
        `SELECT current_balance FROM bank.accounts WHERE account_id = 'ACC-10071'`,
      );
      return balance_rows[0].current_balance;
    }

    it('lodges the Northshore Electronics duplicate with a provisional credit (RD-3)', async () => {
      call_id = await startCall(MARCUS);
      const balance_before = await readEverydayBalance();
      const response = await propose(call_id, 'RAISE_DISPUTE', {
        txn_id: 'TXN-P1007B',
        reason: 'DUPLICATE',
        details: 'Charged twice for the same headphones.',
      }).expect(200);
      expect(response.body).toMatchObject({
        status: 'AUTO_EXECUTED',
        outcome: 'DONE',
        matched_rule_id: 'RD-3',
        required_skill: null,
        execution_result: {
          txn_id: 'TXN-P1007B',
          account_id: 'ACC-10071',
          reason: 'DUPLICATE',
          amount: 264,
          status: 'LODGED',
          merchant: 'Northshore Electronics',
          provisional_credit_amount: 264,
          expected_by: addBusinessDays(getBankToday(), 5),
        },
      });
      expect(response.body.customer_message).toContain(
        'put $264.00 back in your account while we investigate',
      );
      const credit_rows = await database.query(
        `SELECT txn_type, status, amount, reverses_txn_id FROM bank.transactions WHERE txn_id = $1`,
        [response.body.execution_result.provisional_credit_txn_id],
      );
      expect(credit_rows).toEqual([
        {
          txn_type: 'DISPUTE_CREDIT',
          status: 'POSTED',
          amount: 264,
          reverses_txn_id: 'TXN-P1007B',
        },
      ]);
      expect(await readEverydayBalance()).toBeCloseTo(balance_before + 264, 2);
      const pack_response = await api()
        .get(`/api/cases/${response.body.case_number}`)
        .expect(200);
      expect(pack_response.body.case.facts).toMatchObject({
        identity_level: 2,
        dispute_reason: 'DUPLICATE',
        is_duplicate_confirmed: true,
        duplicate_of_txn_id: 'TXN-P1007A',
        txn_amount: 264,
      });
    });

    it('treats the other half of the pair as the genuine charge (no second credit)', async () => {
      const response = await propose(call_id, 'RAISE_DISPUTE', {
        txn_id: 'TXN-P1007A',
        reason: 'DUPLICATE',
      }).expect(200);
      expect(response.body).toMatchObject({
        matched_rule_id: 'RD-DEFAULT',
        status: 'AUTO_EXECUTED',
        execution_result: { provisional_credit_txn_id: null },
      });
      const repeat_response = await propose(call_id, 'RAISE_DISPUTE', {
        txn_id: 'TXN-P1007B',
        reason: 'DUPLICATE',
      }).expect(200);
      expect(repeat_response.body.matched_rule_id).toBe('RD-3');
    });

    it('sets up a short payment arrangement on the home loan (PA-3)', async () => {
      const start_on = getBankToday();
      const response = await propose(call_id, 'PAYMENT_ARRANGEMENT', {
        account_id: 'ACC-10074',
        weeks: 4,
      }).expect(200);
      expect(response.body).toMatchObject({
        status: 'AUTO_EXECUTED',
        matched_rule_id: 'PA-3',
        execution_result: {
          account_id: 'ACC-10074',
          weeks: 4,
          weekly_amount: null,
          start_on,
          end_on: addCalendarDays(start_on, 28),
          status: 'ACTIVE',
          late_fees_paused: true,
        },
        customer_message: `I've set up a 4-week payment arrangement on your home loan account, from today until ${formatSpokenDate(addCalendarDays(start_on, 28))}, and late fees are paused while it's in place.`,
      });
    });

    it('sends a longer arrangement to a hardship specialist (PA-DEFAULT)', async () => {
      const response = await propose(call_id, 'PAYMENT_ARRANGEMENT', {
        account_id: 'ACC-10073',
        weeks: 10,
      }).expect(200);
      expect(response.body).toMatchObject({
        tier: 2,
        status: 'PENDING_APPROVAL',
        outcome: 'PENDING_REVIEW',
        matched_rule_id: 'PA-DEFAULT',
        required_skill: 'HARDSHIP',
        handled_by: { name: 'Sam Patel' },
      });
      const wrong_account = await propose(call_id, 'PAYMENT_ARRANGEMENT', {
        account_id: 'ACC-10072',
        weeks: 2,
      }).expect(400);
      expect(wrong_account.body.error_code).toBe('ACCOUNT_NOT_ELIGIBLE');
      // A fresh call: on this one ACC-10074 already has an arrangement case.
      const bad_weeks = await propose(
        await startCall(MARCUS),
        'PAYMENT_ARRANGEMENT',
        { account_id: 'ACC-10074', weeks: 20 },
      ).expect(400);
      expect(bad_weeks.body.error_code).toBe('INVALID_ACTION_PARAM');
    });

    it('updates preferences, after which updates go by letter', async () => {
      const response = await propose(call_id, 'UPDATE_PREFERENCES', {
        sms_alerts: false,
        large_print_letters: true,
      }).expect(200);
      expect(response.body).toMatchObject({
        status: 'AUTO_EXECUTED',
        matched_rule_id: 'UP-1',
        execution_result: {
          preferences: {
            paper_statements: false,
            sms_alerts: false,
            large_print_letters: true,
          },
        },
        customer_message:
          'Done: from now on SMS alerts are off and our letters will come in large print.',
      });
      const statement_response = await propose(call_id, 'REQUEST_STATEMENT', {
        account_id: 'ACC-10071',
        months: 3,
        delivery: 'POST',
      }).expect(200);
      expect(statement_response.body).toMatchObject({
        matched_rule_id: 'RS-1',
        execution_result: {
          months: 3,
          delivery: 'POST',
          delivery_to: 'Elanora',
          is_large_print: true,
        },
      });
      const notifications_response = await api()
        .get('/api/notifications')
        .query({ call_id, limit: 1 })
        .expect(200);
      expect(notifications_response.body[0]).toMatchObject({
        case_number: statement_response.body.case_number,
        channel: 'LETTER',
      });
    });
  });

  describe('service requests', () => {
    it('sends a change of address to a specialist, at level 1', async () => {
      const call_id = await startCall({ ...SARAH, identity_level: 1 });
      const response = await propose(call_id, 'SERVICE_REQUEST', {
        request_type: 'change address',
        details: 'Moving to Palm Beach next month.',
      }).expect(200);
      expect(response.body).toMatchObject({
        tier: 3,
        status: 'ESCALATED',
        outcome: 'WITH_SPECIALIST',
        matched_rule_id: 'SR-1',
        reason:
          'Security-sensitive change: a specialist completes it with you.',
        required_skill: 'FRONTLINE',
      });
      expect(response.body.customer_message).toMatch(/^For your security, /);
      const unverified_call_id = await startCall(SARAH);
      const refused = await propose(unverified_call_id, 'SERVICE_REQUEST', {
        request_type: 'CHANGE_ADDRESS',
      }).expect(403);
      expect(refused.body).toMatchObject({
        error_code: 'IDENTITY_LEVEL_REQUIRED',
        required_level: 1,
        current_level: 0,
      });
    });
  });

  describe('lockout after two failed attempts', () => {
    it('locks the call and raises a fraud case, never saying which answer was wrong', async () => {
      const call_id = await startCall(MARGARET);
      const check = await startCheck(call_id, 1);
      const wrong_answers = [
        { question_id: 'Q1', answer: 'Margaret Collins' },
        { question_id: 'Q2', answer: '3rd of March 1950' },
        { question_id: 'Q3', answer: '4221' },
      ];
      const first_response = await answer(
        call_id,
        check.challenge_id,
        wrong_answers,
      ).expect(200);
      expect(first_response.body).toEqual({
        is_passed: false,
        identity_level: 0,
        method: 'KNOWLEDGE',
        customer_id: null,
        first_name: null,
        full_name: null,
        remaining_attempts: 1,
        is_locked: false,
        concern_case_number: null,
      });
      const second_response = await answer(
        call_id,
        check.challenge_id,
        wrong_answers,
      ).expect(200);
      expect(second_response.body).toMatchObject({
        is_passed: false,
        identity_level: 0,
        remaining_attempts: 0,
        is_locked: true,
        concern_case_number: expect.stringMatching(/^CASE-\d{6}$/),
      });
      const concern_case_number = second_response.body.concern_case_number;

      const pack_response = await api()
        .get(`/api/cases/${concern_case_number}`)
        .expect(200);
      expect(pack_response.body.case).toMatchObject({
        action_code: 'HUMAN_CALLBACK',
        tier: 3,
        status: 'ESCALATED',
        required_skill: 'FRAUD',
        assigned_staff_name: 'Morgan Taylor',
        customer_id: 'CUS-1004',
      });
      expect(pack_response.body.case.soft_signals.fraud_signals).toEqual([
        'IDENTITY_CHECK_FAILED',
      ]);

      const locked_retry = await answer(
        call_id,
        check.challenge_id,
        wrong_answers,
      ).expect(409);
      expect(locked_retry.body.error_code).toBe('IDENTITY_LOCKED');
      const locked_start = await api()
        .post('/api/identity/challenges')
        .send({ call_id, level: 1 })
        .expect(409);
      expect(locked_start.body.error_code).toBe('IDENTITY_LOCKED');
      const locked_read = await api()
        .get('/api/banking/customers/CUS-1004/held_payments')
        .query({ call_id })
        .expect(409);
      expect(locked_read.body.error_code).toBe('IDENTITY_LOCKED');
      await api()
        .post('/api/notifications/identity_check')
        .send({ call_id })
        .expect(409);

      const identity_response = await api()
        .get(`/api/identity/calls/${call_id}`)
        .expect(200);
      expect(identity_response.body).toEqual({
        call_id,
        identity_level: 0,
        method: null,
        is_locked: true,
        failed_attempts: 2,
        customer_id: null,
        concern_case_number,
      });

      const events = await readCallAuditEvents(call_id);
      const event_types = events.map((event) => event.event_type);
      expect(
        event_types.filter(
          (event_type) => event_type === 'IDENTITY_CHECK_FAILED',
        ),
      ).toHaveLength(2);
      expect(
        events.find((event) => event.event_type === 'IDENTITY_LOCKED'),
      ).toMatchObject({ case_number: concern_case_number });
      expect(JSON.stringify(events)).not.toMatch(/1950|4221|Margaret Collins/);
    });
  });

  describe('customer resolution', () => {
    it('binds a landline that is not on file to the one customer who fits', async () => {
      const call_id = await startCall(LANDLINE);
      const result = await passLevelOne(call_id, {
        name: 'Dorothy Evans',
        date_of_birth: '12th of May 1942',
        postcode: '4225',
      });
      expect(result).toMatchObject({
        is_passed: true,
        identity_level: 1,
        customer_id: 'CUS-3002',
        first_name: 'Dorothy',
      });
      const events = await readCallAuditEvents(call_id);
      expect(
        events.find((event) => event.event_type === 'IDENTITY_CHECK_PASSED')
          ?.detail,
      ).toMatchObject({ resolution: 'SOLE_MATCH' });

      const before_core_update = await propose(call_id, 'REQUEST_STATEMENT', {
        account_id: 'ACC-30021',
        months: 1,
        delivery: 'POST',
      }).expect(409);
      expect(before_core_update.body.error_code).toBe(
        'VERIFIED_CALLER_MISMATCH',
      );

      await applyCoreIdentityUpdate(database, {
        call_id,
        customer_id: 'CUS-3002',
        customer_name: 'Dorothy Evans',
        identity_level: 1,
      });
      const statement_response = await propose(call_id, 'REQUEST_STATEMENT', {
        account_id: 'ACC-30021',
        months: 1,
        delivery: 'POST',
      }).expect(200);
      expect(statement_response.body).toMatchObject({
        status: 'AUTO_EXECUTED',
        execution_result: {
          customer_id: 'CUS-3002',
          delivery_to: 'Coolangatta',
          is_large_print: true,
        },
      });
      expect(statement_response.body.customer_message).toBe(
        `I've ordered the last month of statements for your everyday account in large print, and they'll be posted to your address in Coolangatta by ${formatSpokenDate(addBusinessDays(getBankToday(), 5))}.`,
      );
    });

    it("binds a spouse on a shared number to her own record, not the number's owner", async () => {
      const call_id = await startCall({ ...TOM, identity_level: 0 });
      const result = await passLevelOne(call_id, {
        name: 'Emma Barker',
        date_of_birth: '11/02/1983',
        postcode: '4211',
      });
      expect(result).toMatchObject({
        is_passed: true,
        customer_id: 'CUS-1006',
      });
    });

    it('returns 404 for an unknown call', async () => {
      const response = await api()
        .get('/api/identity/calls/00000000-0000-4000-8000-000000000000')
        .expect(404);
      expect(response.body.error_code).toBe('CALL_NOT_FOUND');
    });
  });
});
