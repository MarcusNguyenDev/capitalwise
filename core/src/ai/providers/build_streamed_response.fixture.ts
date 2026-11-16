// Test helper: a fetch Response whose body arrives in the given chunks, so
// stream decoders are exercised with lines split at awkward places.
export function buildStreamedResponse(
  body_chunks: string[],
  response_init: ResponseInit = { status: 200 },
): Response {
  const text_encoder = new TextEncoder();
  const response_body = new ReadableStream<Uint8Array>({
    start(stream_controller) {
      for (const body_chunk of body_chunks) {
        stream_controller.enqueue(text_encoder.encode(body_chunk));
      }
      stream_controller.close();
    },
  });
  return new Response(response_body, response_init);
}

// Splits a text into chunks of the given size.
export function splitIntoChunks(full_text: string, chunk_size: number): string[] {
  const chunks: string[] = [];
  for (let offset = 0; offset < full_text.length; offset += chunk_size) {
    chunks.push(full_text.slice(offset, offset + chunk_size));
  }
  return chunks;
}

export async function collectEvents<Event>(
  event_stream: AsyncIterable<Event>,
): Promise<Event[]> {
  const events: Event[] = [];
  for await (const stream_event of event_stream) {
    events.push(stream_event);
  }
  return events;
}
