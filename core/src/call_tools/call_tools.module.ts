import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CallsModule } from '../calls/calls.module';
import { EngineApiModule } from '../engine_api/engine_api.module';
import { LiveModule } from '../live/live.module';
import { CallToolsController } from './call_tools.controller';
import { CallToolsService } from './call_tools.service';
import { ActionToolsHandler } from './handlers/action_tools.handler';
import { BankingLookupToolsHandler } from './handlers/banking_lookup_tools.handler';
import { CallInsightToolsHandler } from './handlers/call_insight_tools.handler';
import { CallerIdentityToolsHandler } from './handlers/caller_identity_tools.handler';
import { IdentityPushWaiter } from './identity_push_waiter.service';
import { NotificationStatusesRepository } from './notification_statuses.repository';

@Module({
  imports: [AuditModule, CallsModule, EngineApiModule, LiveModule],
  controllers: [CallToolsController],
  providers: [
    CallToolsService,
    CallerIdentityToolsHandler,
    BankingLookupToolsHandler,
    ActionToolsHandler,
    CallInsightToolsHandler,
    IdentityPushWaiter,
    NotificationStatusesRepository,
  ],
  exports: [CallToolsService],
})
export class CallToolsModule {}
