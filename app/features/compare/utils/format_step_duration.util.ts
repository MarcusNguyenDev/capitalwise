import { formatLongDuration } from "@/shared/format/format_values.util";

const WHOLE_SECONDS_FROM = 10;

/** Measured steps can be well under a second, so short durations keep one decimal: 0.6 -> "0.6s". */
export function formatStepDuration(duration_seconds: number): string {
  const is_short_fraction = duration_seconds < WHOLE_SECONDS_FROM && !Number.isInteger(duration_seconds);
  return is_short_fraction ? `${duration_seconds.toFixed(1)}s` : formatLongDuration(duration_seconds);
}
