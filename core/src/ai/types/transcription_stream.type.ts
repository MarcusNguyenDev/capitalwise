import { TranscriptionResult } from './transcription.type';

export interface TranscriptionStreamRequest {
  model?: string;
  language?: string;
  prompt?: string;
}

export interface ResolvedTranscriptionStreamRequest extends TranscriptionStreamRequest {
  model: string;
  timeout_ms: number;
  base_url?: string;
}

// One caller's speech-to-text for a whole call: audio is appended while
// they talk, `commit()` closes the turn and resolves with its transcript.
// Turns are committed in order; audio appended after a commit belongs to the
// next turn.
export interface TranscriptionStream {
  appendAudio(pcm: Int16Array, sample_rate: number): void;
  commit(): Promise<TranscriptionResult>;
  // Drops the audio of the current turn (a false start).
  clear(): void;
  // Partial transcripts of the turn being spoken; returns the unsubscribe.
  onDelta(listener: (delta: string) => void): () => void;
  close(): Promise<void>;
}
