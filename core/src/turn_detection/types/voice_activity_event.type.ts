export interface SpeechStartedEvent {
  type: 'speech_started';
  // Position in the caller's audio stream.
  stream_ms: number;
}

export interface UtteranceEndedEvent {
  type: 'utterance_ended';
  // 16-bit mono PCM: pre-roll + speech + a short tail of silence.
  pcm: Int16Array;
  // From the detected start of speech to the last voiced frame.
  speech_ms: number;
  stream_ms: number;
  // True when the utterance hit the maximum length and was cut there.
  is_truncated: boolean;
}

// Too short to be a turn (a cough, a click).
export interface UtteranceDiscardedEvent {
  type: 'utterance_discarded';
  speech_ms: number;
  stream_ms: number;
}

export type VoiceActivityEvent =
  SpeechStartedEvent | UtteranceEndedEvent | UtteranceDiscardedEvent;

export interface VoiceActivitySettings {
  sample_rate: number;
  speech_start_ms: number;
  end_of_turn_silence_ms: number;
  energy_threshold_ratio: number;
  min_utterance_ms: number;
  max_utterance_ms: number;
  pre_roll_ms: number;
}
