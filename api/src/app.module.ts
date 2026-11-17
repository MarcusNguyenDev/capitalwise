import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ApprovalsModule } from './approvals/approvals.module';
import { AuditModule } from './audit/audit.module';
import { CallRecordsModule } from './call_records/call_records.module';
import { CasesModule } from './cases/cases.module';
import { CompareModule } from './compare/compare.module';
import { appConfig } from './config/app.config';
import { cacheConfig } from './config/cache.config';
import { databaseConfig } from './config/database.config';
import { CoreBankingModule } from './core_banking/core_banking.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { DemoModule } from './demo/demo.module';
import { ExecutionModule } from './execution/execution.module';
import { ExplainabilityModule } from './explainability/explainability.module';
import { FactsModule } from './facts/facts.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { IdentityRecordsModule } from './identity_records/identity_records.module';
import { LiveEventsModule } from './live_events/live_events.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PoliciesModule } from './policies/policies.module';
import { ResourcesModule } from './resources/resources.module';
import { RoutingModule } from './routing/routing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      load: [appConfig, databaseConfig, cacheConfig],
    }),
    DatabaseModule,
    LiveEventsModule,
    HealthModule,
    CallRecordsModule,
    IdentityRecordsModule,
    CoreBankingModule,
    PoliciesModule,
    FactsModule,
    RoutingModule,
    AuditModule,
    NotificationsModule,
    ExecutionModule,
    CasesModule,
    IdentityModule,
    ApprovalsModule,
    ExplainabilityModule,
    ResourcesModule,
    DashboardModule,
    CompareModule,
    DemoModule,
  ],
})
export class AppModule {}
