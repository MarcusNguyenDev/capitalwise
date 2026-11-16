import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';

import { cacheConfig } from '../config/cache.config';
import {
  LIVE_EVENT,
  LIVE_EVENTS_CHANNEL,
} from './constants/live_event_names.constant';
import { LiveBroadcaster } from './live_broadcaster.service';
import { LiveEventBus } from './live_event_bus.service';
import { LiveEventMessage } from './types/live_event_message.type';

// Relays what the api service publishes on Redis to socket.io rooms and to the
// internal event bus.
@Injectable()
export class RedisLiveEventsSubscriber
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisLiveEventsSubscriber.name);
  private redis_subscriber: Redis;

  constructor(
    @Inject(cacheConfig.KEY)
    private readonly cache_config: ConfigType<typeof cacheConfig>,
    private readonly live_broadcaster: LiveBroadcaster,
    private readonly live_event_bus: LiveEventBus,
  ) {}

  onModuleInit(): void {
    this.redis_subscriber = new Redis({
      host: this.cache_config.host,
      port: this.cache_config.port,
      password: this.cache_config.password,
      // Keep retrying forever: the demo must survive a Redis restart.
      maxRetriesPerRequest: null,
      retryStrategy: (attempt_count) => Math.min(attempt_count * 200, 2000),
    });
    this.redis_subscriber.on('error', (error) => {
      this.logger.warn(`Redis subscriber error: ${error.message}`);
    });
    this.redis_subscriber.on('message', (_channel, raw_message) => {
      this.relayMessage(raw_message);
    });
    this.redis_subscriber
      .subscribe(LIVE_EVENTS_CHANNEL)
      .then(() => this.logger.log(`Subscribed to ${LIVE_EVENTS_CHANNEL}`))
      .catch((error: Error) =>
        this.logger.error(`Redis subscribe failed: ${error.message}`),
      );
  }

  onModuleDestroy(): void {
    this.redis_subscriber.disconnect();
  }

  relayMessage(raw_message: string): void {
    const live_event_message = this.parseMessage(raw_message);
    if (!live_event_message) {
      return;
    }
    const { event, payload, rooms } = live_event_message;
    if (event === LIVE_EVENT.DEMO_RESET) {
      this.live_broadcaster.emitToEveryone(event, payload);
    } else {
      this.live_broadcaster.emitToRooms(event, payload, rooms);
    }
    this.live_event_bus.publish(event, payload);
  }

  private parseMessage(raw_message: string): LiveEventMessage | null {
    try {
      const parsed_message = JSON.parse(
        raw_message,
      ) as Partial<LiveEventMessage>;
      if (typeof parsed_message.event !== 'string') {
        return null;
      }
      return {
        event: parsed_message.event,
        payload: parsed_message.payload ?? {},
        rooms: Array.isArray(parsed_message.rooms) ? parsed_message.rooms : [],
      };
    } catch {
      this.logger.warn('Ignored a live event that was not valid JSON');
      return null;
    }
  }
}
