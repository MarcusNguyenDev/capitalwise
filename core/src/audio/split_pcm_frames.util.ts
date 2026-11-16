const MILLISECONDS_PER_SECOND = 1000;

// Splits PCM into fixed-length frames (10 ms by default); the last frame is
// padded with silence so every frame has the same length.
export function splitPcmFrames(
  pcm: Int16Array,
  frame_settings: { sample_rate: number; frame_ms?: number },
): Int16Array[] {
  const samples_per_frame = Math.round(
    (frame_settings.sample_rate * (frame_settings.frame_ms ?? 10)) /
      MILLISECONDS_PER_SECOND,
  );
  const frames: Int16Array[] = [];
  for (
    let frame_start = 0;
    frame_start < pcm.length;
    frame_start += samples_per_frame
  ) {
    const frame = new Int16Array(samples_per_frame);
    frame.set(pcm.subarray(frame_start, frame_start + samples_per_frame));
    frames.push(frame);
  }
  return frames;
}

export function calculatePcmDurationMs(
  sample_count: number,
  sample_rate: number,
): number {
  return Math.round((sample_count / sample_rate) * MILLISECONDS_PER_SECOND);
}
