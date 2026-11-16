// Timing of one customer turn, from the end of their speech to the first
// audio of the answer. Each AI turn carries `latency_ms` only once.
export interface TurnTiming {
  // When the turn detector decided the customer finished (null: no customer
  // turn, e.g. the opening or a supervisor instruction).
  end_of_speech_at_ms: number | null;
  is_latency_recorded: boolean;
  stt_ms: number | null;
  llm_first_token_ms: number | null;
  tts_first_chunk_ms: number | null;
}

export function createTurnTiming(
  end_of_speech_at_ms: number | null = null,
  stt_ms: number | null = null,
): TurnTiming {
  return {
    end_of_speech_at_ms,
    is_latency_recorded: end_of_speech_at_ms === null,
    stt_ms,
    llm_first_token_ms: null,
    tts_first_chunk_ms: null,
  };
}
