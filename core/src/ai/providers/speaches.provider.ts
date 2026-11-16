import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { aiConfig } from '../../config/ai.config';
import { AiCapability } from '../types/ai_capability.enum';
import { OpenAiCompatibleProvider } from './openai_compatible.provider';

// Speaches (self-hosted, OpenAI-compatible): speech-to-text with Whisper
// models and text-to-speech with Kokoro or Piper. No chat.
@Injectable()
export class SpeachesProvider extends OpenAiCompatibleProvider {
  readonly provider_name = 'speaches' as const;
  readonly capabilities = [AiCapability.TRANSCRIBE, AiCapability.SYNTHESIZE];
  readonly configuration_hint = 'SPEACHES_BASE_URL';

  constructor(@Inject(aiConfig.KEY) ai_config: ConfigType<typeof aiConfig>) {
    super(ai_config.providers.speaches);
  }
}
