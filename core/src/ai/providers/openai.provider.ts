import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { aiConfig } from '../../config/ai.config';
import { AiCapability } from '../types/ai_capability.enum';
import { ResolvedChatRequest } from '../types/chat_request.type';
import { OpenAiCompatibleProvider } from './openai_compatible.provider';

// OpenAI cloud: chat, transcriptions and speech.
@Injectable()
export class OpenAiProvider extends OpenAiCompatibleProvider {
  readonly provider_name = 'openai' as const;
  readonly capabilities = [
    AiCapability.CHAT,
    AiCapability.TRANSCRIBE,
    AiCapability.SYNTHESIZE,
  ];
  readonly configuration_hint = 'OPENAI_API_KEY';

  constructor(@Inject(aiConfig.KEY) ai_config: ConfigType<typeof aiConfig>) {
    super(ai_config.providers.openai);
  }

  // The base URL has a default, so the key is what makes it usable.
  isConfigured(): boolean {
    return super.isConfigured() && this.connection.api_key.length > 0;
  }

  // Current OpenAI models take max_completion_tokens; reasoning_effort is
  // only sent when set to something other than "none", because non-reasoning
  // models (gpt-4o, gpt-4.1) reject the parameter.
  protected buildChatBody(
    chat_request: ResolvedChatRequest,
  ): Record<string, unknown> {
    const { max_tokens, ...chat_body } = super.buildChatBody(chat_request);
    return {
      ...chat_body,
      max_completion_tokens: max_tokens,
      ...(chat_request.reasoning_effort &&
      chat_request.reasoning_effort !== 'none'
        ? { reasoning_effort: chat_request.reasoning_effort }
        : {}),
    };
  }
}
