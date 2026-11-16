import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PoliciesModule } from '../policies/policies.module';
import { RoutingModule } from '../routing/routing.module';
import { AutonomyService } from './autonomy.service';
import { ResourcesController } from './resources.controller';
import { ResourcesRepository } from './resources.repository';
import { WorkforceService } from './workforce.service';

@Module({
  imports: [AuditModule, PoliciesModule, RoutingModule],
  controllers: [ResourcesController],
  providers: [ResourcesRepository, WorkforceService, AutonomyService],
})
export class ResourcesModule {}
