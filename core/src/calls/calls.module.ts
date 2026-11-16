import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { EngineApiModule } from '../engine_api/engine_api.module';
import { InterventionRecordsModule } from '../interventions/intervention_records.module';
import { LiveModule } from '../live/live.module';
import { CallHoldService } from './call_hold.service';
import { CallTurnsRepository } from './call_turns.repository';
import { CallsController } from './calls.controller';
import { CallsRepository } from './calls.repository';
import { CallsService } from './calls.service';

@Module({
  imports: [
    AuditModule,
    EngineApiModule,
    InterventionRecordsModule,
    LiveModule,
  ],
  controllers: [CallsController],
  providers: [
    CallsService,
    CallHoldService,
    CallsRepository,
    CallTurnsRepository,
  ],
  exports: [CallsService, CallHoldService],
})
export class CallsModule {}
