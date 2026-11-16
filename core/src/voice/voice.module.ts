import { Module } from '@nestjs/common';

import { CallsModule } from '../calls/calls.module';
import { PromptsModule } from '../prompts/prompts.module';
import { OpenAiRealtimeClient } from './openai_realtime.client';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  imports: [CallsModule, PromptsModule],
  controllers: [VoiceController],
  providers: [VoiceService, OpenAiRealtimeClient],
})
export class VoiceModule {}
