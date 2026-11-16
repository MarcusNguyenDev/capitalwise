import { readTextLines } from './read_text_lines.util';

const SSE_DATA_PREFIX = 'data:';
const SSE_DONE_MARKER = '[DONE]';

// Server-sent events as used by OpenAI-style streaming: yields each parsed
// `data:` payload and stops at `data: [DONE]`. Multi-line data is joined.
export async function* readSseData(
  response_body: ReadableStream<Uint8Array>,
  onChunkReceived?: () => void,
): AsyncGenerator<Record<string, unknown>> {
  let data_lines: string[] = [];
  for await (const text_line of readTextLines(response_body, onChunkReceived)) {
    if (text_line.startsWith(SSE_DATA_PREFIX)) {
      data_lines.push(text_line.slice(SSE_DATA_PREFIX.length).trimStart());
      continue;
    }
    if (text_line.trim() !== '' || data_lines.length === 0) {
      continue;
    }
    const event_data = data_lines.join('\n');
    data_lines = [];
    if (event_data === SSE_DONE_MARKER) {
      return;
    }
    yield JSON.parse(event_data) as Record<string, unknown>;
  }
  const trailing_data = data_lines.join('\n');
  if (trailing_data !== '' && trailing_data !== SSE_DONE_MARKER) {
    yield JSON.parse(trailing_data) as Record<string, unknown>;
  }
}
