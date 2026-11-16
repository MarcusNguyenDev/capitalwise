import type { TokenUsage } from "@/shared/types/call.type";

import type { RealtimeUsage } from "./realtime_event.type";

/**
 * Maps the usage block of a `response.done` event to what `core` accumulates
 * per call. The model's text and audio input counts include cached tokens,
 * which are billed at their own cheaper rate, so they are subtracted here.
 */
export function mapTokenUsage(realtime_usage: RealtimeUsage): TokenUsage {
  const input_details = realtime_usage.input_token_details ?? {};
  const cached_details = input_details.cached_tokens_details ?? {};
  return {
    input_text_tokens: Math.max(0, (input_details.text_tokens ?? 0) - (cached_details.text_tokens ?? 0)),
    input_audio_tokens: Math.max(0, (input_details.audio_tokens ?? 0) - (cached_details.audio_tokens ?? 0)),
    cached_input_tokens: input_details.cached_tokens ?? 0,
    output_text_tokens: realtime_usage.output_token_details?.text_tokens ?? 0,
    output_audio_tokens: realtime_usage.output_token_details?.audio_tokens ?? 0,
  };
}
