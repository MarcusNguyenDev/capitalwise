import { Module } from '@nestjs/common';

import { CallScriptsModule } from '../call_scripts/call_scripts.module';
import { CallToolsModule } from '../call_tools/call_tools.module';
import { CallsModule } from '../calls/calls.module';
import { EngineApiModule } from '../engine_api/engine_api.module';
import { InterventionsModule } from '../interventions/interventions.module';
import { LiveModule } from '../live/live.module';
import { SimulatorController } from './simulator.controller';
import { SimulatorService } from './simulator.service';

@Module({
  imports: [
    CallScriptsModule,
    CallToolsModule,
    CallsModule,
    EngineApiModule,
    InterventionsModule,
    LiveModule,
  ],
  controllers: [SimulatorController],
  providers: [SimulatorService],
})
export class SimulatorModule {}
