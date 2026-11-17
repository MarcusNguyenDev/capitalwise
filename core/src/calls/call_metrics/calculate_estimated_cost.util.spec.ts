import { accumulateUsage } from './accumulate_usage.util';
import { appendResponseTime } from './append_response_time.util';
import {
  calculateEstimatedCostUsd,
  UsagePrices,
} from './calculate_estimated_cost.util';

const NO_TOKEN_TTS_PRICES = {
  llm_cached_input_usd_per_1m_tokens: 0,
  tts_input_usd_per_1m_tokens: 0,
  tts_cached_input_usd_per_1m_tokens: 0,
  tts_output_audio_usd_per_1m_tokens: 0,
  tts_output_text_usd_per_1m_tokens: 0,
};

const HOSTED_PRICES: UsagePrices = {
  ...NO_TOKEN_TTS_PRICES,
  llm_input_usd_per_1m_tokens: 0.4,
  llm_output_usd_per_1m_tokens: 1.6,
  stt_usd_per_minute: 0.006,
  tts_usd_per_1m_characters: 15,
};

const SELF_HOSTED_PRICES: UsagePrices = {
  ...NO_TOKEN_TTS_PRICES,
  llm_input_usd_per_1m_tokens: 0,
  llm_output_usd_per_1m_tokens: 0,
  stt_usd_per_minute: 0,
  tts_usd_per_1m_characters: 0,
};

// gpt-6-luna + gpt-live-transcribe + gpt-realtime-2.1-mini as a reader.
const OPENAI_PRICES: UsagePrices = {
  llm_input_usd_per_1m_tokens: 0.1,
  llm_cached_input_usd_per_1m_tokens: 0.01,
  llm_output_usd_per_1m_tokens: 0.5,
  stt_usd_per_minute: 0.017,
  tts_usd_per_1m_characters: 0,
  tts_input_usd_per_1m_tokens: 0.6,
  tts_cached_input_usd_per_1m_tokens: 0.06,
  tts_output_audio_usd_per_1m_tokens: 20,
  tts_output_text_usd_per_1m_tokens: 2.4,
};

describe('calculateEstimatedCostUsd', () => {
  it('prices tokens per million, audio per minute and characters per million', () => {
    const estimated_cost_usd = calculateEstimatedCostUsd(
      {
        llm_input_tokens: 1_000_000,
        llm_output_tokens: 1_000_000,
        stt_audio_seconds: 600,
        tts_characters: 1_000_000,
      },
      HOSTED_PRICES,
    );
    // 0.4 + 1.6 + 10 minutes * 0.006 + 15
    expect(estimated_cost_usd).toBe(17.06);
  });

  it('prices a realistic short call and rounds to four decimals', () => {
    const estimated_cost_usd = calculateEstimatedCostUsd(
      {
        llm_input_tokens: 24_000,
        llm_output_tokens: 600,
        stt_audio_seconds: 45,
        tts_characters: 1_400,
      },
      HOSTED_PRICES,
    );
    // 0.0096 + 0.00096 + 0.0045 + 0.021
    expect(estimated_cost_usd).toBe(0.0361);
  });

  it('costs nothing when everything is self-hosted or usage is missing', () => {
    expect(calculateEstimatedCostUsd({}, HOSTED_PRICES)).toBe(0);
    expect(
      calculateEstimatedCostUsd(
        { llm_input_tokens: 50_000, tts_characters: 9_000 },
        SELF_HOSTED_PRICES,
      ),
    ).toBe(0);
  });
});

describe('calculateEstimatedCostUsd with the OpenAI setup', () => {
  it('prices cached chat input, transcription minutes and realtime voice tokens', () => {
    const estimated_cost_usd = calculateEstimatedCostUsd(
      {
        llm_input_tokens: 20_000,
        llm_cached_input_tokens: 100_000,
        llm_output_tokens: 1_000,
        stt_audio_seconds: 60,
        tts_input_tokens: 5_000,
        tts_cached_input_tokens: 10_000,
        tts_output_audio_tokens: 4_000,
        tts_output_text_tokens: 1_000,
      },
      OPENAI_PRICES,
    );
    // 0.002 + 0.001 + 0.0005 + 0.017 + 0.003 + 0.0006 + 0.08 + 0.0024
    expect(estimated_cost_usd).toBe(0.1065);
  });
});

describe('accumulateUsage', () => {
  it('adds an increment to the usage so far', () => {
    const accumulated_usage = accumulateUsage(
      { llm_input_tokens: 100, stt_audio_seconds: 1.25 },
      { llm_input_tokens: 50, stt_audio_seconds: 2.5, tts_characters: 80 },
    );
    expect(accumulated_usage).toMatchObject({
      llm_input_tokens: 150,
      llm_output_tokens: 0,
      stt_audio_seconds: 3.75,
      tts_characters: 80,
      tts_output_audio_tokens: 0,
    });
  });

  it('starts from zero when there is no usage yet', () => {
    expect(
      accumulateUsage(undefined, { llm_output_tokens: 7 }).llm_output_tokens,
    ).toBe(7);
  });
});

describe('appendResponseTime', () => {
  it('appends the time and recomputes the average', () => {
    const metrics = appendResponseTime(
      { mode: 'LIVE', response_times_ms: [600, 700] },
      800.4,
    );
    expect(metrics.response_times_ms).toEqual([600, 700, 800]);
    expect(metrics.avg_response_ms).toBe(700);
    expect(metrics.mode).toBe('LIVE');
  });

  it('works on empty metrics', () => {
    expect(appendResponseTime({}, 512).avg_response_ms).toBe(512);
  });
});
