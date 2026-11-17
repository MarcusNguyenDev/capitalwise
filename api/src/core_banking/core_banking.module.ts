import { Module } from '@nestjs/common';

import { IdentityRecordsModule } from '../identity_records/identity_records.module';
import { BankingController } from './banking.controller';
import { CardServicingAdapter } from './card_servicing.adapter';
import { CardServicingRepository } from './card_servicing.repository';
import { CoreBankingAdapter } from './core_banking.adapter';
import { CoreBankingRepository } from './core_banking.repository';
import { CustomerServicingAdapter } from './customer_servicing.adapter';
import { CustomerServicingRepository } from './customer_servicing.repository';
import { IdentityKnowledgeAdapter } from './identity_knowledge.adapter';
import { IdentityKnowledgeRepository } from './identity_knowledge.repository';

// The seam to the bank's systems: nothing outside this module touches schema
// `bank`. A real core banking API would plug in behind these adapters.
@Module({
  imports: [IdentityRecordsModule],
  controllers: [BankingController],
  providers: [
    CoreBankingRepository,
    CardServicingRepository,
    CustomerServicingRepository,
    IdentityKnowledgeRepository,
    CoreBankingAdapter,
    CardServicingAdapter,
    CustomerServicingAdapter,
    IdentityKnowledgeAdapter,
  ],
  exports: [
    CoreBankingAdapter,
    CardServicingAdapter,
    CustomerServicingAdapter,
    IdentityKnowledgeAdapter,
  ],
})
export class CoreBankingModule {}
