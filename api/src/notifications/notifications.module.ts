import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CallRecordsModule } from '../call_records/call_records.module';
import { CoreBankingModule } from '../core_banking/core_banking.module';
import { IdentityRecordsModule } from '../identity_records/identity_records.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { NotifierService } from './notifier.service';

@Module({
  imports: [
    AuditModule,
    CallRecordsModule,
    CoreBankingModule,
    IdentityRecordsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsRepository, NotifierService, NotificationsService],
  exports: [NotifierService, NotificationsService],
})
export class NotificationsModule {}
