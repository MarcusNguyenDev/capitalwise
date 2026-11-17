import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { aiConfig } from '../../config/ai.config';
import { AiCapability } from '../types/ai_capability.enum';
import { ChatMessage, ResolvedChatRequest } from '../types/chat_request.type';
import { ChatStreamEvent } from '../types/chat_stream_event.type';
import { ProviderConnection } from '../types/provider_connection.type';
import { IdleWatchdog } from '../wire/idle.watchdog';
import { decodeOllamaChatStream } from '../wire/decode_ollama_chat_stream.util';
import { readNdjsonObjects } from '../wire/read_ndjson_objects.util';
import {
  mapProviderFetchError,
  sendProviderRequest,
} from '../wire/send_provider_request.util';
import { AiProvider } from './ai_provider';

// People paste the OpenAI-compatible URL (".../v1") by habit; the native API
// lives at the root.
function normaliseNativeBaseUrl(base_url: string): string {
  return base_url.replace(/\/(v1|api)\/?$/, '');
}

function mapMessageToWire(chat_message: ChatMessage): Record<string, unknown> {
  if (chat_message.role === 'assistant') {
    const tool_calls = chat_message.tool_calls ?? [];
    return {
      role: 'assistant',
      content: chat_message.content,
      ...(tool_calls.length > 0
        ? {
            tool_calls: tool_calls.map((tool_call) => ({
              id: tool_call.tool_call_id,
              function: {
                name: tool_call.name,
                arguments: tool_call.arguments,
              },
            })),
          }
        : {}),
    };
  }
  if (chat_message.role === 'tool') {
    return {
      role: 'tool',
      tool_name: chat_message.name,
      tool_call_id: chat_message.tool_call_id,
      content: chat_message.content,
    };
  }
  return { role: chat_message.role, content: chat_message.content };
}

// Ollama's NATIVE API (/api/chat, /api/tags): unlike its /v1 shim it honours
// `think: false`, which keeps thinking models from adding seconds of silence.
@Injectable()
export class OllamaProvider extends AiProvider {
  readonly provider_name = 'ollama' as const;
  readonly capabilities = [AiCapability.CHAT];
  readonly configuration_hint = 'OLLAMA_BASE_URL';
  private readonly connection: ProviderConnection;

  constructor(@Inject(aiConfig.KEY) ai_config: ConfigType<typeof aiConfig>) {
    super();
    this.connection = {
      base_url: normaliseNativeBaseUrl(ai_config.providers.ollama.base_url),
      api_key: ai_config.providers.ollama.api_key,
    };
  }

  isConfigured(): boolean {
    return this.connection.base_url.length > 0;
  }

  async listModels(timeout_ms: number, base_url?: string): Promise<string[]> {
    const response = await sendProviderRequest({
      provider_name: this.provider_name,
      url: `${this.resolveBaseUrl(base_url)}/api/tags`,
      method: 'GET',
      api_key: this.connection.api_key,
      timeout_ms,
    });
    const tags_body = (await response.json()) as {
      models?: { name?: string; model?: string }[];
    };
    return (tags_body.models ?? [])
      .map((model_entry) => model_entry.name ?? model_entry.model ?? '')
      .filter((model_name) => model_name.length > 0);
  }

  async *chat(
    chat_request: ResolvedChatRequest,
  ): AsyncGenerator<ChatStreamEvent> {
    const chat_url = `${this.resolveBaseUrl(chat_request.base_url)}/api/chat`;
    const idle_watchdog = new IdleWatchdog(chat_request.timeout_ms);
    const response = await sendProviderRequest({
      provider_name: this.provider_name,
      url: chat_url,
      method: 'POST',
      api_key: this.connection.api_key,
      json_body: this.buildChatBody(chat_request),
      timeout_ms: chat_request.timeout_ms,
      idle_watchdog,
      abort_signal: chat_request.abort_signal,
    }).catch((error: unknown) => {
      idle_watchdog.stop();
      throw error;
    });
    try {
      yield* decodeOllamaChatStream(
        readNdjsonObjects(response.body as ReadableStream<Uint8Array>, () =>
          idle_watchdog.restart(),
        ),
      );
    } catch (error) {
      throw mapProviderFetchError(
        {
          provider_name: this.provider_name,
          url: chat_url,
          timeout_ms: chat_request.timeout_ms,
          abort_signal: chat_request.abort_signal,
        },
        error,
      );
    } finally {
      idle_watchdog.stop();
    }
  }

  private resolveBaseUrl(base_url_override?: string): string {
    return base_url_override
      ? normaliseNativeBaseUrl(base_url_override)
      : this.connection.base_url;
  }

  private buildChatBody(
    chat_request: ResolvedChatRequest,
  ): Record<string, unknown> {
    const is_thinking_off =
      chat_request.reasoning_effort === '' ||
      chat_request.reasoning_effort === 'none';
    return {
      model: chat_request.model,
      messages: chat_request.messages.map(mapMessageToWire),
      ...(chat_request.tools && chat_request.tools.length > 0
        ? { tools: chat_request.tools }
        : {}),
      stream: true,
      think: is_thinking_off ? false : chat_request.reasoning_effort,
      options: {
        temperature: chat_request.temperature,
        num_predict: chat_request.max_output_tokens,
      },
    };
  }
}
