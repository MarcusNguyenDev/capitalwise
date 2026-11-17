import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { aiConfig } from '../../config/ai.config';
import { AiProviderRequestFailedError } from '../errors/ai_provider_request_failed.error';
import { AiCapability } from '../types/ai_capability.enum';
import { ResolvedChatRequest } from '../types/chat_request.type';
import { ResolvedSpeechRequest } from '../types/speech_synthesis.type';
import { OpenAiCompatibleProvider } from './openai_compatible.provider';

// The streamed speech endpoint only streams at normal speed.
const STREAMING_SPEED = 1;

// vLLM's OpenAI-compatible server: chat for any served model,
// /v1/audio/transcriptions for a Whisper model, and /v1/audio/speech for a
// TTS model served with vLLM-Omni (e.g. Qwen3-TTS). One vLLM server runs one
// model, so each capability usually has its own AI_*_BASE_URL.
@Injectable()
export class VllmProvider extends OpenAiCompatibleProvider {
  readonly provider_name = 'vllm' as const;
  readonly capabilities = [
    AiCapability.CHAT,
    AiCapability.TRANSCRIBE,
    AiCapability.SYNTHESIZE,
  ];
  readonly configuration_hint = 'VLLM_BASE_URL';
  protected readonly supports_speech_instructions = true;

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

  // Streams the audio as it decodes (a WAV, so the sample rate comes from
  // its header). A server or model that cannot stream gets one plain request.
  protected async requestSpeech(
    speech_request: ResolvedSpeechRequest,
  ): Promise<Response> {
    if (speech_request.speed !== STREAMING_SPEED) {
      return super.requestSpeech(speech_request);
    }
    try {
      return await this.postSpeech(speech_request, {
        response_format: 'wav',
        stream: true,
        stream_format: 'audio',
      });
    } catch (error) {
      if (
        error instanceof AiProviderRequestFailedError &&
        /HTTP 4\d\d/.test(error.message)
      ) {
        return super.requestSpeech(speech_request);
      }
      throw error;
    }
  }
}
