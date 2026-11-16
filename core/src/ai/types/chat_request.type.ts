// Provider-neutral chat structures. Every provider maps them to its own wire
// format, so the voice agent never knows which backend answers.

export interface ChatToolCall {
  tool_call_id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface SystemChatMessage {
  role: 'system';
  content: string;
}

export interface UserChatMessage {
  role: 'user';
  content: string;
}

export interface AssistantChatMessage {
  role: 'assistant';
  content: string;
  tool_calls?: ChatToolCall[];
}

export interface ToolChatMessage {
  role: 'tool';
  tool_call_id: string;
  name: string;
  content: string;
}

export type ChatMessage =
  SystemChatMessage | UserChatMessage | AssistantChatMessage | ToolChatMessage;

// The function-tool format both the OpenAI-style APIs and Ollama accept.
export interface ChatToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  tools?: ChatToolDefinition[];
  temperature?: number;
  max_output_tokens?: number;
  abort_signal?: AbortSignal;
}

// What a provider receives: AiService has filled in the configured defaults.
export interface ResolvedChatRequest extends ChatRequest {
  model: string;
  temperature: number;
  max_output_tokens: number;
  timeout_ms: number;
  // 'none' turns thinking off; each provider maps it to its own switch.
  reasoning_effort: string;
}
