import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AiService } from '../ai/ai.service';
import { PhraseAudioCache } from './phrase_audio.cache';

function buildCache(
  phrase_audio_cache_dir: string,
  speech_route: Record<string, unknown> = {},
) {
  const ai_service = {
    describeSpeechRoute: jest.fn().mockReturnValue({
      provider: 'openai',
      server: 'https://api.openai.com/v1',
      model: 'gpt-realtime-2.1-mini',
      speed: 1,
      instructions: '',
      ...speech_route,
    }),
    synthesize: jest.fn(async (speech_request: { text: string }) => ({
      pcm: Int16Array.from([speech_request.text.length, -7, 32_000]),
      sample_rate: 24_000,
      provider: 'openai',
      model: 'gpt-realtime-2.1-mini',
      voice: 'marin',
    })),
  };
  const phrase_audio_cache = new PhraseAudioCache(
    ai_service as unknown as AiService,
    { phrase_audio_cache_dir } as never,
  );
  return { phrase_audio_cache, ai_service };
}

describe('PhraseAudioCache', () => {
  let cache_dir: string;

  beforeEach(async () => {
    cache_dir = await mkdtemp(join(tmpdir(), 'phrase_audio_'));
  });

  afterEach(async () => {
    await rm(cache_dir, { recursive: true, force: true });
  });

  it('renders a phrase once, then serves it from disk after a restart', async () => {
    const first_run = buildCache(cache_dir);
    const rendered_audio = await first_run.phrase_audio_cache.getPhraseAudio(
      'Thanks for holding.',
      'marin',
    );

    const second_run = buildCache(cache_dir);
    const stored_audio = await second_run.phrase_audio_cache.getPhraseAudio(
      'Thanks for holding.',
      'marin',
    );

    expect(first_run.ai_service.synthesize).toHaveBeenCalledTimes(1);
    expect(second_run.ai_service.synthesize).not.toHaveBeenCalled();
    expect([...stored_audio]).toEqual([...rendered_audio]);
    expect(await readdir(cache_dir)).toHaveLength(1);
  });

  it('renders again when the voice, server, model, instructions or text change', async () => {
    const { phrase_audio_cache, ai_service } = buildCache(cache_dir);
    await phrase_audio_cache.getPhraseAudio('Thanks for holding.', 'marin');
    await phrase_audio_cache.getPhraseAudio('Thanks for holding.', 'cedar');
    await phrase_audio_cache.getPhraseAudio('Goodbye.', 'marin');
    const other_model = buildCache(cache_dir, { model: 'gpt-4o-mini-tts' });
    await other_model.phrase_audio_cache.getPhraseAudio(
      'Thanks for holding.',
      'marin',
    );
    const other_tone = buildCache(cache_dir, { instructions: 'Cheerful.' });
    await other_tone.phrase_audio_cache.getPhraseAudio(
      'Thanks for holding.',
      'marin',
    );

    // Audio from a fake or self-hosted server must never stand in for the real API's.
    const fake_server = buildCache(cache_dir, {
      server: 'http://localhost:8790/v1',
    });
    await fake_server.phrase_audio_cache.getPhraseAudio(
      'Thanks for holding.',
      'marin',
    );

    expect(ai_service.synthesize).toHaveBeenCalledTimes(3);
    expect(other_model.ai_service.synthesize).toHaveBeenCalledTimes(1);
    expect(other_tone.ai_service.synthesize).toHaveBeenCalledTimes(1);
    expect(fake_server.ai_service.synthesize).toHaveBeenCalledTimes(1);
    expect(await readdir(cache_dir)).toHaveLength(6);
  });

  it('pre-renders one phrase at a time per voice and counts failures', async () => {
    const { phrase_audio_cache, ai_service } = buildCache(cache_dir);
    let concurrent_renders = 0;
    let max_concurrent_renders = 0;
    ai_service.synthesize.mockImplementation(
      async (speech_request: { text: string }) => {
        concurrent_renders += 1;
        max_concurrent_renders = Math.max(
          max_concurrent_renders,
          concurrent_renders,
        );
        await new Promise((resolve) => setTimeout(resolve, 5));
        concurrent_renders -= 1;
        if (speech_request.text === 'broken') {
          throw new Error('voice failed');
        }
        return {
          pcm: new Int16Array(4),
          sample_rate: 24_000,
          provider: 'openai',
          model: 'gpt-realtime-2.1-mini',
          voice: 'marin',
        };
      },
    );

    const prerender_outcome = await phrase_audio_cache.prerenderPhrases(
      ['one', 'two', 'broken'],
      ['marin', 'cedar'],
    );

    expect(prerender_outcome).toEqual({ rendered_count: 4, failed_count: 2 });
    expect(max_concurrent_renders).toBe(2);
  });
});
