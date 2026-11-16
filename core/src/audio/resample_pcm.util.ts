// Linear interpolation: good enough for speech between 16, 22.05 and 24 kHz.
export function resamplePcm(
  pcm: Int16Array,
  source_sample_rate: number,
  target_sample_rate: number,
): Int16Array {
  if (source_sample_rate === target_sample_rate || pcm.length === 0) {
    return pcm;
  }
  const rate_ratio = source_sample_rate / target_sample_rate;
  const target_length = Math.max(1, Math.round(pcm.length / rate_ratio));
  const resampled_pcm = new Int16Array(target_length);
  for (let target_index = 0; target_index < target_length; target_index++) {
    const source_position = target_index * rate_ratio;
    const lower_index = Math.floor(source_position);
    const upper_index = Math.min(lower_index + 1, pcm.length - 1);
    const upper_weight = source_position - lower_index;
    resampled_pcm[target_index] = Math.round(
      pcm[Math.min(lower_index, pcm.length - 1)] * (1 - upper_weight) +
        pcm[upper_index] * upper_weight,
    );
  }
  return resampled_pcm;
}
