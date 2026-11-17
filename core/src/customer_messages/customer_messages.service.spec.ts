import { CallEndedError } from '../calls/errors/call_ended.error';
import { CallNotFoundError } from '../calls/errors/call_not_found.error';
import { CallsService } from '../calls/calls.service';
import { CallRow } from '../calls/types/call_row.type';
import { VoiceAgentSessionManager } from '../voice_agent/voice_agent_session.manager';
import { CustomerMessagesService } from './customer_messages.service';
import { CallNotLiveError } from './errors/call_not_live.error';
import { VoiceAgentNotRunningError } from './errors/voice_agent_not_running.error';

const CALL_ID = '0b0f7c0e-5d3a-4f6e-9a55-3a3f3a3f3a3f';

function buildCall(call_overrides: Partial<CallRow> = {}): CallRow {
  return {
    call_id: CALL_ID,
    caller_number: '+61491576801',
    customer_id: 'CUS-1007',
    customer_name: 'Riley Hughes',
    channel: 'BROWSER',
    status: 'AI_ACTIVE',
    handled_by_agent_id: 'AI-01',
    assigned_staff_id: null,
    identity_verified: false,
    verified_at: null,
    intent: null,
    sentiment: 'NEUTRAL',
    risk_level: 'LOW',
    attention_reason: null,
    started_at: new Date(),
    ended_at: null,
    ai_summary: null,
    metrics: { mode: 'LIVE' },
    ...call_overrides,
  };
}

function buildHarness(harness_options: {
  getActiveCall: () => Promise<CallRow>;
  is_agent_listening?: boolean;
}) {
  const calls_service = {
    getActiveCall: jest.fn(harness_options.getActiveCall),
  };
  const voice_agent_session_manager = {
    acceptTypedCustomerMessage: jest
      .fn()
      .mockReturnValue(harness_options.is_agent_listening ?? true),
  };
  const customer_messages_service = new CustomerMessagesService(
    calls_service as unknown as CallsService,
    voice_agent_session_manager as unknown as VoiceAgentSessionManager,
  );
  return { customer_messages_service, voice_agent_session_manager };
}

describe('CustomerMessagesService', () => {
  it('hands the trimmed line to the call voice agent', async () => {
    const harness = buildHarness({ getActiveCall: async () => buildCall() });

    const receipt = await harness.customer_messages_service.sendCustomerMessage(
      CALL_ID,
      {
        text: '  I was charged twice yesterday.  ',
      },
    );

    expect(receipt).toEqual({ is_accepted: true });
    expect(
      harness.voice_agent_session_manager.acceptTypedCustomerMessage,
    ).toHaveBeenCalledWith(CALL_ID, 'I was charged twice yesterday.');
  });

  it('works while a person has the call (the agent records it only)', async () => {
    const harness = buildHarness({
      getActiveCall: async () => buildCall({ status: 'HUMAN_ACTIVE' }),
    });

    await expect(
      harness.customer_messages_service.sendCustomerMessage(CALL_ID, {
        text: 'Thanks.',
      }),
    ).resolves.toEqual({ is_accepted: true });
  });

  it('passes on 404 for an unknown call and 409 for an ended one', async () => {
    const unknown_call = buildHarness({
      getActiveCall: () => Promise.reject(new CallNotFoundError(CALL_ID)),
    });
    const ended_call = buildHarness({
      getActiveCall: () => Promise.reject(new CallEndedError(CALL_ID)),
    });

    await expect(
      unknown_call.customer_messages_service.sendCustomerMessage(CALL_ID, {
        text: 'Hello',
      }),
    ).rejects.toBeInstanceOf(CallNotFoundError);
    await expect(
      ended_call.customer_messages_service.sendCustomerMessage(CALL_ID, {
        text: 'Hello',
      }),
    ).rejects.toBeInstanceOf(CallEndedError);
  });

  it('refuses a scripted call with 409 CALL_NOT_LIVE', async () => {
    const harness = buildHarness({
      getActiveCall: async () => buildCall({ metrics: { mode: 'SCRIPTED' } }),
    });

    const sending = harness.customer_messages_service.sendCustomerMessage(
      CALL_ID,
      { text: 'Hello' },
    );

    await expect(sending).rejects.toBeInstanceOf(CallNotLiveError);
    await expect(sending).rejects.toMatchObject({
      error_code: 'CALL_NOT_LIVE',
    });
    expect(
      harness.voice_agent_session_manager.acceptTypedCustomerMessage,
    ).not.toHaveBeenCalled();
  });

  it('refuses with 409 VOICE_AGENT_NOT_RUNNING when no agent is listening', async () => {
    const harness = buildHarness({
      getActiveCall: async () => buildCall(),
      is_agent_listening: false,
    });

    await expect(
      harness.customer_messages_service.sendCustomerMessage(CALL_ID, {
        text: 'Hello',
      }),
    ).rejects.toBeInstanceOf(VoiceAgentNotRunningError);
  });
});
