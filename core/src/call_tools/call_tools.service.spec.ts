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
      'rejects %s on an unverified call without touching the api',
      async (tool_name) => {
        const harness = buildHarness(
          buildCall({ identity_verified: false, verified_at: null }),
        );

        const tool_outcome = await harness.call_tools_service.dispatchTool(
          CALL_ID,
          tool_name,
          {
            account_id: 'ACC-10011',
            card_id: 'CRD-10011',
          },
        );

        expect(tool_outcome).toEqual({
          ok: false,
          error: {
            code: 'IDENTITY_NOT_VERIFIED',
            message:
              'The caller is not verified yet. Call send_identity_push first.',
          },
        });
        for (const api_method of Object.values(harness.engine_api_client)) {
          expect(api_method).not.toHaveBeenCalled();
        }
      },
    );

    it('lets the identity-free tools run on an unverified call', async () => {
      const harness = buildHarness(buildCall({ identity_verified: false }));
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

      // Only match status and first name: no customer id, no surname.
      expect(caller_context).toEqual({
        ok: true,
        result: { matched: true, first_name: 'Sarah' },
      });
      expect(call_insight).toEqual({ ok: true, result: { updated: true } });
      expect(harness.applied_call_changes).toEqual([
        { intent: 'Lost card', sentiment: 'NEGATIVE' },
      ]);
    });

    it('rejects account tools when the caller ID matched no customer', async () => {
      const harness = buildHarness(
        buildCall({
          customer_id: null,
          customer_name: null,
          identity_verified: false,
        }),
      );

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'send_identity_push',
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
        'CUS-1001',
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

        expect(harness.engine_api_client[api_method].mock.calls[0][0]).toBe(
          'CUS-1001',
        );
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

  describe('identity push', () => {
    it('returns verified immediately for an already verified call', async () => {
      const harness = buildHarness(buildCall({ identity_verified: true }));

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'send_identity_push',
      );

      expect(tool_outcome).toEqual({ ok: true, result: { verified: true } });
      expect(
        harness.engine_api_client.createIdentityCheck,
      ).not.toHaveBeenCalled();
    });

    it('marks the call verified with the time to identity when the customer approves', async () => {
      const harness = buildHarness(
        buildCall({ identity_verified: false, verified_at: null }),
      );
      const identity_push_listener = jest.fn();
      harness.live_event_bus.subscribe(
        'internal.identity_push_sent',
        identity_push_listener,
      );

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'send_identity_push',
      );
      await new Promise((resolve) => setImmediate(resolve));

      expect(tool_outcome).toEqual({ ok: true, result: { verified: true } });
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
      expect(call_changes).toMatchObject({ identity_verified: true });
      expect(call_changes?.metrics?.time_to_identity_ms).toBeGreaterThanOrEqual(
        20_000,
      );
    });

    it('raises the risk level when the customer denies', async () => {
      const harness = buildHarness(buildCall({ identity_verified: false }));
      harness.identity_push_waiter.waitForAnswer.mockResolvedValue('DENIED');

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'send_identity_push',
      );

      expect(tool_outcome).toEqual({
        ok: true,
        result: { verified: false, reason: 'DENIED' },
      });
      expect(harness.applied_call_changes).toEqual([{ risk_level: 'MEDIUM' }]);
    });

    it('expires the notification on timeout', async () => {
      const harness = buildHarness(buildCall({ identity_verified: false }));
      harness.identity_push_waiter.waitForAnswer.mockResolvedValue('TIMEOUT');

      const tool_outcome = await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'send_identity_push',
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
      const harness = buildHarness(buildCall({ identity_verified: false }));
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

    it('waits for the app approval while the identity push is out', async () => {
      const harness = buildHarness(
        buildCall({ identity_verified: false, metrics: { mode: 'SCRIPTED' } }),
      );

      await harness.call_tools_service.dispatchTool(
        CALL_ID,
        'send_identity_push',
        {},
      );

      expect(harness.call_hold_service.startHold).toHaveBeenCalledWith(
        CALL_ID,
        { reason: 'WAITING_FOR_APP_APPROVAL', tool_name: 'send_identity_push' },
      );
    });

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
