import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CallsModule } from '../calls/calls.module';
import { EngineApiModule } from '../engine_api/engine_api.module';
import { LiveModule } from '../live/live.module';
import { InterventionRecordsModule } from './intervention_records.module';
import { InterventionsController } from './interventions.controller';
import { InterventionsService } from './interventions.service';

@Module({
  imports: [
    AuditModule,
    CallsModule,
    EngineApiModule,
    LiveModule,
    InterventionRecordsModule,
  ],
  controllers: [InterventionsController],
  providers: [InterventionsService],
  exports: [InterventionsService],
})
export class InterventionsModule {}
