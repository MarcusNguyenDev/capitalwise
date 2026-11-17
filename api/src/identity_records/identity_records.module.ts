import { Module } from '@nestjs/common';

import { CallRecordsModule } from '../call_records/call_records.module';
import { IdentityRecordsRepository } from './identity_records.repository';
import { IdentityRecordsService } from './identity_records.service';

@Module({
  imports: [CallRecordsModule],
  providers: [IdentityRecordsRepository, IdentityRecordsService],
  exports: [IdentityRecordsRepository, IdentityRecordsService],
})
export class IdentityRecordsModule {}
