import { Module } from '@nestjs/common';

import { CasesModule } from '../cases/cases.module';
import { RoutingModule } from '../routing/routing.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  imports: [CasesModule, RoutingModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}
