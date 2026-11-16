import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { PhraseAudioCache } from './phrase_audio.cache';

// Hold policy (pure classes and constants imported directly) plus the
// pre-rendered phrase audio, which needs text-to-speech.
@Module({
  imports: [AiModule],
  providers: [PhraseAudioCache],
  exports: [PhraseAudioCache],
})
export class HoldBufferModule {}
