// Raw 16-bit little-endian PCM from a streamed HTTP body, as Int16Array
// chunks; a sample split across two network chunks is carried over.
export async function* readPcmChunks(
  response_body: ReadableStream<Uint8Array>,
  onChunkReceived: () => void = () => undefined,
): AsyncGenerator<Int16Array> {
  const body_reader = response_body.getReader();
  let carried_byte: number | null = null;
  try {
    while (true) {
      const { done, value } = await body_reader.read();
      if (done) {
        return;
      }
      onChunkReceived();
      const chunk_bytes: Uint8Array =
        carried_byte === null
          ? value
          : Uint8Array.from([carried_byte, ...value]);
      carried_byte =
        chunk_bytes.length % 2 === 1
          ? chunk_bytes[chunk_bytes.length - 1]
          : null;
      const sample_count = Math.floor(chunk_bytes.length / 2);
      if (sample_count === 0) {
        continue;
      }
      const pcm = new Int16Array(sample_count);
      const byte_view = new DataView(
        chunk_bytes.buffer,
        chunk_bytes.byteOffset,
        sample_count * 2,
      );
      for (let sample_index = 0; sample_index < sample_count; sample_index++) {
        pcm[sample_index] = byte_view.getInt16(sample_index * 2, true);
      }
      yield pcm;
    }
  } finally {
    body_reader.releaseLock();
  }
}
