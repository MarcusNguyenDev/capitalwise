export interface ChatUsage {
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens: number;
}

export interface ChatTextDeltaEvent {
  type: 'text_delta';
  text: string;
}

// Emitted once per tool call, complete and with parsed arguments.
export interface ChatToolCallEvent {
  type: 'tool_call';
  tool_call_id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatDoneEvent {
  type: 'done';
  finish_reason: string;
  usage: ChatUsage;
}

export type ChatStreamEvent =
  ChatTextDeltaEvent | ChatToolCallEvent | ChatDoneEvent;
