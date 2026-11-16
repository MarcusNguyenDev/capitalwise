import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CoreBankingModule } from '../core_banking/core_banking.module';
import { ExecutorService } from './executor.service';

@Module({
  imports: [AuditModule, CoreBankingModule],
  providers: [ExecutorService],
  exports: [ExecutorService],
})
export class ExecutionModule {}
