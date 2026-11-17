import { SpeechResult } from '../types/speech_synthesis.type';
import { SpeechStream, SpeechSummary } from '../types/speech_stream.type';

// The streaming contract for providers that return a whole clip: one chunk.
export function createSingleChunkSpeechStream(
  speech_promise: Promise<SpeechResult>,
  requested_text: string,
): SpeechStream {
  const summary = speech_promise.then((speech_result): SpeechSummary => ({
    provider: speech_result.provider,
    model: speech_result.model,
    voice: speech_result.voice,
    requested_text,
    spoken_transcript: null,
    is_drifted: false,
    usage: null,
  }));
  // The summary rejects with the stream; nobody has to await it.
  summary.catch(() => undefined);
  return {
    summary,
    async *[Symbol.asyncIterator](): AsyncGenerator<Int16Array> {
      yield (await speech_promise).pcm;
    },
  };
}
