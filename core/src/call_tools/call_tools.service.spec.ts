import { AuditEventsRepository } from '../audit/audit_events.repository';
import { CallHoldService } from '../calls/call_hold.service';
import { CallsService } from '../calls/calls.service';
import { CallEndedError } from '../calls/errors/call_ended.error';
import { CallChanges, CallRow } from '../calls/types/call_row.type';
import { EngineApiClient } from '../engine_api/engine_api.client';
import { EngineApiRejectedError } from '../engine_api/errors/engine_api_rejected.error';
import { EngineApiUnavailableError } from '../engine_api/errors/engine_api_unavailable.error';
import { LiveEventBus } from '../live/live_event_bus.service';
import { CallToolsService } from './call_tools.service';
import { ActionToolsHandler } from './handlers/action_tools.handler';
import { BankingLookupToolsHandler } from './handlers/banking_lookup_tools.handler';
import { CallInsightToolsHandler } from './handlers/call_insight_tools.handler';
import { CallerIdentityToolsHandler } from './handlers/caller_identity_tools.handler';
import { IdentityCheckToolsHandler } from './handlers/identity_check_tools.handler';
import { IdentityPushWaiter } from './identity_push_waiter.service';

const CALL_ID = '0b0f7c0e-5d3a-4f6e-9a55-3a3f3a3f3a3f';

function buildCall(call_overrides: Partial<CallRow> = {}): CallRow {
  return {
    call_id: CALL_ID,
    caller_number: '+61491570156',
    customer_id: 'CUS-1001',
    customer_name: 'Sarah Mitchell',
    channel: 'BROWSER',
    status: 'AI_ACTIVE',
    handled_by_agent_id: 'AI-01',
    assigned_staff_id: null,
    identity_verified: true,
    identity_level: 2,
    identity_method: 'KNOWLEDGE',
    is_identity_locked: false,
    verified_at: new Date(),
    intent: null,
    sentiment: 'NEUTRAL',
    risk_level: 'LOW',
    attention_reason: null,
    started_at: new Date(Date.now() - 20_000),
    ended_at: null,
    ai_summary: null,
    metrics: {},
    ...call_overrides,
  };
}

const LEVEL_ONE_CHALLENGE = {
  challenge_id: 'IDC-000001',
  level: 1,
  questions: [
    { question_id: 'Q1', kind: 'FULL_NAME', prompt: "What's your full name?" },
    {
      question_id: 'Q2',
      kind: 'DATE_OF_BIRTH',
      prompt: "What's your date of birth?",
    },
    { question_id: 'Q3', kind: 'POSTCODE', prompt: "What's your postcode?" },
  ],
  guidance: 'Ask these one at a time.',
};

const PASSED_LEVEL_ONE = {
  is_passed: true,
  identity_level: 1,
  method: 'KNOWLEDGE',
  customer_id: 'CUS-1001',
  first_name: 'Sarah',
  full_name: 'Sarah Mitchell',
  remaining_attempts: 2,
  is_locked: false,
  concern_case_number: null,
};

const UNCONFIRMED_CALL = {
  identity_verified: false,
  identity_level: 0,
  identity_method: null,
  verified_at: null,
} as const;

function buildProposalResult(result_overrides: Record<string, unknown> = {}) {
  return {
    case_number: 'CASE-001101',
    action_code: 'REFUND_FEE',
    tier: 2,
    route: 'APPROVE',
    status: 'PENDING_APPROVAL',
    recommendation: 'APPROVE',
    confidence: 0.92,
    matched_rule_id: 'RF-3',
    reason: 'First refund, long-standing customer, low-value fee',
    policy_id: 'POL-REFUND_FEE-3',
    policy_version: 3,
    required_skill: 'FRONTLINE',
    routing_rule: 'Least-loaded available specialist with the FRONTLINE skill',
    handled_by: { staff_id: 'STF-02', name: 'Jordan Lee', role: 'FRONTLINE' },
    expected_timing: 'within 4 business hours',
    expected_wait_minutes: null,
    response_due_on: null,
    is_executed: false,
    execution_result: null,
    customer_message: 'Your request has been sent for review.',
    ...result_overrides,
  };
}

function buildHarness(call: CallRow) {
  const applied_call_changes: (CallChanges | null)[] = [];
  const calls_service = {
    getActiveCall: jest.fn().mockResolvedValue(call),
    buildAgentActor: jest.fn().mockReturnValue({
      actor_type: 'AI',
      actor_id: call.handled_by_agent_id,
    }),
    withLockedCall: jest.fn(async (_call_id, _actor, work) =>
      work(call, { query: jest.fn() }),
    ),
    insertTurnInTransaction: jest.fn(async (_transaction, new_turn) => ({
      turn_id: 1,
      seq: 1,
      ...new_turn,
    })),
    broadcastTurn: jest.fn(),
    changeCall: jest.fn(async (_call_id, _actor, buildCallChanges) => {
      applied_call_changes.push(
        await buildCallChanges(call, { query: jest.fn() }),
      );
      return call;
    }),
    findCaseAssignedStaffIdInTransaction: jest.fn().mockResolvedValue('STF-04'),
  };
  const audit_events_repository = {
    insertEvent: jest.fn().mockResolvedValue(undefined),
  };
  const engine_api_client = {
    lookupCustomer: jest.fn(),
    getCustomerOverview: jest.fn(),
    getTransactions: jest
      .fn()
      .mockResolvedValue({ account_id: 'ACC-10011', transactions: [] }),
    getFeeHistory: jest
      .fn()
      .mockResolvedValue({ fees: [], refunds_last_12m: 0 }),
    getIncomeSummary: jest.fn(),
    getLoanDetails: jest.fn(),
    getHeldPayments: jest.fn(),
    proposeAction: jest.fn().mockResolvedValue(buildProposalResult()),
    flagConcern: jest.fn(),
    createIdentityCheck: jest
      .fn()
      .mockResolvedValue({ notification_id: 'NTF-00001', status: 'SENT' }),
    startIdentityChallenge: jest.fn().mockResolvedValue(LEVEL_ONE_CHALLENGE),
    submitIdentityAnswers: jest.fn().mockResolvedValue(PASSED_LEVEL_ONE),
    expireNotification: jest.fn().mockResolvedValue({}),
  };
  const identity_push_waiter = {
    waitForAnswer: jest.fn().mockResolvedValue('APPROVED'),
  };
  const live_event_bus = new LiveEventBus();
  const call_hold_service = {
    startHold: jest.fn().mockResolvedValue(undefined),
    endHold: jest.fn().mockResolvedValue(0),
  };

  const typed_calls_service = calls_service as unknown as CallsService;
  const typed_api_client = engine_api_client as unknown as EngineApiClient;
  const call_tools_service = new CallToolsService(
    typed_calls_service,
    audit_events_repository as unknown as AuditEventsRepository,
    call_hold_service as unknown as CallHoldService,
    new CallerIdentityToolsHandler(
      typed_api_client,
      typed_calls_service,
      identity_push_waiter as unknown as IdentityPushWaiter,
      live_event_bus,
    ),
    new IdentityCheckToolsHandler(typed_api_client, typed_calls_service),
    new BankingLookupToolsHandler(typed_api_client),
    new ActionToolsHandler(typed_api_client, typed_calls_service),
    new CallInsightToolsHandler(typed_calls_service),
  );
  return {
    call_tools_service,
    calls_service,
    audit_events_repository,
    engine_api_client,
    identity_push_waiter,
    live_event_bus,
    call_hold_service,
    applied_call_changes,
  };
}

describe('CallToolsService', () => {
  describe('unknown tools and preconditions', () => {
    it('answers ok:false UNKNOWN_TOOL and still records the attempt', async () => {
      const harness = buildHarness(buildCall());

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'transfer_money',
        { amount: 1 },
      );

      expect(tool_outcome).toMatchObject({
        ok: false,
        error: { code: 'UNKNOWN_TOOL' },
      });
      expect(
        harness.calls_service.insertTurnInTransaction,
      ).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          speaker: 'SYSTEM',
          tool_name: 'transfer_money',
          tool_args: { amount: 1 },
          tool_result: {
            error: expect.objectContaining({ code: 'UNKNOWN_TOOL' }),
          },
        }),
      );
      expect(harness.audit_events_repository.insertEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          event_type: 'TOOL_CALL',
          call_id: CALL_ID,
          detail: expect.objectContaining({
            tool_name: 'transfer_money',
            ok: false,
            error_code: 'UNKNOWN_TOOL',
          }),
        }),
      );
      expect(harness.calls_service.broadcastTurn).toHaveBeenCalledTimes(1);
    });

    it.each([
      'get_customer_overview',
      'get_recent_transactions',
      'get_fee_history',
      'get_income_summary',
      'get_loan_details',
      'get_held_payments',
      'lock_card',
      'propose_action',
    ])(
      'rejects %s before identity level 1 without touching the api',
      async (tool_name) => {
        const harness = buildHarness(buildCall(UNCONFIRMED_CALL));

        const tool_outcome = await harness.call_tools_service.dispatchTool(
          CALL_ID,
          tool_name,
          {
            account_id: 'ACC-10011',
            card_id: 'CRD-10011',
          },
        );

        expect(tool_outcome).toMatchObject({
          ok: false,
          error: { code: 'IDENTITY_LEVEL_REQUIRED' },
        });
        if (!tool_outcome.ok) {
          // Level 2 tools ask for level 1 first, then level 2.
          expect(tool_outcome.error.message).toMatch(
            /^Confirm identity to level [12] first: call start_identity_check with level 1/,
          );
        }
        for (const api_method of Object.values(harness.engine_api_client)) {
          expect(api_method).not.toHaveBeenCalled();
        }
      },
    );

    it.each([
      'get_recent_transactions',
      'get_fee_history',
      'get_income_summary',
      'get_loan_details',
      'get_held_payments',
    ])(
      'asks for level 2 before %s reads account details',
      async (tool_name) => {
        const harness = buildHarness(buildCall({ identity_level: 1 }));

        const tool_outcome = await harness.call_tools_service.dispatchTool(
          CALL_ID,
          tool_name,
          { account_id: 'ACC-10011' },
        );

        expect(tool_outcome).toEqual({
          ok: false,
          error: {
            code: 'IDENTITY_LEVEL_REQUIRED',
            message:
              'Confirm identity to level 2 first: call start_identity_check with level 2.',
          },
        });
      },
    );

    it('gives the reduced overview at level 1, marked as such', async () => {
      const harness = buildHarness(buildCall({ identity_level: 1 }));
      harness.engine_api_client.getCustomerOverview.mockResolvedValue({
        customer_id: 'CUS-1001',
        first_name: 'Sarah',
        tenure_years: 6,
        has_care_flag: false,
        is_reduced_view: true,
        accounts: [{ account_id: 'ACC-10011', nickname: 'Everyday' }],
        cards: [{ card_id: 'CRD-10011', card_type: 'DEBIT', status: 'ACTIVE' }],
      });

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'get_customer_overview',
      );

      expect(tool_outcome).toMatchObject({
        ok: true,
        result: { is_reduced_view: true },
      });
      expect(JSON.stringify(tool_outcome)).not.toMatch(/balance|last4\":\"/);
    });

    it('lets the identity-free tools run on an unconfirmed call', async () => {
      const harness = buildHarness(buildCall(UNCONFIRMED_CALL));
      harness.engine_api_client.lookupCustomer.mockResolvedValue({
        matched: true,
        customer_id: 'CUS-1001',
        first_name: 'Sarah',
        full_name: 'Sarah Mitchell',
      });

      const caller_context = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'get_caller_context',
      );
      const call_insight = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'update_call_insight',
        {
          intent: 'Lost card',
          sentiment: 'NEGATIVE',
        },
      );

      // A hint only: never a name, a customer id or a surname.
      expect(caller_context).toEqual({
        ok: true,
        result: { is_known_number: true },
      });
      expect(JSON.stringify(caller_context)).not.toContain('Sarah');
      expect(call_insight).toEqual({ ok: true, result: { updated: true } });
      expect(harness.applied_call_changes).toEqual([
        { intent: 'Lost card', sentiment: 'NEGATIVE' },
      ]);
    });

    it('rejects the app check when the caller ID matched no customer', async () => {
      const harness = buildHarness(
        buildCall({
          ...UNCONFIRMED_CALL,
          customer_id: null,
          customer_name: null,
        }),
      );

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'send_app_identity_check',
      );

      expect(tool_outcome).toMatchObject({
        ok: false,
        error: { code: 'CALLER_NOT_MATCHED' },
      });
      expect(
        harness.engine_api_client.createIdentityCheck,
      ).not.toHaveBeenCalled();
    });

    it('propagates an ended call instead of answering the model', async () => {
      const harness = buildHarness(buildCall());
      harness.calls_service.getActiveCall.mockRejectedValue(
        new CallEndedError(CALL_ID),
      );

      await expect(
        harness.call_tools_service.dispatchTool(CALL_ID, 'get_fee_history'),
      ).rejects.toBeInstanceOf(CallEndedError);
    });
  });

  describe('argument validation', () => {
    it.each([
      ['get_recent_transactions', {}, 'account_id'],
      [
        'get_recent_transactions',
        { account_id: 'ACC-10011', hours: 0 },
        'hours',
      ],
      [
        'get_recent_transactions',
        { account_id: 'ACC-10011', hours: 99999 },
        'hours',
      ],
      [
        'get_recent_transactions',
        { account_id: "ACC-1' OR 1=1" },
        'account_id',
      ],
      ['get_loan_details', { account_id: 42 }, 'account_id'],
      ['lock_card', { card_id: '4821' }, 'card_id'],
      [
        'propose_action',
        { action_code: 'WIRE_FUNDS', params: {}, summary: 'x' },
        'action_code',
      ],
      [
        'propose_action',
        { action_code: 'HUMAN_CALLBACK', params: {}, summary: 'x' },
        'action_code',
      ],
      [
        'propose_action',
        { action_code: 'REFUND_FEE', params: 'TXN-F1002', summary: 'x' },
        'params',
      ],
      ['propose_action', { action_code: 'REFUND_FEE', params: {} }, 'summary'],
      [
        'propose_action',
        {
          action_code: 'REFUND_FEE',
          params: {},
          summary: 'x',
          soft_signals: { quotes: 'not a list' },
        },
        'quotes',
      ],
      ['request_human', {}, 'reason'],
      ['flag_concern', { type: 'SCAM_COACHING', quotes: [] }, 'quotes'],
      ['flag_concern', { type: 'SUSPICIOUS', quotes: ['a'] }, 'type'],
      ['update_call_insight', { sentiment: 'FURIOUS' }, 'sentiment'],
      ['start_identity_check', {}, 'level'],
      ['start_identity_check', { level: 3 }, 'level'],
      ['submit_identity_answers', { answers: [] }, 'challenge_id'],
      [
        'submit_identity_answers',
        { challenge_id: 'IDC-000001', answers: [] },
        'answers',
      ],
      [
        'submit_identity_answers',
        { challenge_id: 'IDC-000001', answers: [{ question_id: 'Q1' }] },
        'answer',
      ],
      [
        'propose_action',
        {
          action_code: 'REPORT_LOST_STOLEN',
          params: { card_id: 'CRD-10011' },
          summary: 'x',
        },
        'reason',
      ],
      [
        'propose_action',
        {
          action_code: 'REPLACE_CARD',
          params: { card_id: '4821' },
          summary: 'x',
        },
        'card_id',
      ],
      [
        'propose_action',
        { action_code: 'REFUND_FEE', params: {}, summary: 'x' },
        'fee_txn_id',
      ],
      [
        'propose_action',
        {
          action_code: 'RAISE_DISPUTE',
          params: { txn_id: 'TXN-1', reason: 'ANGRY', details: 'x' },
          summary: 'x',
        },
        'reason',
      ],
      [
        'propose_action',
        {
          action_code: 'REQUEST_STATEMENT',
          params: { account_id: 'ACC-10011', months: 13, delivery: 'POST' },
          summary: 'x',
        },
        'months',
      ],
      [
        'propose_action',
        { action_code: 'UPDATE_PREFERENCES', params: {}, summary: 'x' },
        'large_print_letters',
      ],
      [
        'propose_action',
        {
          action_code: 'PAYMENT_ARRANGEMENT',
          params: { account_id: 'ACC-10031', weeks: 20 },
          summary: 'x',
        },
        'weeks',
      ],
      [
        'propose_action',
        {
          action_code: 'SERVICE_REQUEST',
          params: { request_type: 42, details: 'x' },
          summary: 'x',
        },
        'request_type',
      ],
    ])('rejects %s with %j', async (tool_name, raw_args, invalid_field) => {
      const harness = buildHarness(buildCall());

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        tool_name,
        raw_args as Record<string, unknown>,
      );

      expect(tool_outcome.ok).toBe(false);
      if (!tool_outcome.ok) {
        expect(tool_outcome.error.code).toBe('INVALID_ARGUMENTS');
        expect(tool_outcome.error.message).toContain(invalid_field);
      }
      expect(harness.engine_api_client.proposeAction).not.toHaveBeenCalled();
      expect(harness.engine_api_client.getTransactions).not.toHaveBeenCalled();
      expect(
        harness.engine_api_client.submitIdentityAnswers,
      ).not.toHaveBeenCalled();
    });

    it('rejects arguments that are not a JSON object', async () => {
      const harness = buildHarness(buildCall());

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'get_fee_history',
        ['ACC-10011'] as unknown as Record<string, unknown>,
      );

      expect(tool_outcome).toMatchObject({
        ok: false,
        error: { code: 'INVALID_ARGUMENTS' },
      });
    });
  });

  describe('customer ownership', () => {
    it('always uses the customer of the call, never one passed in the arguments', async () => {
      const harness = buildHarness(buildCall({ customer_id: 'CUS-1001' }));

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'get_recent_transactions',
        {
          account_id: 'ACC-10041',
          hours: 24,
          customer_id: 'CUS-1004',
        },
      );

      expect(tool_outcome.ok).toBe(true);
      expect(harness.engine_api_client.getTransactions).toHaveBeenCalledWith(
        { customer_id: 'CUS-1001', call_id: CALL_ID },
        {
          account_id: 'ACC-10041',
          hours: 24,
        },
      );
    });

    it.each([
      ['get_customer_overview', {}, 'getCustomerOverview'],
      ['get_fee_history', { customer_id: 'CUS-1004' }, 'getFeeHistory'],
      ['get_income_summary', { customer_id: 'CUS-1004' }, 'getIncomeSummary'],
      [
        'get_loan_details',
        { account_id: 'ACC-10031', customer_id: 'CUS-1004' },
        'getLoanDetails',
      ],
      ['get_held_payments', { customer_id: 'CUS-1004' }, 'getHeldPayments'],
    ] as const)(
      '%s asks the api for the call customer only',
      async (tool_name, raw_args, api_method) => {
        const harness = buildHarness(buildCall({ customer_id: 'CUS-1001' }));
        harness.engine_api_client[api_method].mockResolvedValue({
          accounts: [],
          cards: [],
        });

        await harness.call_tools_service.dispatchTool(
          CALL_ID,
          tool_name,
          raw_args,
        );

        expect(harness.engine_api_client[api_method].mock.calls[0][0]).toEqual({
          customer_id: 'CUS-1001',
          call_id: CALL_ID,
        });
        expect(
          JSON.stringify(harness.engine_api_client[api_method].mock.calls),
        ).not.toContain('CUS-1004');
      },
    );

    it('sends proposals with the call id only, so the api derives the customer', async () => {
      const harness = buildHarness(buildCall());

      await harness.call_tools_service.dispatchTool(CALL_ID, 'propose_action', {
        action_code: 'REFUND_FEE',
        params: { fee_txn_id: 'TXN-F1002' },
        summary: 'Fee refund request',
        customer_id: 'CUS-1004',
      });

      const proposal_request =
        harness.engine_api_client.proposeAction.mock.calls[0][0];
      expect(proposal_request.call_id).toBe(CALL_ID);
      expect(proposal_request).not.toHaveProperty('customer_id');
    });

    it('returns only the trimmed overview to the model', async () => {
      const harness = buildHarness(buildCall());
      harness.engine_api_client.getCustomerOverview.mockResolvedValue({
        customer_id: 'CUS-1001',
        first_name: 'Sarah',
        last_name: 'Mitchell',
        email: 'sarah.mitchell@example.com',
        tenure_years: 6,
        has_care_flag: false,
        accounts: [
          {
            account_id: 'ACC-10011',
            nickname: 'Everyday',
            category: 'TRANSACTION',
            current_balance: 2846.15,
            available_balance: 2837.65,
            daily_transfer_limit: 5000,
          },
        ],
        cards: [
          {
            card_id: 'CRD-10011',
            account_id: 'ACC-10011',
            card_type: 'DEBIT',
            last4: '4821',
            status: 'ACTIVE',
          },
        ],
      });

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'get_customer_overview',
      );

      expect(tool_outcome).toEqual({
        ok: true,
        result: {
          is_reduced_view: false,
          first_name: 'Sarah',
          tenure_years: 6,
          has_care_flag: false,
          accounts: [
            {
              account_id: 'ACC-10011',
              nickname: 'Everyday',
              category: 'TRANSACTION',
              current_balance: 2846.15,
              available_balance: 2837.65,
            },
          ],
          cards: [
            {
              card_id: 'CRD-10011',
              card_type: 'DEBIT',
              last4: '4821',
              status: 'ACTIVE',
            },
          ],
        },
      });
    });
  });

  describe('api failures', () => {
    it('turns an api rejection into ok:false with the api code and message', async () => {
      const harness = buildHarness(buildCall());
      harness.engine_api_client.proposeAction.mockRejectedValue(
        new EngineApiRejectedError({
          api_status_code: 403,
          api_error_code: 'FEE_NOT_OWNED_BY_CALLER',
          api_message: 'That fee does not belong to the caller.',
        }),
      );

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'propose_action',
        {
          action_code: 'REFUND_FEE',
          params: { fee_txn_id: 'TXN-F1005' },
          summary: 'Fee refund request',
        },
      );

      expect(tool_outcome).toEqual({
        ok: false,
        error: {
          code: 'FEE_NOT_OWNED_BY_CALLER',
          message: 'That fee does not belong to the caller.',
        },
      });
    });

    it('answers ok:false when the api is down or a handler throws unexpectedly', async () => {
      const harness = buildHarness(buildCall());
      harness.engine_api_client.getFeeHistory.mockRejectedValueOnce(
        new EngineApiUnavailableError('GET /fee_history', 'fetch failed'),
      );
      harness.engine_api_client.getHeldPayments.mockRejectedValueOnce(
        new TypeError('boom'),
      );

      const unavailable_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'get_fee_history',
      );
      const failed_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'get_held_payments',
      );

      expect(unavailable_outcome).toMatchObject({
        ok: false,
        error: { code: 'ENGINE_API_UNAVAILABLE' },
      });
      expect(failed_outcome).toMatchObject({
        ok: false,
        error: { code: 'TOOL_FAILED' },
      });
    });
  });

  describe('optional app identity check', () => {
    it('returns verified immediately for an already confirmed call', async () => {
      const harness = buildHarness(buildCall({ identity_level: 2 }));

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'send_app_identity_check',
      );

      expect(tool_outcome).toEqual({
        ok: true,
        result: { verified: true, identity_level: 2 },
      });
      expect(
        harness.engine_api_client.createIdentityCheck,
      ).not.toHaveBeenCalled();
    });

    it('grants level 1 by APP_PUSH with the time to identity when the customer approves', async () => {
      const harness = buildHarness(buildCall(UNCONFIRMED_CALL));
      const identity_push_listener = jest.fn();
      harness.live_event_bus.subscribe(
        'internal.identity_push_sent',
        identity_push_listener,
      );

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'send_app_identity_check',
      );
      await new Promise((resolve) => setImmediate(resolve));

      expect(tool_outcome).toEqual({
        ok: true,
        result: { verified: true, identity_level: 1, first_name: 'Sarah' },
      });
      expect(harness.identity_push_waiter.waitForAnswer).toHaveBeenCalledWith({
        notification_id: 'NTF-00001',
        call_id: CALL_ID,
        timeout_ms: 45_000,
      });
      expect(identity_push_listener).toHaveBeenCalledWith({
        call_id: CALL_ID,
        notification_id: 'NTF-00001',
      });
      const [call_changes] = harness.applied_call_changes;
      expect(call_changes).toMatchObject({
        identity_verified: true,
        identity_level: 1,
        identity_method: 'APP_PUSH',
      });
      expect(call_changes?.metrics?.time_to_identity_ms).toBeGreaterThanOrEqual(
        20_000,
      );
    });

    it('raises the risk level when the customer denies', async () => {
      const harness = buildHarness(buildCall(UNCONFIRMED_CALL));
      harness.identity_push_waiter.waitForAnswer.mockResolvedValue('DENIED');

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'send_app_identity_check',
      );

      expect(tool_outcome).toEqual({
        ok: true,
        result: { verified: false, reason: 'DENIED' },
      });
      expect(harness.applied_call_changes).toEqual([{ risk_level: 'MEDIUM' }]);
    });

    it('expires the notification on timeout', async () => {
      const harness = buildHarness(buildCall(UNCONFIRMED_CALL));
      harness.identity_push_waiter.waitForAnswer.mockResolvedValue('TIMEOUT');

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'send_app_identity_check',
      );

      expect(tool_outcome).toEqual({
        ok: true,
        result: { verified: false, reason: 'TIMEOUT' },
      });
      expect(harness.engine_api_client.expireNotification).toHaveBeenCalledWith(
        'NTF-00001',
      );
      expect(harness.applied_call_changes).toEqual([]);
    });
  });

  describe('actions', () => {
    it('maps a card lock to the short result for the model', async () => {
      const harness = buildHarness(buildCall());
      const last_transaction = {
        merchant: 'Pulse Gym Cafe',
        amount: -8.5,
        created_at: '2026-11-15T08:42:00Z',
        status: 'PENDING',
      };
      harness.engine_api_client.proposeAction.mockResolvedValue(
        buildProposalResult({
          action_code: 'LOCK_CARD',
          tier: 1,
          route: 'AUTO',
          status: 'AUTO_EXECUTED',
          handled_by: null,
          is_executed: true,
          execution_result: {
            card_id: 'CRD-10011',
            card_last4: '4821',
            card_status: 'TEMP_LOCKED',
            last_transaction,
          },
          customer_message: 'Your card ending 4821 is now temporarily locked.',
        }),
      );

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'lock_card',
        { card_id: 'CRD-10011' },
      );

      expect(harness.engine_api_client.proposeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          call_id: CALL_ID,
          action_code: 'LOCK_CARD',
          params: { card_id: 'CRD-10011' },
        }),
      );
      expect(tool_outcome).toEqual({
        ok: true,
        result: {
          locked: true,
          case_number: 'CASE-001101',
          card_last4: '4821',
          last_transaction,
          message: 'Your card ending 4821 is now temporarily locked.',
        },
      });
      expect(harness.applied_call_changes).toEqual([]);
      expect(harness.audit_events_repository.insertEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          case_number: 'CASE-001101',
          detail: expect.objectContaining({ ok: true }),
        }),
      );
    });

    it('does not raise attention for a tier 2 proposal', async () => {
      const harness = buildHarness(buildCall());

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'propose_action',
        {
          action_code: 'REFUND_FEE',
          params: { fee_txn_id: 'TXN-F1002' },
          summary: 'Fee refund request',
        },
      );

      expect(tool_outcome).toMatchObject({
        ok: true,
        result: { case_number: 'CASE-001101', tier: 2 },
      });
      expect(harness.calls_service.changeCall).not.toHaveBeenCalled();
    });

    it('sets the call to NEEDS_ATTENTION for a tier 3 proposal', async () => {
      const harness = buildHarness(buildCall());
      harness.engine_api_client.proposeAction.mockResolvedValue(
        buildProposalResult({
          action_code: 'RELEASE_HELD_PAYMENT',
          tier: 3,
          route: 'ESCALATE',
          status: 'ESCALATED',
          reason: 'Payee name does not match',
          handled_by: {
            staff_id: 'STF-04',
            name: 'Morgan Taylor',
            role: 'FRAUD_SPECIALIST',
          },
        }),
      );

      await harness.call_tools_service.dispatchTool(CALL_ID, 'propose_action', {
        action_code: 'RELEASE_HELD_PAYMENT',
        params: { txn_id: 'TXN-H1004' },
        summary: 'Customer wants the held payment released',
      });

      expect(harness.applied_call_changes[0]).toMatchObject({
        status: 'NEEDS_ATTENTION',
        assigned_staff_id: 'STF-04',
        attention_reason: 'Payee name does not match',
      });
    });

    it('routes a request for a person and tells the model who and how long', async () => {
      const harness = buildHarness(buildCall(UNCONFIRMED_CALL));
      harness.engine_api_client.proposeAction.mockResolvedValue(
        buildProposalResult({
          action_code: 'HUMAN_CALLBACK',
          tier: 3,
          status: 'ESCALATED',
          expected_wait_minutes: 2,
          customer_message: 'Jordan Lee will join in about 2 minutes.',
        }),
      );

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'request_human',
        {
          reason: 'Charged twice and wants a person',
        },
      );

      expect(harness.engine_api_client.proposeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action_code: 'HUMAN_CALLBACK',
          params: { reason: 'Charged twice and wants a person' },
        }),
      );
      expect(tool_outcome).toEqual({
        ok: true,
        result: {
          case_number: 'CASE-001101',
          specialist_name: 'Jordan Lee',
          expected_wait_minutes: 2,
          message: 'Jordan Lee will join in about 2 minutes.',
        },
      });
      const [call_changes] = harness.applied_call_changes;
      expect(call_changes).toMatchObject({
        status: 'NEEDS_ATTENTION',
        assigned_staff_id: 'STF-02',
      });
      expect(call_changes?.attention_reason).toContain('Charged twice');
      expect(call_changes?.metrics?.human_requested_at).toEqual(
        expect.any(String),
      );
    });

    it('never downgrades a call a human already took over', async () => {
      const harness = buildHarness(
        buildCall({ status: 'HUMAN_ACTIVE', assigned_staff_id: 'STF-01' }),
      );
      harness.engine_api_client.flagConcern.mockResolvedValue({
        ...buildProposalResult({
          tier: 3,
          handled_by: {
            staff_id: 'STF-04',
            name: 'Morgan Taylor',
            role: 'FRAUD_SPECIALIST',
          },
        }),
        risk_level: 'HIGH',
        concern_type: 'SCAM_COACHING',
      });

      await harness.call_tools_service.dispatchTool(CALL_ID, 'flag_concern', {
        type: 'SCAM_COACHING',
        quotes: ['They told me to move it to a safe account'],
      });

      expect(harness.applied_call_changes).toEqual([{ risk_level: 'HIGH' }]);
    });

    it('flags a concern: high risk, needs attention, named reason', async () => {
      const harness = buildHarness(buildCall());
      harness.engine_api_client.flagConcern.mockResolvedValue({
        ...buildProposalResult({
          tier: 3,
          expected_wait_minutes: 1,
          handled_by: {
            staff_id: 'STF-03',
            name: 'Sam Patel',
            role: 'HARDSHIP_SPECIALIST',
          },
        }),
        risk_level: 'HIGH',
        concern_type: 'VULNERABILITY',
      });

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'flag_concern',
        {
          type: 'VULNERABILITY',
          quotes: ['I get so muddled'],
          signals: ['CONFUSION'],
        },
      );

      expect(harness.engine_api_client.flagConcern).toHaveBeenCalledWith({
        call_id: CALL_ID,
        type: 'VULNERABILITY',
        quotes: ['I get so muddled'],
        signals: ['CONFUSION'],
      });
      expect(tool_outcome).toMatchObject({
        ok: true,
        result: { specialist_name: 'Sam Patel', expected_wait_minutes: 1 },
      });
      expect(harness.applied_call_changes[0]).toMatchObject({
        risk_level: 'HIGH',
        status: 'NEEDS_ATTENTION',
        attention_reason: 'Vulnerability signals',
        assigned_staff_id: 'STF-03',
      });
    });
  });
  describe('identity checks', () => {
    it('starts a challenge and passes the questions through without expected values', async () => {
      const harness = buildHarness(buildCall(UNCONFIRMED_CALL));

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'start_identity_check',
        { level: '1' },
      );

      expect(
        harness.engine_api_client.startIdentityChallenge,
      ).toHaveBeenCalledWith({ call_id: CALL_ID, level: 1 });
      expect(tool_outcome).toEqual({ ok: true, result: LEVEL_ONE_CHALLENGE });
    });

    it('does not start a challenge for a level the call already has', async () => {
      const harness = buildHarness(buildCall({ identity_level: 2 }));

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'start_identity_check',
        { level: 2 },
      );

      expect(tool_outcome).toMatchObject({
        ok: true,
        result: { is_already_confirmed: true, identity_level: 2 },
      });
      expect(
        harness.engine_api_client.startIdentityChallenge,
      ).not.toHaveBeenCalled();
    });

    it.each([
      ['LEVEL_ONE_REQUIRED', /level 1/],
      ['NO_DYNAMIC_QUESTION_AVAILABLE', /request_human/],
      ['IDENTITY_LOCKED', /specialist/],
    ])(
      'answers a %s refusal with a message written for the model',
      async (api_error_code, expected_message) => {
        const harness = buildHarness(buildCall(UNCONFIRMED_CALL));
        harness.engine_api_client.startIdentityChallenge.mockRejectedValue(
          new EngineApiRejectedError({
            api_status_code: 409,
            api_error_code,
            api_message: 'Refused.',
          }),
        );

        const tool_outcome = await harness.call_tools_service.dispatchTool(
          CALL_ID,
          'start_identity_check',
          { level: 2 },
        );

        expect(tool_outcome).toMatchObject({
          ok: false,
          error: { code: api_error_code },
        });
        if (!tool_outcome.ok) {
          expect(tool_outcome.error.message).toMatch(expected_message);
        }
      },
    );

    it('writes the confirmed caller on the call BEFORE answering, then gives the model the first name only', async () => {
      const harness = buildHarness(
        buildCall({
          ...UNCONFIRMED_CALL,
          customer_id: null,
          customer_name: null,
        }),
      );
      const order_of_events: string[] = [];
      harness.calls_service.changeCall.mockImplementation(
        async (_call_id, _actor, buildCallChanges) => {
          order_of_events.push('call updated');
          harness.applied_call_changes.push(
            await buildCallChanges(
              buildCall({ ...UNCONFIRMED_CALL, customer_id: null }),
              {
                query: jest.fn(),
              },
            ),
          );
          return buildCall();
        },
      );
      harness.calls_service.insertTurnInTransaction.mockImplementation(
        async (_transaction, new_turn) => {
          order_of_events.push('tool result recorded');
          return { turn_id: 1, seq: 1, ...new_turn };
        },
      );

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'submit_identity_answers',
        {
          challenge_id: 'IDC-000001',
          answers: [
            { question_id: 'Q1', answer: 'Sarah Mitchell' },
            { question_id: 'Q2', answer: '14th of September 1992' },
            { question_id: 'Q3', answer: '4220' },
          ],
        },
      );

      expect(
        harness.engine_api_client.submitIdentityAnswers,
      ).toHaveBeenCalledWith('IDC-000001', {
        call_id: CALL_ID,
        answers: [
          { question_id: 'Q1', answer: 'Sarah Mitchell' },
          { question_id: 'Q2', answer: '14th of September 1992' },
          { question_id: 'Q3', answer: '4220' },
        ],
      });
      expect(tool_outcome).toEqual({
        ok: true,
        result: { is_passed: true, identity_level: 1, first_name: 'Sarah' },
      });
      expect(order_of_events).toEqual(['call updated', 'tool result recorded']);
      const [call_changes] = harness.applied_call_changes;
      expect(call_changes).toMatchObject({
        customer_id: 'CUS-1001',
        customer_name: 'Sarah Mitchell',
        identity_level: 1,
        identity_method: 'KNOWLEDGE',
        identity_verified: true,
        verified_at: expect.any(Date),
      });
      expect(call_changes?.metrics?.time_to_identity_ms).toBeGreaterThanOrEqual(
        20_000,
      );
    });

    it('drops thousands separators from spoken amounts before the api compares them', async () => {
      const harness = buildHarness(buildCall({ identity_level: 1 }));

      await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'submit_identity_answers',
        {
          challenge_id: 'IDC-000002',
          answers: [{ question_id: 'Q1', answer: 'About $4,210.50, I think' }],
        },
      );

      expect(
        harness.engine_api_client.submitIdentityAnswers.mock.calls[0][1]
          .answers,
      ).toEqual([{ question_id: 'Q1', answer: 'About $4210.50, I think' }]);
    });

    it('steps up from level 1 to level 2 and keeps the first time to identity', async () => {
      const level_one_call = buildCall({
        identity_level: 1,
        metrics: { time_to_identity_ms: 31_000 },
      });
      const harness = buildHarness(level_one_call);
      harness.engine_api_client.submitIdentityAnswers.mockResolvedValue({
        ...PASSED_LEVEL_ONE,
        identity_level: 2,
      });

      await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'submit_identity_answers',
        {
          challenge_id: 'IDC-000002',
          answers: [{ question_id: 'Q4', answer: 'Pulse Gym Cafe' }],
        },
      );

      expect(harness.applied_call_changes[0]).toMatchObject({
        identity_level: 2,
        verified_at: level_one_call.verified_at,
        metrics: { time_to_identity_ms: 31_000 },
      });
    });

    it('binds a landline call to the customer the answers resolved to', async () => {
      const harness = buildHarness(
        buildCall({
          ...UNCONFIRMED_CALL,
          caller_number: '+61755500123',
          customer_id: null,
          customer_name: null,
        }),
      );
      harness.engine_api_client.submitIdentityAnswers.mockResolvedValue({
        ...PASSED_LEVEL_ONE,
        customer_id: 'CUS-2010',
        first_name: 'Grace',
        full_name: 'Grace Papadopoulos',
      });

      await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'submit_identity_answers',
        {
          challenge_id: 'IDC-000003',
          answers: [{ question_id: 'Q1', answer: 'Grace Papadopoulos' }],
        },
      );

      expect(harness.applied_call_changes[0]).toMatchObject({
        customer_id: 'CUS-2010',
        customer_name: 'Grace Papadopoulos',
        identity_level: 1,
      });
    });

    it('never reveals which answer was wrong and leaves the call alone on a failed attempt', async () => {
      const harness = buildHarness(buildCall(UNCONFIRMED_CALL));
      harness.engine_api_client.submitIdentityAnswers.mockResolvedValue({
        ...PASSED_LEVEL_ONE,
        is_passed: false,
        customer_id: null,
        first_name: null,
        full_name: null,
        remaining_attempts: 1,
      });

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'submit_identity_answers',
        {
          challenge_id: 'IDC-000001',
          answers: [{ question_id: 'Q2', answer: '1st of January 1990' }],
        },
      );

      expect(tool_outcome).toMatchObject({
        ok: true,
        result: { is_passed: false, is_locked: false, remaining_attempts: 1 },
      });
      expect(JSON.stringify(tool_outcome)).not.toMatch(/first_name|Sarah/);
      expect(harness.calls_service.changeCall).not.toHaveBeenCalled();
    });

    it('on lock: is_identity_locked, NEEDS_ATTENTION, HIGH risk and the fraud specialist from the concern case', async () => {
      const harness = buildHarness(buildCall(UNCONFIRMED_CALL));
      harness.engine_api_client.submitIdentityAnswers.mockResolvedValue({
        ...PASSED_LEVEL_ONE,
        is_passed: false,
        identity_level: 0,
        customer_id: null,
        first_name: null,
        full_name: null,
        remaining_attempts: 0,
        is_locked: true,
        concern_case_number: 'CASE-001150',
      });

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'submit_identity_answers',
        {
          challenge_id: 'IDC-000001',
          answers: [{ question_id: 'Q2', answer: '1st of January 1990' }],
        },
      );

      expect(tool_outcome).toMatchObject({
        ok: true,
        result: { is_passed: false, is_locked: true },
      });
      expect(
        harness.calls_service.findCaseAssignedStaffIdInTransaction,
      ).toHaveBeenCalledWith(expect.anything(), 'CASE-001150');
      expect(harness.applied_call_changes[0]).toMatchObject({
        is_identity_locked: true,
        status: 'NEEDS_ATTENTION',
        risk_level: 'HIGH',
        assigned_staff_id: 'STF-04',
        attention_reason: 'Identity locked after failed checks',
      });
    });

    it('refuses further identity tools once the call is locked', async () => {
      const harness = buildHarness(
        buildCall({ ...UNCONFIRMED_CALL, is_identity_locked: true }),
      );

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'start_identity_check',
        { level: 1 },
      );

      expect(tool_outcome).toMatchObject({
        ok: false,
        error: { code: 'IDENTITY_LOCKED' },
      });
      expect(
        harness.engine_api_client.startIdentityChallenge,
      ).not.toHaveBeenCalled();
    });
  });

  describe('step-up required by the api', () => {
    it('maps a 403 IDENTITY_LEVEL_REQUIRED into ok:false with a message for the model', async () => {
      const harness = buildHarness(buildCall({ identity_level: 1 }));
      harness.engine_api_client.proposeAction.mockRejectedValue(
        new EngineApiRejectedError({
          api_status_code: 403,
          api_error_code: 'IDENTITY_LEVEL_REQUIRED',
          api_message: 'Identity level 2 required, current level 1.',
          api_details: { required_level: 2, current_level: 1 },
        }),
      );

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'propose_action',
        {
          action_code: 'REPLACE_CARD',
          params: { card_id: 'CRD-10011' },
          summary: 'Replacement for a lost card',
        },
      );

      expect(tool_outcome).toEqual({
        ok: false,
        error: {
          code: 'IDENTITY_LEVEL_REQUIRED',
          message:
            'Confirm identity to level 2 first: call start_identity_check with level 2.',
        },
      });
    });

    it.each([
      ['IDENTITY_LOCKED', 409, /specialist/],
      ['VERIFIED_CALLER_MISMATCH', 409, /start_identity_check/],
      ['CUSTOMER_NOT_VERIFIED_CALLER', 403, /someone other/],
    ])(
      'maps the api identity gate %s to ok:false with a message for the model',
      async (api_error_code, api_status_code, expected_message) => {
        const harness = buildHarness(buildCall());
        harness.engine_api_client.getCustomerOverview.mockRejectedValue(
          new EngineApiRejectedError({
            api_status_code,
            api_error_code,
            api_message: `Call x: ${api_error_code}`,
          }),
        );

        const tool_outcome = await harness.call_tools_service.dispatchTool(
          CALL_ID,
          'get_customer_overview',
        );

        expect(tool_outcome).toMatchObject({
          ok: false,
          error: { code: api_error_code },
        });
        if (!tool_outcome.ok) {
          expect(tool_outcome.error.message).toMatch(expected_message);
        }
      },
    );

    it('maps the same 403 on a lookup', async () => {
      const harness = buildHarness(buildCall({ identity_level: 1 }));
      harness.engine_api_client.getHeldPayments.mockRejectedValue(
        new EngineApiRejectedError({
          api_status_code: 403,
          api_error_code: 'IDENTITY_LEVEL_REQUIRED',
          api_message: 'No.',
          api_details: { required_level: 2, current_level: 1 },
        }),
      );

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'get_held_payments',
      );

      expect(tool_outcome).toMatchObject({
        ok: false,
        error: { code: 'IDENTITY_LEVEL_REQUIRED' },
      });
    });
  });

  describe('new action codes', () => {
    it.each([
      ['REPORT_LOST_STOLEN', { card_id: 'CRD-10011', reason: 'LOST' }],
      ['REPLACE_CARD', { card_id: 'CRD-10011' }],
      ['UNLOCK_CARD', { card_id: 'CRD-90001' }],
      ['ACTIVATE_CARD', { card_id: 'CRD-90001' }],
      [
        'RAISE_DISPUTE',
        { txn_id: 'TXN-5012', reason: 'DUPLICATE', details: 'Charged twice' },
      ],
      [
        'REQUEST_STATEMENT',
        { account_id: 'ACC-10011', months: 3, delivery: 'POST' },
      ],
      ['UPDATE_PREFERENCES', { large_print_letters: true }],
      ['PAYMENT_ARRANGEMENT', { account_id: 'ACC-10031', weeks: 6 }],
      [
        'SERVICE_REQUEST',
        { request_type: 'CHANGE_ADDRESS', details: 'Moving to Tugun' },
      ],
    ])('proposes %s with its validated params', async (action_code, params) => {
      const harness = buildHarness(buildCall());

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'propose_action',
        {
          action_code,
          params: { ...params, customer_id: 'CUS-1004' },
          summary: 'Done on the call',
        },
      );

      expect(tool_outcome.ok).toBe(true);
      expect(harness.engine_api_client.proposeAction).toHaveBeenCalledWith(
        expect.objectContaining({ call_id: CALL_ID, action_code, params }),
      );
    });

    it('normalises loosely written codes and numbers before the api sees them', async () => {
      const harness = buildHarness(buildCall());

      await harness.call_tools_service.dispatchTool(CALL_ID, 'propose_action', {
        action_code: 'REQUEST_STATEMENT',
        params: { account_id: 'ACC-20101', months: '3', delivery: 'post' },
        summary: 'Statements by post',
      });
      await harness.call_tools_service.dispatchTool(CALL_ID, 'propose_action', {
        action_code: 'SERVICE_REQUEST',
        params: { request_type: 'change address', details: 'Moving' },
        summary: 'Address change',
      });

      expect(
        harness.engine_api_client.proposeAction.mock.calls.map(
          ([proposal_request]) => proposal_request.params,
        ),
      ).toEqual([
        { account_id: 'ACC-20101', months: 3, delivery: 'POST' },
        { request_type: 'CHANGE_ADDRESS', details: 'Moving' },
      ]);
    });

    it('passes the outcome and the one-sentence customer message to the model', async () => {
      const harness = buildHarness(buildCall());
      harness.engine_api_client.proposeAction.mockResolvedValue(
        buildProposalResult({
          action_code: 'REPLACE_CARD',
          tier: 1,
          route: 'AUTO',
          status: 'AUTO_EXECUTED',
          outcome: 'DONE',
          is_executed: true,
          customer_message:
            "I've ordered a replacement card. It will arrive at your address in Burleigh Heads by Monday 23 November, and your old card is now blocked.",
        }),
      );

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'propose_action',
        {
          action_code: 'REPLACE_CARD',
          params: { card_id: 'CRD-10011' },
          summary: 'Replacement card',
        },
      );

      expect(tool_outcome).toMatchObject({
        ok: true,
        result: {
          outcome: 'DONE',
          customer_message: expect.stringContaining('replacement card'),
        },
      });
      expect(harness.calls_service.changeCall).not.toHaveBeenCalled();
    });
  });

  describe('hold state', () => {
    it('puts a scripted call on hold around a bank lookup', async () => {
      const harness = buildHarness(
        buildCall({ metrics: { mode: 'SCRIPTED' } }),
      );

      await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'get_fee_history',
        {},
      );

      expect(harness.call_hold_service.startHold).toHaveBeenCalledWith(
        CALL_ID,
        { reason: 'CHECKING_SYSTEM', tool_name: 'get_fee_history' },
      );
      expect(harness.call_hold_service.endHold).toHaveBeenCalledWith(CALL_ID);
    });

    it('waits for the app approval while the optional app check is out', async () => {
      const harness = buildHarness(
        buildCall({ ...UNCONFIRMED_CALL, metrics: { mode: 'SCRIPTED' } }),
      );

      await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'send_app_identity_check',
        {},
      );

      expect(harness.call_hold_service.startHold).toHaveBeenCalledWith(
        CALL_ID,
        {
          reason: 'WAITING_FOR_APP_APPROVAL',
          tool_name: 'send_app_identity_check',
        },
      );
    });

    it.each(['start_identity_check', 'submit_identity_answers'])(
      'never holds for %s: identity questions are part of the conversation',
      async (tool_name) => {
        const harness = buildHarness(
          buildCall({ ...UNCONFIRMED_CALL, metrics: { mode: 'SCRIPTED' } }),
        );

        const tool_outcome = await harness.call_tools_service.dispatchTool(
          CALL_ID,
          tool_name,
          tool_name === 'start_identity_check'
            ? { level: 1 }
            : {
                challenge_id: 'IDC-000001',
                answers: [{ question_id: 'Q1', answer: 'Sarah Mitchell' }],
              },
        );

        expect(tool_outcome.ok).toBe(true);
        expect(harness.call_hold_service.startHold).not.toHaveBeenCalled();
      },
    );

    it('never holds for silent tools, and leaves LIVE calls to the voice agent', async () => {
      const scripted_harness = buildHarness(
        buildCall({ metrics: { mode: 'SCRIPTED' } }),
      );
      await scripted_harness.call_tools_service.dispatchTool(
        CALL_ID,
        'update_call_insight',
        { intent: 'Lost card' },
      );
      const live_harness = buildHarness(
        buildCall({ metrics: { mode: 'LIVE' } }),
      );
      await live_harness.call_tools_service.dispatchTool(
        CALL_ID,
        'get_fee_history',
        {},
      );

      expect(
        scripted_harness.call_hold_service.startHold,
      ).not.toHaveBeenCalled();
      expect(live_harness.call_hold_service.startHold).not.toHaveBeenCalled();
    });

    it('ends the hold even when the tool fails', async () => {
      const harness = buildHarness(
        buildCall({ metrics: { mode: 'SCRIPTED' } }),
      );
      harness.engine_api_client.getFeeHistory.mockRejectedValue(
        new EngineApiUnavailableError('fee history', 'down'),
      );

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'get_fee_history',
        {},
      );

      expect(tool_outcome.ok).toBe(false);
      expect(harness.call_hold_service.endHold).toHaveBeenCalledTimes(1);
    });
  });
});
