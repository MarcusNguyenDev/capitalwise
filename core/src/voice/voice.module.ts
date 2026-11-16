import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { CallsModule } from '../calls/calls.module';
import { InterventionRecordsModule } from '../interventions/intervention_records.module';
import { LivekitModule } from '../livekit/livekit.module';
import { VoiceAgentModule } from '../voice_agent/voice_agent.module';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  imports: [
    AiModule,
    CallsModule,
    InterventionRecordsModule,
    LivekitModule,
    VoiceAgentModule,
  ],
  controllers: [VoiceController],
  providers: [VoiceService],
})
export class VoiceModule {}
