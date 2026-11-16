import { Module } from '@nestjs/common';

import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiPlaygroundService } from './ai_playground.service';
import {
  AI_PROVIDER_REGISTRY,
  AiProvider,
  AiProviderRegistry,
} from './providers/ai_provider';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { SpeachesProvider } from './providers/speaches.provider';
import { VllmProvider } from './providers/vllm.provider';

// Every backend, registered once. A new one (deepgram.provider.ts,
// elevenlabs.provider.ts...) is one file plus one entry here and its name in
// AI_PROVIDER_NAMES.
const AI_PROVIDER_CLASSES = [
  OllamaProvider,
  VllmProvider,
  OpenAiProvider,
  SpeachesProvider,
];

@Module({
  controllers: [AiController],
  providers: [
    ...AI_PROVIDER_CLASSES,
    {
      provide: AI_PROVIDER_REGISTRY,
      useFactory: (...providers: AiProvider[]): AiProviderRegistry =>
        new Map(
          providers.map((provider) => [provider.provider_name, provider]),
        ),
      inject: AI_PROVIDER_CLASSES,
    },
    AiService,
    AiPlaygroundService,
  ],
  exports: [AiService],
})
export class AiModule {}
