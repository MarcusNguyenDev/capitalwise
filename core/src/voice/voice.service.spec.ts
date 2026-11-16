import { CallsService } from '../calls/calls.service';
import { PromptsService } from '../prompts/prompts.service';
import { LiveVoiceUnavailableError } from './errors/live_voice_unavailable.error';
import { VoiceSessionMintFailedError } from './errors/voice_session_mint_failed.error';
import { OpenAiRealtimeClient } from './openai_realtime.client';
import { VoiceService } from './voice.service';

const CALL_ID = '0b0f7c0e-5d3a-4f6e-9a55-3a3f3a3f3a3f';

function buildVoiceConfig(openai_api_key: string) {
  return {
    openai_api_key,
    openai_base_url: 'https://api.openai.com/v1',
    realtime_model: 'gpt-realtime',
    realtime_voice: 'marin',
    transcription_model: 'gpt-4o-mini-transcribe',
  };
}

function buildVoiceService(openai_api_key: string) {
  const voice_config = buildVoiceConfig(openai_api_key);
  const calls_service = {
    getActiveCall: jest.fn().mockResolvedValue({ call_id: CALL_ID }),
  };
  const prompts_service = {
    getVoiceAgentInstructions: jest.fn().mockResolvedValue({
      prompt_version: '1.1',
      instructions: 'You are the AI phone specialist for Demo Bank.',
    }),
  };
  const openai_realtime_client = new OpenAiRealtimeClient(voice_config);
  const voice_service = new VoiceService(
    voice_config,
    calls_service as unknown as CallsService,
    prompts_service as unknown as PromptsService,
    openai_realtime_client,
  );
  return { voice_service, calls_service };
}

describe('VoiceService', () => {
  const original_fetch = global.fetch;

  afterEach(() => {
    global.fetch = original_fetch;
  });

  it('reports live voice as unavailable without a key and refuses to mint', async () => {
    const { voice_service } = buildVoiceService('');
    global.fetch = jest.fn();

    expect(voice_service.getStatus()).toEqual({
      is_live_available: false,
      model: 'gpt-realtime',
      voice: 'marin',
    });
    await expect(voice_service.createSession(CALL_ID)).rejects.toBeInstanceOf(
      LiveVoiceUnavailableError,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('mints an ephemeral client secret with the key kept server-side', async () => {
    const { voice_service, calls_service } = buildVoiceService('sk-test-key');
    const fetch_mock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        value: 'ek_test_secret',
        expires_at: 1_800_000_000,
        session: {},
      }),
    });
    global.fetch = fetch_mock as unknown as typeof fetch;

    const voice_session = await voice_service.createSession(CALL_ID);

    expect(calls_service.getActiveCall).toHaveBeenCalledWith(CALL_ID);
    const [request_url, request_init] = fetch_mock.mock.calls[0];
    expect(request_url).toBe(
      'https://api.openai.com/v1/realtime/client_secrets',
    );
    expect(request_init.method).toBe('POST');
    expect(request_init.headers.Authorization).toBe('Bearer sk-test-key');
    const request_body = JSON.parse(request_init.body);
    expect(request_body.session.type).toBe('realtime');
    expect(request_body.session.model).toBe('gpt-realtime');
    expect(request_body.session.audio.output.voice).toBe('marin');
    expect(request_body.session.tools).toHaveLength(13);

    expect(voice_session.client_secret).toBe('ek_test_secret');
    expect(voice_session.expires_at).toBe(
      new Date(1_800_000_000_000).toISOString(),
    );
    expect(voice_session.model).toBe('gpt-realtime');
    expect(voice_session.voice).toBe('marin');
    expect(voice_session.instructions).toContain('Demo Bank');
    expect(voice_session.tools).toHaveLength(13);
    expect(JSON.stringify(voice_session)).not.toContain('sk-test-key');
  });

  it('maps an OpenAI error to a typed 502 error', async () => {
    const { voice_service } = buildVoiceService('sk-test-key');
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Incorrect API key provided' } }),
    }) as unknown as typeof fetch;

    await expect(voice_service.createSession(CALL_ID)).rejects.toMatchObject({
      error_code: 'VOICE_SESSION_MINT_FAILED',
      message: expect.stringContaining('Incorrect API key provided'),
    });
  });

  it('maps a network failure to the same typed error', async () => {
    const { voice_service } = buildVoiceService('sk-test-key');
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new Error('socket hang up'),
      ) as unknown as typeof fetch;

    await expect(voice_service.createSession(CALL_ID)).rejects.toBeInstanceOf(
      VoiceSessionMintFailedError,
    );
  });
});
