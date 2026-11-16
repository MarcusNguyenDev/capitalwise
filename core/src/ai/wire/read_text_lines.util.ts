// Yields the body of a streamed HTTP response line by line (without the
// line break), however the bytes were chunked on the wire. `onChunkReceived`
// runs for every network chunk (an idle watchdog restarts its clock there).
export async function* readTextLines(
  response_body: ReadableStream<Uint8Array>,
  onChunkReceived: () => void = () => undefined,
): AsyncGenerator<string> {
  const body_reader = response_body.getReader();
  const text_decoder = new TextDecoder();
  let pending_text = '';
  try {
    while (true) {
      const { done, value } = await body_reader.read();
      if (done) {
        break;
      }
      onChunkReceived();
      pending_text += text_decoder.decode(value, { stream: true });
      let line_break_index = pending_text.indexOf('\n');
      while (line_break_index !== -1) {
        yield pending_text.slice(0, line_break_index).replace(/\r$/, '');
        pending_text = pending_text.slice(line_break_index + 1);
        line_break_index = pending_text.indexOf('\n');
      }
    }
    pending_text += text_decoder.decode();
    if (pending_text.length > 0) {
      yield pending_text.replace(/\r$/, '');
    }
  } finally {
    body_reader.releaseLock();
  }
}
