import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CallToolsModule } from './call_tools/call_tools.module';
import { CallsModule } from './calls/calls.module';
import { appConfig } from './config/app.config';
import { cacheConfig } from './config/cache.config';
import { contentConfig } from './config/content.config';
import { databaseConfig } from './config/database.config';
import { engineApiConfig } from './config/engine_api.config';
import { pricingConfig } from './config/pricing.config';
import { voiceConfig } from './config/voice.config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { InterventionsModule } from './interventions/interventions.module';
import { LiveModule } from './live/live.module';
import { ScriptedCallsModule } from './scripted_calls/scripted_calls.module';
import { SimulatorModule } from './simulator/simulator.module';
import { VoiceModule } from './voice/voice.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      load: [
        appConfig,
        cacheConfig,
        contentConfig,
        databaseConfig,
        engineApiConfig,
        pricingConfig,
        voiceConfig,
      ],
    }),
    DatabaseModule,
    LiveModule,
    HealthModule,
    CallsModule,
    CallToolsModule,
    InterventionsModule,
    VoiceModule,
    SimulatorModule,
    ScriptedCallsModule,
  ],
})
export class AppModule {}
