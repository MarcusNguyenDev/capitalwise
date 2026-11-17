import { Module } from '@nestjs/common';

import { CoreBankingModule } from '../core_banking/core_banking.module';
import { CardFactsBuilder } from './builders/card_facts.builder';
import { DisputeFactsBuilder } from './builders/dispute_facts.builder';
import { ServicingFactsBuilder } from './builders/servicing_facts.builder';
import { FactBuilderService } from './fact_builder.service';

@Module({
  imports: [CoreBankingModule],
  providers: [
    CardFactsBuilder,
    DisputeFactsBuilder,
    ServicingFactsBuilder,
    FactBuilderService,
  ],
  exports: [FactBuilderService],
})
export class FactsModule {}
