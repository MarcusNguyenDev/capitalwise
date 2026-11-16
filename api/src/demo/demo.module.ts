import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [AuditModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
