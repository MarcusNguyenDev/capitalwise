import { Global, Module } from '@nestjs/common';

import { LiveEventsPublisher } from './live_events.publisher';

@Global()
@Module({
  providers: [LiveEventsPublisher],
  exports: [LiveEventsPublisher],
})
export class LiveEventsModule {}
