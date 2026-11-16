import { Module } from '@nestjs/common';

import { CoreBankingModule } from '../core_banking/core_banking.module';
import { FactBuilderService } from './fact_builder.service';

@Module({
  imports: [CoreBankingModule],
  providers: [FactBuilderService],
  exports: [FactBuilderService],
})
export class FactsModule {}
