import { ChatStreamEvent, ChatUsage } from '../types/chat_stream_event.type';
import { createToolCallId } from './create_tool_call_id.util';
import { parseToolArguments } from './parse_tool_arguments.util';
import { ThinkBlockFilter } from './think_block.filter';

interface ToolCallFragments {
  tool_call_id: string;
  name: string;
  arguments_text: string;
}

interface OpenAiStreamChunk {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: {
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string | null;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number } | null;
  } | null;
}

function readUsage(stream_chunk: OpenAiStreamChunk): ChatUsage | null {
  if (!stream_chunk.usage) {
    return null;
  }
  return {
    input_tokens: stream_chunk.usage.prompt_tokens ?? 0,
    output_tokens: stream_chunk.usage.completion_tokens ?? 0,
    cached_input_tokens:
      stream_chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
  };
}

function collectToolCallFragments(
  fragments_by_index: Map<number, ToolCallFragments>,
  stream_chunk: OpenAiStreamChunk,
): void {
  for (const tool_call_delta of stream_chunk.choices?.[0]?.delta?.tool_calls ??
    []) {
    const call_index = tool_call_delta.index ?? fragments_by_index.size;
    const fragments = fragments_by_index.get(call_index) ?? {
      tool_call_id: '',
      name: '',
      arguments_text: '',
    };
    fragments.tool_call_id = tool_call_delta.id || fragments.tool_call_id;
    fragments.name += tool_call_delta.function?.name ?? '';
    fragments.arguments_text += tool_call_delta.function?.arguments ?? '';
    fragments_by_index.set(call_index, fragments);
  }
}

// Maps an OpenAI-style chat completion stream (SSE chunks) to the shared
// events. Tool call arguments arrive as JSON string fragments spread over
// many chunks; they are emitted once, complete and parsed, at the end.
// `reasoning` / `reasoning_content` deltas are ignored, <think> blocks removed.
export async function* decodeOpenAiChatStream(
  sse_payloads: AsyncIterable<Record<string, unknown>>,
): AsyncGenerator<ChatStreamEvent> {
  const think_block_filter = new ThinkBlockFilter();
  const fragments_by_index = new Map<number, ToolCallFragments>();
  let finish_reason = 'stop';
  let usage: ChatUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cached_input_tokens: 0,
  };
  for await (const sse_payload of sse_payloads) {
    const stream_chunk = sse_payload as OpenAiStreamChunk;
    const content = stream_chunk.choices?.[0]?.delta?.content;
    if (typeof content === 'string' && content.length > 0) {
      const visible_text = think_block_filter.push(content);
      if (visible_text.length > 0) {
        yield { type: 'text_delta', text: visible_text };
      }
    }
    collectToolCallFragments(fragments_by_index, stream_chunk);
    finish_reason = stream_chunk.choices?.[0]?.finish_reason ?? finish_reason;
    usage = readUsage(stream_chunk) ?? usage;
  }
  const remaining_text = think_block_filter.flush();
  if (remaining_text.length > 0) {
    yield { type: 'text_delta', text: remaining_text };
  }
  const ordered_indexes = [...fragments_by_index.keys()].sort((a, b) => a - b);
  for (const call_index of ordered_indexes) {
    const fragments = fragments_by_index.get(call_index) as ToolCallFragments;
    yield {
      type: 'tool_call',
      tool_call_id: fragments.tool_call_id || createToolCallId(),
      name: fragments.name,
      arguments: parseToolArguments(fragments.arguments_text),
    };
  }
  yield {
    type: 'done',
    finish_reason: fragments_by_index.size > 0 ? 'tool_calls' : finish_reason,
    usage,
  };
}
