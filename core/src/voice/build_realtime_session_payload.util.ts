import { RealtimeToolDefinition } from '../call_tools/types/tool_definition.type';
import { RealtimeClientSecretRequest } from './types/realtime_session.type';

export const CLIENT_SECRET_LIFETIME_SECONDS = 600;

interface RealtimeSessionSettings {
  model: string;
  voice: string;
  transcription_model: string;
  instructions: string;
  tools: RealtimeToolDefinition[];
}

// Server VAD with automatic responses and barge-in: the caller can interrupt
// the AI mid-sentence. Input transcription puts the caller's words in the
// transcript. The phone later flips `create_response` off for a takeover.
export function buildRealtimeSessionPayload(
  session_settings: RealtimeSessionSettings,
): RealtimeClientSecretRequest {
  return {
    expires_after: {
      anchor: 'created_at',
      seconds: CLIENT_SECRET_LIFETIME_SECONDS,
    },
    session: {
      type: 'realtime',
      model: session_settings.model,
      instructions: session_settings.instructions,
      output_modalities: ['audio'],
      tools: session_settings.tools,
      tool_choice: 'auto',
      audio: {
        input: {
          noise_reduction: { type: 'near_field' },
          transcription: {
            model: session_settings.transcription_model,
            language: 'en',
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
            create_response: true,
            interrupt_response: true,
          },
        },
        output: { voice: session_settings.voice },
      },
    },
  };
}
