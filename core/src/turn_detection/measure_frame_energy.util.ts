// Root mean square of a 16-bit PCM frame (0 = silence, 32767 = full scale).
export function measureFrameEnergy(frame: Int16Array): number {
  if (frame.length === 0) {
    return 0;
  }
  let sum_of_squares = 0;
  for (const sample of frame) {
    sum_of_squares += sample * sample;
  }
  return Math.sqrt(sum_of_squares / frame.length);
}
