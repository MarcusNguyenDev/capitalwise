import { AiService } from '../ai/ai.service';
import { AiStatus, CapabilityStatus } from '../ai/types/ai_status.type';
import { CallsService } from '../calls/calls.service';
import { CallRow } from '../calls/types/call_row.type';
import { StaffNotFoundError } from '../interventions/errors/staff_not_found.error';
import { StaffUsersRepository } from '../interventions/staff_users.repository';
import { MediaUnavailableError } from '../livekit/errors/media_unavailable.error';
import { LivekitRoomsService } from '../livekit/livekit_rooms.service';
import { LivekitTokensService } from '../livekit/livekit_tokens.service';
import { VoiceAgentSessionManager } from '../voice_agent/voice_agent_session.manager';
import { LiveVoiceUnavailableError } from './errors/live_voice_unavailable.error';
import { StaffCannotPublishError } from './errors/staff_cannot_publish.error';
import { VoiceService } from './voice.service';

const CALL_ID = '0b0f7c0e-5d3a-4f6e-9a55-3a3f3a3f3a3f';
const CHAT_NOT_CONFIGURED =
  'Chat provider ollama is not configured. Set OLLAMA_BASE_URL in core/.env.';

function buildCapability(
  capability_overrides: Partial<CapabilityStatus> = {},
): CapabilityStatus {
  return {
    provider: 'speaches',
    model: 'some-model',
    is_reachable: true,
    detail: 'ok',
    ...capability_overrides,
  };
}

function buildAiStatus(is_chat_reachable: boolean): AiStatus {
  return {
    capabilities: {
      chat: buildCapability({
        provider: 'ollama',
        model: 'gpt-6:luna',
        is_reachable: is_chat_reachable,
        detail: is_chat_reachable ? 'ok' : CHAT_NOT_CONFIGURED,
      }),
      transcribe: buildCapability(),
      synthesize: buildCapability({ voice: 'bf_emma' }),
    },
    providers: {} as AiStatus['providers'],
    checked_at: new Date().toISOString(),
  };
}

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
    identity_verified: false,
    identity_level: 0,
    identity_method: null,
    is_identity_locked: false,
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
  call: CallRow;
  is_chat_reachable?: boolean;
  is_media_available?: boolean;
}) {
  const ai_service = {
    getStatus: jest
      .fn()
      .mockResolvedValue(
        buildAiStatus(harness_options.is_chat_reachable ?? true),
      ),
  };
  const calls_service = {
    getActiveCall: jest.fn().mockResolvedValue(harness_options.call),
  };
  const staff_users_repository = {
    findById: jest.fn(async (staff_id: string) =>
      staff_id === 'STF-01'
        ? { staff_id, name: 'Alex Chen', role: 'TEAM_LEADER' }
        : undefined,
    ),
  };
  const livekit_tokens_service = {
    mintToken: jest.fn().mockResolvedValue('jwt-token'),
  };
  const is_media_available = harness_options.is_media_available ?? true;
  const livekit_rooms_service = {
    checkAvailability: jest.fn().mockResolvedValue({
      is_available: is_media_available,
      unavailable_reason: is_media_available
        ? null
        : 'LiveKit at http://localhost:7880 is not reachable.',
    }),
    readBrowserUrl: jest.fn().mockReturnValue(null),
  };
  const voice_agent_session_manager = {
    startSession: jest.fn().mockResolvedValue(undefined),
  };
  const voice_service = new VoiceService(
    ai_service as unknown as AiService,
    calls_service as unknown as CallsService,
    staff_users_repository as unknown as StaffUsersRepository,
    livekit_tokens_service as unknown as LivekitTokensService,
    livekit_rooms_service as unknown as LivekitRoomsService,
    voice_agent_session_manager as unknown as VoiceAgentSessionManager,
    {
      synthesize: { ai_voice: 'bf_emma', staff_voice: 'bm_george' },
    } as never,
  );
  return {
    voice_service,
    livekit_tokens_service,
    voice_agent_session_manager,
  };
}

describe('VoiceService', () => {
  describe('status', () => {
    it('is live when LiveKit and every AI capability are reachable', async () => {
      const { voice_service } = buildHarness({ call: buildCall() });

      const voice_status = await voice_service.getStatus();

      expect(voice_status).toMatchObject({
        is_live_available: true,
        unavailable_reason: null,
        livekit_url: null,
        is_media_available: true,
        language_model: { model: 'gpt-6:luna', is_reachable: true },
        text_to_speech: { ai_voice: 'bf_emma', staff_voice: 'bm_george' },
      });
    });

    it('says why live is unavailable while media still works', async () => {
      const { voice_service } = buildHarness({
        call: buildCall(),
        is_chat_reachable: false,
      });

      const voice_status = await voice_service.getStatus();

      expect(voice_status.is_live_available).toBe(false);
      expect(voice_status.unavailable_reason).toBe(CHAT_NOT_CONFIGURED);
      expect(voice_status.is_media_available).toBe(true);
    });
  });

  describe('customer sessions', () => {
    it('mints a customer token and starts the voice agent for a LIVE call', async () => {
      const harness = buildHarness({ call: buildCall() });

      const room_access =
        await harness.voice_service.createCustomerSession(CALL_ID);

      expect(room_access).toEqual({
        room_name: `call_${CALL_ID}`,
        livekit_url: null,
        token: 'jwt-token',
        identity: 'customer',
      });
      expect(harness.livekit_tokens_service.mintToken).toHaveBeenCalledWith({
        room_name: `call_${CALL_ID}`,
        identity: 'customer',
        display_name: 'Sarah Mitchell',
        can_publish: true,
      });
      expect(
        harness.voice_agent_session_manager.startSession,
      ).toHaveBeenCalledTimes(1);
    });

    it('refuses a LIVE session with the reason when live is unavailable', async () => {
      const harness = buildHarness({
        call: buildCall(),
        is_chat_reachable: false,
      });

      await expect(
        harness.voice_service.createCustomerSession(CALL_ID),
      ).rejects.toBeInstanceOf(LiveVoiceUnavailableError);
      expect(
        harness.voice_agent_session_manager.startSession,
      ).not.toHaveBeenCalled();
    });

    it('only mints a token for a SCRIPTED call, and needs LiveKit for it', async () => {
      const scripted_call = buildCall({ metrics: { mode: 'SCRIPTED' } });
      const harness = buildHarness({
        call: scripted_call,
        is_chat_reachable: false,
      });
      await harness.voice_service.createCustomerSession(CALL_ID);
      expect(
        harness.voice_agent_session_manager.startSession,
      ).not.toHaveBeenCalled();

      const no_media_harness = buildHarness({
        call: scripted_call,
        is_media_available: false,
      });
      await expect(
        no_media_harness.voice_service.createCustomerSession(CALL_ID),
      ).rejects.toBeInstanceOf(MediaUnavailableError);
    });
  });

  describe('staff tokens', () => {
    it('lets any staff member listen in without publishing', async () => {
      const harness = buildHarness({ call: buildCall() });

      const room_access = await harness.voice_service.createStaffToken({
        call_id: CALL_ID,
        staff_id: 'STF-01',
        can_publish: false,
      });

      expect(room_access.identity).toBe('staff_STF-01');
      expect(harness.livekit_tokens_service.mintToken).toHaveBeenCalledWith(
        expect.objectContaining({
          can_publish: false,
          display_name: 'Alex Chen',
        }),
      );
    });

    it('lets staff talk only on a call they took over', async () => {
      const ai_call_harness = buildHarness({ call: buildCall() });
      await expect(
        ai_call_harness.voice_service.createStaffToken({
          call_id: CALL_ID,
          staff_id: 'STF-01',
          can_publish: true,
        }),
      ).rejects.toBeInstanceOf(StaffCannotPublishError);

      const taken_over_harness = buildHarness({
        call: buildCall({
          status: 'HUMAN_ACTIVE',
          assigned_staff_id: 'STF-01',
        }),
      });
      const room_access =
        await taken_over_harness.voice_service.createStaffToken({
          call_id: CALL_ID,
          staff_id: 'STF-01',
          can_publish: true,
        });
      expect(room_access.token).toBe('jwt-token');
    });

    it('rejects an unknown staff member', async () => {
      const harness = buildHarness({ call: buildCall() });

      await expect(
        harness.voice_service.createStaffToken({
          call_id: CALL_ID,
          staff_id: 'STF-99',
          can_publish: false,
        }),
      ).rejects.toBeInstanceOf(StaffNotFoundError);
    });
  });
});
