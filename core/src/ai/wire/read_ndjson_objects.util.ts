import { readTextLines } from './read_text_lines.util';

// Newline-delimited JSON (Ollama's native streaming format).
export async function* readNdjsonObjects(
  response_body: ReadableStream<Uint8Array>,
  onChunkReceived?: () => void,
): AsyncGenerator<Record<string, unknown>> {
  for await (const text_line of readTextLines(response_body, onChunkReceived)) {
    const trimmed_line = text_line.trim();
    if (trimmed_line.length === 0) {
      continue;
    }
    yield JSON.parse(trimmed_line) as Record<string, unknown>;
  }
}
