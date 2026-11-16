import { AiProviderName } from './ai_provider_name.type';
import { ChatToolCall } from './chat_request.type';
import { ChatUsage } from './chat_stream_event.type';

export interface ChatTrialResult {
  text: string;
  tool_calls: ChatToolCall[];
  usage: ChatUsage;
  finish_reason: string;
  latency_ms: number;
  // Time to the first text or tool call (null when nothing came back).
  first_token_ms: number | null;
}

export interface TranscriptionTrialResult {
  text: string;
  duration_seconds: number;
  latency_ms: number;
  provider: AiProviderName;
  model: string;
}

export interface SpeechTrialResult {
  wav: Buffer;
  latency_ms: number;
  provider: AiProviderName;
  model: string;
  voice: string;
}
