import { RealtimeToolDefinition } from '../../call_tools/types/tool_definition.type';

// Body of POST https://api.openai.com/v1/realtime/client_secrets (GA API).
export interface RealtimeClientSecretRequest {
  expires_after: { anchor: 'created_at'; seconds: number };
  session: {
    type: 'realtime';
    model: string;
    instructions: string;
    output_modalities: ['audio'];
    tools: RealtimeToolDefinition[];
    tool_choice: 'auto';
    audio: {
      input: {
        noise_reduction: { type: 'near_field' };
        transcription: { model: string; language: string };
        turn_detection: {
          type: 'server_vad';
          threshold: number;
          prefix_padding_ms: number;
          silence_duration_ms: number;
          create_response: boolean;
          interrupt_response: boolean;
        };
      };
      output: { voice: string };
    };
  };
}

// The part of OpenAI's answer core uses.
export interface RealtimeClientSecret {
  value: string;
  // Unix time in seconds.
  expires_at: number;
}

export interface VoiceSession {
  client_secret: string;
  expires_at: string;
  model: string;
  voice: string;
  instructions: string;
  tools: RealtimeToolDefinition[];
}

export interface VoiceStatus {
  is_live_available: boolean;
  model: string;
  voice: string;
}
