import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AiModule } from './ai/ai.module';
import { CallToolsModule } from './call_tools/call_tools.module';
import { CallsModule } from './calls/calls.module';
import { aiConfig } from './config/ai.config';
import { appConfig } from './config/app.config';
import { cacheConfig } from './config/cache.config';
import { contentConfig } from './config/content.config';
import { databaseConfig } from './config/database.config';
import { engineApiConfig } from './config/engine_api.config';
import { holdBufferConfig } from './config/hold_buffer.config';
import { livekitConfig } from './config/livekit.config';
import { pricingConfig } from './config/pricing.config';
import { turnDetectionConfig } from './config/turn_detection.config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { InterventionsModule } from './interventions/interventions.module';
import { LiveModule } from './live/live.module';
import { LivekitModule } from './livekit/livekit.module';
import { ScriptedCallsModule } from './scripted_calls/scripted_calls.module';
import { SimulatorModule } from './simulator/simulator.module';
import { VoiceModule } from './voice/voice.module';
import { VoiceAgentModule } from './voice_agent/voice_agent.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // core reads only its own core/.env (the root .env is for containers).
      envFilePath: ['.env'],
      load: [
        aiConfig,
        appConfig,
        cacheConfig,
        contentConfig,
        databaseConfig,
        engineApiConfig,
        holdBufferConfig,
        livekitConfig,
        pricingConfig,
        turnDetectionConfig,
      ],
    }),
    DatabaseModule,
    LiveModule,
    HealthModule,
    CallsModule,
    CallToolsModule,
    InterventionsModule,
    AiModule,
    LivekitModule,
    VoiceAgentModule,
    VoiceModule,
    SimulatorModule,
    ScriptedCallsModule,
  ],
})
export class AppModule {}
