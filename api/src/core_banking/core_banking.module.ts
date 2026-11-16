import { Module } from '@nestjs/common';

import { BankingController } from './banking.controller';
import { CoreBankingAdapter } from './core_banking.adapter';
import { CoreBankingRepository } from './core_banking.repository';

@Module({
  controllers: [BankingController],
  providers: [CoreBankingRepository, CoreBankingAdapter],
  exports: [CoreBankingAdapter],
})
export class CoreBankingModule {}
