import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CasesModule } from '../cases/cases.module';
import { ExplainabilityController } from './explainability.controller';
import { ExplainabilityRepository } from './explainability.repository';
import { ExplainabilityService } from './explainability.service';

@Module({
  imports: [AuditModule, CasesModule],
  controllers: [ExplainabilityController],
  providers: [ExplainabilityRepository, ExplainabilityService],
})
export class ExplainabilityModule {}
