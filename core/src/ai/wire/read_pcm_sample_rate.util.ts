// For a TTS answer that is raw PCM rather than a WAV: the rate is read from
// `Content-Type: audio/pcm; rate=24000` or an `x-sample-rate` header.
export function readPcmSampleRate(response: Response): number | undefined {
  const content_type = response.headers.get('content-type') ?? '';
  const rate_match = content_type.match(/rate=(\d+)/i);
  const declared_rate = Number(
    rate_match?.[1] ?? response.headers.get('x-sample-rate') ?? NaN,
  );
  return Number.isFinite(declared_rate) && declared_rate > 0
    ? declared_rate
    : undefined;
}
