import { Module } from '@nestjs/common';

import { LiveGateway } from './live.gateway';
import { LiveBroadcaster } from './live_broadcaster.service';
import { LiveEventBus } from './live_event_bus.service';
import { RedisLiveEventsSubscriber } from './redis_live_events.subscriber';

@Module({
  providers: [
    LiveGateway,
    LiveBroadcaster,
    LiveEventBus,
    RedisLiveEventsSubscriber,
  ],
  exports: [LiveBroadcaster, LiveEventBus],
})
export class LiveModule {}
