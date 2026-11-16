import { accumulateUsage } from './accumulate_usage.util';
import { appendResponseTime } from './append_response_time.util';
import {
  calculateEstimatedCostUsd,
  TokenPrices,
} from './calculate_estimated_cost.util';

const TOKEN_PRICES: TokenPrices = {
  audio_input_usd_per_1m: 32,
  audio_output_usd_per_1m: 64,
  text_input_usd_per_1m: 4,
  text_output_usd_per_1m: 16,
  cached_input_usd_per_1m: 0.4,
};

describe('calculateEstimatedCostUsd', () => {
  it('prices each token bucket at its own rate', () => {
    const estimated_cost_usd = calculateEstimatedCostUsd(
      {
        input_text_tokens: 1_000_000,
        input_audio_tokens: 1_000_000,
        cached_input_tokens: 1_000_000,
        output_text_tokens: 1_000_000,
        output_audio_tokens: 1_000_000,
      },
      TOKEN_PRICES,
    );
    expect(estimated_cost_usd).toBe(116.4);
  });

  it('prices a realistic short call and rounds to four decimals', () => {
    const estimated_cost_usd = calculateEstimatedCostUsd(
      {
        input_text_tokens: 2400,
        input_audio_tokens: 3100,
        cached_input_tokens: 9000,
        output_text_tokens: 350,
        output_audio_tokens: 2800,
      },
      TOKEN_PRICES,
    );
    // 0.0096 + 0.0992 + 0.0036 + 0.0056 + 0.1792
    expect(estimated_cost_usd).toBe(0.2972);
  });

  it('treats missing buckets as zero', () => {
    expect(calculateEstimatedCostUsd({}, TOKEN_PRICES)).toBe(0);
    expect(
      calculateEstimatedCostUsd({ output_audio_tokens: 500_000 }, TOKEN_PRICES),
    ).toBe(32);
  });
});

describe('accumulateUsage', () => {
  it('adds an increment to the usage so far', () => {
    const accumulated_usage = accumulateUsage(
      { input_audio_tokens: 100, output_audio_tokens: 40 },
      { input_audio_tokens: 50, cached_input_tokens: 10 },
    );
    expect(accumulated_usage).toEqual({
      input_text_tokens: 0,
      input_audio_tokens: 150,
      cached_input_tokens: 10,
      output_text_tokens: 0,
      output_audio_tokens: 40,
    });
  });

  it('starts from zero when there is no usage yet', () => {
    expect(
      accumulateUsage(undefined, { output_text_tokens: 7 }).output_text_tokens,
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
