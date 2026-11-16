import { Module } from '@nestjs/common';

import { AuditController } from './audit.controller';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import { AuditRecorderService } from './audit_recorder.service';

@Module({
  controllers: [AuditController],
  providers: [AuditRepository, AuditService, AuditRecorderService],
  exports: [AuditService, AuditRecorderService],
})
export class AuditModule {}
