import { encodeWav } from '../../audio/encode_wav.util';
import { resamplePcm } from '../../audio/resample_pcm.util';
import { TranscriptionResult } from '../types/transcription.type';
import { TranscriptionStream } from '../types/transcription_stream.type';

// Whisper's rate: what file-based speech-to-text is sent.
const BUFFERED_SAMPLE_RATE = 16_000;

// The streaming contract for providers that only transcribe whole files
// (Speaches, vLLM, OpenAI gpt-transcribe): audio is buffered until `commit()`,
// which sends the turn as one WAV.
export class BufferedTranscriptionStream implements TranscriptionStream {
  private turn_chunks: Int16Array[] = [];
  private is_closed = false;

  constructor(
    private readonly transcribeWav: (
      wav: Buffer,
    ) => Promise<TranscriptionResult>,
  ) {}

  appendAudio(pcm: Int16Array, sample_rate: number): void {
    if (!this.is_closed) {
      this.turn_chunks.push(
        resamplePcm(pcm, sample_rate, BUFFERED_SAMPLE_RATE),
      );
    }
  }

  commit(): Promise<TranscriptionResult> {
    const turn_chunks = this.turn_chunks;
    this.turn_chunks = [];
    const sample_count = turn_chunks.reduce(
      (sample_total, chunk) => sample_total + chunk.length,
      0,
    );
    const turn_pcm = new Int16Array(sample_count);
    let write_offset = 0;
    for (const chunk of turn_chunks) {
      turn_pcm.set(chunk, write_offset);
      write_offset += chunk.length;
    }
    return this.transcribeWav(encodeWav(turn_pcm, BUFFERED_SAMPLE_RATE));
  }

  clear(): void {
    this.turn_chunks = [];
  }

  onDelta(): () => void {
    return () => undefined;
  }

  async close(): Promise<void> {
    this.is_closed = true;
    this.turn_chunks = [];
  }
}
