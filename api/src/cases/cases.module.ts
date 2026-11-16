import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CallRecordsModule } from '../call_records/call_records.module';
import { CoreBankingModule } from '../core_banking/core_banking.module';
import { ExecutionModule } from '../execution/execution.module';
import { FactsModule } from '../facts/facts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PoliciesModule } from '../policies/policies.module';
import { RoutingModule } from '../routing/routing.module';
import { ActionsController } from './actions.controller';
import { CaseBuilderService } from './case_builder.service';
import { CaseEventsPublisher } from './case_events.publisher';
import { CaseIntakeService } from './case_intake.service';
import { CasesController } from './cases.controller';
import { CasesRepository } from './cases.repository';
import { CasesService } from './cases.service';
import { ConcernsService } from './concerns.service';
import { DecisionsService } from './decisions.service';
import { ProposalResultFactory } from './proposal_result.factory';
import { ProposalsService } from './proposals.service';

@Module({
  imports: [
    AuditModule,
    CallRecordsModule,
    CoreBankingModule,
    ExecutionModule,
    FactsModule,
    NotificationsModule,
    PoliciesModule,
    RoutingModule,
  ],
  controllers: [ActionsController, CasesController],
  providers: [
    CasesRepository,
    CaseEventsPublisher,
    CaseBuilderService,
    ProposalResultFactory,
    CaseIntakeService,
    ProposalsService,
    ConcernsService,
    DecisionsService,
    CasesService,
  ],
  exports: [CasesRepository, CasesService, DecisionsService],
})
export class CasesModule {}
