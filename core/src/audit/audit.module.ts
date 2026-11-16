import { Module } from '@nestjs/common';

import { AuditEventsRepository } from './audit_events.repository';

@Module({
  providers: [AuditEventsRepository],
  exports: [AuditEventsRepository],
})
export class AuditModule {}
