import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { AiService } from '../ai/ai.service';
import { AGENT_OUTPUT_SAMPLE_RATE } from '../audio/constants/call_audio_format.constant';
import { contentConfig } from '../config/content.config';

export interface PrerenderOutcome {
  rendered_count: number;
  failed_count: number;
}

// Fixed phrases (greeting, hold lines, goodbyes, handover lines) as 24 kHz
// PCM, kept in memory and on disk. The disk copy is keyed by provider, model,
// voice, speed, tone instructions and text, so a restart never pays to render
// the same line again, and changing any of them renders a fresh copy.
// A failed render is forgotten and retried the next time it is needed.
@Injectable()
export class PhraseAudioCache {
  private readonly logger = new Logger(PhraseAudioCache.name);
  private readonly rendered_phrases = new Map<string, Promise<Int16Array>>();

  constructor(
    private readonly ai_service: AiService,
    @Inject(contentConfig.KEY)
    private readonly content_config: ConfigType<typeof contentConfig>,
  ) {}

  getPhraseAudio(phrase_text: string, voice: string): Promise<Int16Array> {
    const cache_key = this.buildCacheKey(phrase_text, voice);
    const cached_audio = this.rendered_phrases.get(cache_key);
    if (cached_audio) {
      return cached_audio;
    }
    const phrase_audio = this.loadOrRender(cache_key, phrase_text, voice);
    this.rendered_phrases.set(cache_key, phrase_audio);
    phrase_audio.catch(() => this.rendered_phrases.delete(cache_key));
    return phrase_audio;
  }

  // One phrase at a time per voice: a realtime voice then needs one
  // connection at a time per voice, not one per phrase at once.
  async prerenderPhrases(
    phrase_texts: string[],
    voices: string[],
  ): Promise<PrerenderOutcome> {
    const voice_outcomes = await Promise.all(
      voices.map((voice) => this.prerenderVoice(phrase_texts, voice)),
    );
    return voice_outcomes.reduce(
      (total_outcome, voice_outcome) => ({
        rendered_count:
          total_outcome.rendered_count + voice_outcome.rendered_count,
        failed_count: total_outcome.failed_count + voice_outcome.failed_count,
      }),
      { rendered_count: 0, failed_count: 0 },
    );
  }

  clear(): void {
    this.rendered_phrases.clear();
  }

  private async prerenderVoice(
    phrase_texts: string[],
    voice: string,
  ): Promise<PrerenderOutcome> {
    const prerender_outcome = { rendered_count: 0, failed_count: 0 };
    for (const phrase_text of phrase_texts) {
      try {
        await this.getPhraseAudio(phrase_text, voice);
        prerender_outcome.rendered_count += 1;
      } catch (error) {
        prerender_outcome.failed_count += 1;
        this.logger.warn(
          `Could not pre-render "${phrase_text}" in ${voice}: ${(error as Error).message}`,
        );
      }
    }
    return prerender_outcome;
  }

  private buildCacheKey(phrase_text: string, voice: string): string {
    const speech_route = this.ai_service.describeSpeechRoute();
    return createHash('sha256')
      .update(
        JSON.stringify([
          speech_route.provider,
          speech_route.server,
          speech_route.model,
          voice,
          speech_route.speed,
          speech_route.instructions,
          AGENT_OUTPUT_SAMPLE_RATE,
          phrase_text,
        ]),
      )
      .digest('hex');
  }

  private async loadOrRender(
    cache_key: string,
    phrase_text: string,
    voice: string,
  ): Promise<Int16Array> {
    const cache_path = join(
      this.content_config.phrase_audio_cache_dir,
      `${cache_key}.pcm`,
    );
    const stored_audio = await this.readStoredAudio(cache_path);
    if (stored_audio) {
      return stored_audio;
    }
    const speech_result = await this.ai_service.synthesize({
      text: phrase_text,
      voice,
      sample_rate: AGENT_OUTPUT_SAMPLE_RATE,
    });
    await this.storeAudio(cache_path, speech_result.pcm);
    return speech_result.pcm;
  }

  private async readStoredAudio(
    cache_path: string,
  ): Promise<Int16Array | null> {
    try {
      const stored_bytes = await readFile(cache_path);
      if (stored_bytes.length < 2) {
        return null;
      }
      const stored_audio = new Int16Array(Math.floor(stored_bytes.length / 2));
      for (
        let sample_index = 0;
        sample_index < stored_audio.length;
        sample_index++
      ) {
        stored_audio[sample_index] = stored_bytes.readInt16LE(sample_index * 2);
      }
      return stored_audio;
    } catch {
      return null;
    }
  }

  // Written to a temporary name first, so a crash never leaves half a file.
  private async storeAudio(cache_path: string, pcm: Int16Array): Promise<void> {
    try {
      await mkdir(this.content_config.phrase_audio_cache_dir, {
        recursive: true,
      });
      const temporary_path = `${cache_path}.${process.pid}.tmp`;
      await writeFile(
        temporary_path,
        Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength),
      );
      await rename(temporary_path, cache_path);
    } catch (error) {
      this.logger.warn(
        `Could not store phrase audio on disk: ${(error as Error).message}`,
      );
    }
  }
}
