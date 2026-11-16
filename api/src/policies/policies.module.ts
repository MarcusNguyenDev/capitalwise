import { Module } from '@nestjs/common';

import { PoliciesRepository } from './policies.repository';
import { PoliciesService } from './policies.service';

@Module({
  providers: [PoliciesRepository, PoliciesService],
  exports: [PoliciesService],
})
export class PoliciesModule {}
