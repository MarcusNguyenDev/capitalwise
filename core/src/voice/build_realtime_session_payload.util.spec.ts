import { listRealtimeToolDefinitions } from '../call_tools/constants/tool_definitions.constant';
import {
  buildRealtimeSessionPayload,
  CLIENT_SECRET_LIFETIME_SECONDS,
} from './build_realtime_session_payload.util';

describe('buildRealtimeSessionPayload', () => {
  const tools = listRealtimeToolDefinitions();
  const payload = buildRealtimeSessionPayload({
    model: 'gpt-realtime',
    voice: 'marin',
    transcription_model: 'gpt-4o-mini-transcribe',
    instructions: 'You are the AI phone specialist for Demo Bank.',
    tools,
  });

  it('wraps a GA realtime session in the client_secrets request shape', () => {
    expect(payload.expires_after).toEqual({
      anchor: 'created_at',
      seconds: CLIENT_SECRET_LIFETIME_SECONDS,
    });
    expect(payload.session.type).toBe('realtime');
    expect(payload.session.model).toBe('gpt-realtime');
    expect(payload.session.instructions).toContain('Demo Bank');
    expect(payload.session.output_modalities).toEqual(['audio']);
    expect(payload.session.tool_choice).toBe('auto');
  });

  it('puts voice, transcription and server VAD under session.audio', () => {
    expect(payload.session.audio.output).toEqual({ voice: 'marin' });
    expect(payload.session.audio.input.transcription).toEqual({
      model: 'gpt-4o-mini-transcribe',
      language: 'en',
    });
    expect(payload.session.audio.input.turn_detection).toMatchObject({
      type: 'server_vad',
      create_response: true,
      interrupt_response: true,
    });
  });

  it('sends every registered tool in the Realtime function format', () => {
    expect(payload.session.tools).toHaveLength(13);
    for (const tool of payload.session.tools) {
      expect(tool.type).toBe('function');
      expect(tool.parameters.type).toBe('object');
      expect(Object.keys(tool).sort()).toEqual([
        'description',
        'name',
        'parameters',
        'type',
      ]);
    }
    expect(payload.session.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'send_identity_push',
        'propose_action',
        'request_human',
        'flag_concern',
      ]),
    );
  });

  it('never exposes a customer id parameter to the model', () => {
    expect(JSON.stringify(payload.session.tools)).not.toContain('customer_id');
  });
});
