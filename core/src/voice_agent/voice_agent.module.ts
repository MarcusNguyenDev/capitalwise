import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { CallToolsModule } from '../call_tools/call_tools.module';
import { CallsModule } from '../calls/calls.module';
import { HoldBufferModule } from '../hold_buffer/hold_buffer.module';
import { InterventionsModule } from '../interventions/interventions.module';
import { LiveModule } from '../live/live.module';
import { LivekitModule } from '../livekit/livekit.module';
import { PromptsModule } from '../prompts/prompts.module';
import { TurnDetectionModule } from '../turn_detection/turn_detection.module';
import { AiAgentsRepository } from './ai_agents.repository';
import { VoiceAgentBootstrapService } from './voice_agent_bootstrap.service';
import { VoiceAgentSessionManager } from './voice_agent_session.manager';

@Module({
  imports: [
    AiModule,
    CallToolsModule,
    CallsModule,
    HoldBufferModule,
    InterventionsModule,
    LiveModule,
    LivekitModule,
    PromptsModule,
    TurnDetectionModule,
  ],
  providers: [
    VoiceAgentSessionManager,
    VoiceAgentBootstrapService,
    AiAgentsRepository,
  ],
  exports: [VoiceAgentSessionManager],
})
export class VoiceAgentModule {}
