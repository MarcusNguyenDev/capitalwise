import { Module } from '@nestjs/common';

import { EngineApiClient } from './engine_api.client';

@Module({
  providers: [EngineApiClient],
  exports: [EngineApiClient],
})
export class EngineApiModule {}
