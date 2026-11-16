import { Module } from '@nestjs/common';

import { CallRecordsRepository } from './call_records.repository';
import { CallRecordsService } from './call_records.service';

@Module({
  providers: [CallRecordsRepository, CallRecordsService],
  exports: [CallRecordsService],
})
export class CallRecordsModule {}
