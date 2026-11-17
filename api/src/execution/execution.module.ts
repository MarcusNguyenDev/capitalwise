import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CoreBankingModule } from '../core_banking/core_banking.module';
import { CardActionsExecutor } from './card_actions.executor';
import { ExecutorService } from './executor.service';
import { ServicingActionsExecutor } from './servicing_actions.executor';

@Module({
  imports: [AuditModule, CoreBankingModule],
  providers: [CardActionsExecutor, ServicingActionsExecutor, ExecutorService],
  exports: [ExecutorService],
})
export class ExecutionModule {}
