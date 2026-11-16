import { Module } from '@nestjs/common';

import { CompareController } from './compare.controller';
import { CompareRepository } from './compare.repository';
import { CompareService } from './compare.service';

@Module({
  controllers: [CompareController],
  providers: [CompareRepository, CompareService],
})
export class CompareModule {}
