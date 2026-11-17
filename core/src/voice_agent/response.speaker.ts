import { SpeechStream } from '../ai/types/speech_stream.type';
import { AgentAudioOutput } from './agent_audio.output';
import { makeSpeakableText } from './make_speakable_text.util';
import { SentenceChunker } from './sentence.chunker';

export interface ResponseSpeakerDependencies {
  audio_output: AgentAudioOutput;
  // Text to 24 kHz PCM chunks in the AI voice, as they are produced.
  synthesizeSpeech: (spoken_text: string) => SpeechStream;
}

// Speaks one model response while it streams: text goes through the
// sentence chunker, each chunk is synthesised in order (chunk N+1 is
// rendered while chunk N plays), and its audio is queued on the agent's
// track piece by piece as the voice produces it.
export class ResponseSpeaker {
  private readonly sentence_chunker = new SentenceChunker();
  private readonly started_chunks: string[] = [];
  private readonly all_chunks: string[] = [];
  private synthesis_chain: Promise<void> = Promise.resolve();
  private synthesis_error: unknown = null;
  private first_audio_promise: Promise<number | null> | null = null;
  private synthesized_character_count = 0;
  private is_cancelled = false;

  constructor(private readonly dependencies: ResponseSpeakerDependencies) {}

  pushText(text_delta: string): void {
    for (const chunk of this.sentence_chunker.push(text_delta)) {
      this.speakChunk(chunk);
    }
  }

  // Speaks whatever is left and waits until every chunk is queued for
  // playout. Rejects with the text-to-speech error, if there was one.
  async finish(): Promise<void> {
    const remaining_text = this.sentence_chunker.flush();
    if (remaining_text) {
      this.speakChunk(remaining_text);
    }
    await this.synthesis_chain;
    if (this.synthesis_error) {
      throw this.synthesis_error;
    }
  }

  // Stops synthesising and queuing (barge-in); queued audio is cleared by the caller.
  cancel(): void {
    this.is_cancelled = true;
  }

  // When the first chunk started playing (null when nothing played).
  waitForFirstAudio(): Promise<number | null> {
    return this.first_audio_promise ?? Promise.resolve(null);
  }

  readFullText(): string {
    return this.all_chunks.join(' ').trim();
  }

  // Only what the caller actually started hearing.
  readSpokenText(): string {
    return this.started_chunks.join(' ').trim();
  }

  get character_count(): number {
    return this.synthesized_character_count;
  }

  private speakChunk(raw_chunk: string): void {
    const spoken_text = makeSpeakableText(raw_chunk);
    if (spoken_text.length === 0) {
      return;
    }
    this.all_chunks.push(spoken_text);
    this.synthesis_chain = this.synthesis_chain.then(() =>
      this.synthesizeAndQueue(spoken_text),
    );
  }

  private async synthesizeAndQueue(spoken_text: string): Promise<void> {
    if (this.is_cancelled || this.synthesis_error) {
      return;
    }
    try {
      const speech_stream = this.dependencies.synthesizeSpeech(spoken_text);
      let is_first_piece = true;
      for await (const speech_pcm of speech_stream) {
        if (this.is_cancelled) {
          return;
        }
        const started_promise = this.dependencies.audio_output.enqueue({
          pcm: speech_pcm,
          is_interruptible: true,
        });
        if (is_first_piece) {
          is_first_piece = false;
          void started_promise.then((started_at_ms) => {
            if (started_at_ms !== null) {
              this.started_chunks.push(spoken_text);
            }
          });
          this.first_audio_promise ??= started_promise;
        }
      }
      this.synthesized_character_count += spoken_text.length;
    } catch (error) {
      // A cancelled request ends with an abort error: that is not a failure.
      if (!this.is_cancelled) {
        this.synthesis_error = error;
      }
    }
  }
}
