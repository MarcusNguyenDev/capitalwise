import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CoreBankingModule } from '../core_banking/core_banking.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [AuditModule, CoreBankingModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
