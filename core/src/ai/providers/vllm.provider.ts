import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { aiConfig } from '../../config/ai.config';
import { AiCapability } from '../types/ai_capability.enum';
import { ResolvedChatRequest } from '../types/chat_request.type';
import { OpenAiCompatibleProvider } from './openai_compatible.provider';

// vLLM's OpenAI-compatible server: chat for any served model, and
// /v1/audio/transcriptions when it serves a Whisper model.
@Injectable()
export class VllmProvider extends OpenAiCompatibleProvider {
  readonly provider_name = 'vllm' as const;
  readonly capabilities = [AiCapability.CHAT, AiCapability.TRANSCRIBE];
  readonly configuration_hint = 'VLLM_BASE_URL';

  constructor(@Inject(aiConfig.KEY) ai_config: ConfigType<typeof aiConfig>) {
    super(ai_config.providers.vllm);
  }

  // Qwen3-style chat templates think unless told not to.
  protected buildChatBody(
    chat_request: ResolvedChatRequest,
  ): Record<string, unknown> {
    return {
      ...super.buildChatBody(chat_request),
      ...(chat_request.reasoning_effort === 'none'
        ? { chat_template_kwargs: { enable_thinking: false } }
        : {}),
    };
  }
}
