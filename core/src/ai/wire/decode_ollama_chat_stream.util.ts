import { AiProviderRequestFailedError } from '../errors/ai_provider_request_failed.error';
import { ChatStreamEvent, ChatUsage } from '../types/chat_stream_event.type';
import { createToolCallId } from './create_tool_call_id.util';
import { parseToolArguments } from './parse_tool_arguments.util';
import { ThinkBlockFilter } from './think_block.filter';

interface OllamaStreamChunk {
  message?: {
    content?: string;
    thinking?: string;
    tool_calls?: {
      id?: string;
      function?: { name?: string; arguments?: unknown };
    }[];
  };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  prompt_eval_cached_count?: number;
  error?: string;
}

function readUsage(stream_chunk: OllamaStreamChunk): ChatUsage {
  return {
    input_tokens: stream_chunk.prompt_eval_count ?? 0,
    output_tokens: stream_chunk.eval_count ?? 0,
    cached_input_tokens: stream_chunk.prompt_eval_cached_count ?? 0,
  };
}

// Maps Ollama's native /api/chat NDJSON stream to the shared events. Ollama
// sends each tool call complete (arguments already an object), sometimes
// without an id, so one is synthesised. `thinking` is ignored and <think>
// blocks are removed from the content.
export async function* decodeOllamaChatStream(
  ndjson_objects: AsyncIterable<Record<string, unknown>>,
): AsyncGenerator<ChatStreamEvent> {
  const think_block_filter = new ThinkBlockFilter();
  let tool_call_count = 0;
  let final_chunk: OllamaStreamChunk | null = null;
  for await (const ndjson_object of ndjson_objects) {
    const stream_chunk = ndjson_object as OllamaStreamChunk;
    if (typeof stream_chunk.error === 'string') {
      throw new AiProviderRequestFailedError('ollama', stream_chunk.error);
    }
    const content = stream_chunk.message?.content ?? '';
    const visible_text = content ? think_block_filter.push(content) : '';
    if (visible_text.length > 0) {
      yield { type: 'text_delta', text: visible_text };
    }
    for (const tool_call of stream_chunk.message?.tool_calls ?? []) {
      tool_call_count += 1;
      yield {
        type: 'tool_call',
        tool_call_id: tool_call.id || createToolCallId(),
        name: tool_call.function?.name ?? '',
        arguments: parseToolArguments(tool_call.function?.arguments),
      };
    }
    if (stream_chunk.done) {
      final_chunk = stream_chunk;
    }
  }
  const remaining_text = think_block_filter.flush();
  if (remaining_text.length > 0) {
    yield { type: 'text_delta', text: remaining_text };
  }
  yield {
    type: 'done',
    finish_reason:
      tool_call_count > 0 ? 'tool_calls' : (final_chunk?.done_reason ?? 'stop'),
    usage: final_chunk
      ? readUsage(final_chunk)
      : { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0 },
  };
}
