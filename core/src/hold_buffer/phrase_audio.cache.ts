import { Injectable, Logger } from '@nestjs/common';

import { AiService } from '../ai/ai.service';
import { AGENT_OUTPUT_SAMPLE_RATE } from '../audio/constants/call_audio_format.constant';

export interface PrerenderOutcome {
  rendered_count: number;
  failed_count: number;
}

// Fixed phrases rendered once per voice and kept in memory (24 kHz PCM), so
// the greeting and hold lines play without waiting for text-to-speech.
// A failed render is forgotten and retried the next time it is needed.
@Injectable()
export class PhraseAudioCache {
  private readonly logger = new Logger(PhraseAudioCache.name);
  private readonly rendered_phrases = new Map<string, Promise<Int16Array>>();

  constructor(private readonly ai_service: AiService) {}

  getPhraseAudio(phrase_text: string, voice: string): Promise<Int16Array> {
    const cache_key = `${voice}\u0000${phrase_text}`;
    const cached_audio = this.rendered_phrases.get(cache_key);
    if (cached_audio) {
      return cached_audio;
    }
    const rendered_audio = this.ai_service
      .synthesize({
        text: phrase_text,
        voice,
        sample_rate: AGENT_OUTPUT_SAMPLE_RATE,
      })
      .then((speech_result) => speech_result.pcm);
    this.rendered_phrases.set(cache_key, rendered_audio);
    rendered_audio.catch(() => this.rendered_phrases.delete(cache_key));
    return rendered_audio;
  }

  async prerenderPhrases(
    phrase_texts: string[],
    voices: string[],
  ): Promise<PrerenderOutcome> {
    const render_attempts = voices.flatMap((voice) =>
      phrase_texts.map((phrase_text) =>
        this.getPhraseAudio(phrase_text, voice).then(
          () => true,
          (error: Error) => {
            this.logger.warn(
              `Could not pre-render "${phrase_text}" in ${voice}: ${error.message}`,
            );
            return false;
          },
        ),
      ),
    );
    const render_results = await Promise.all(render_attempts);
    const rendered_count = render_results.filter(Boolean).length;
    return {
      rendered_count,
      failed_count: render_results.length - rendered_count,
    };
  }

  clear(): void {
    this.rendered_phrases.clear();
  }
}
