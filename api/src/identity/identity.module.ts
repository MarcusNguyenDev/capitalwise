import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CallRecordsModule } from '../call_records/call_records.module';
import { CasesModule } from '../cases/cases.module';
import { CoreBankingModule } from '../core_banking/core_banking.module';
import { IdentityRecordsModule } from '../identity_records/identity_records.module';
import { PoliciesModule } from '../policies/policies.module';
import { IdentityAnswerCheckerService } from './identity_answer_checker.service';
import { IdentityAnswersService } from './identity_answers.service';
import { IdentityChallengesService } from './identity_challenges.service';
import { IdentityController } from './identity.controller';
import { IdentityLockoutService } from './identity_lockout.service';

@Module({
  imports: [
    AuditModule,
    CallRecordsModule,
    CasesModule,
    CoreBankingModule,
    IdentityRecordsModule,
    PoliciesModule,
  ],
  controllers: [IdentityController],
  providers: [
    IdentityAnswerCheckerService,
    IdentityChallengesService,
    IdentityAnswersService,
    IdentityLockoutService,
  ],
})
export class IdentityModule {}
