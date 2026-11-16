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
import { LIVE_EVENTS_CHANNEL } from './constants/live_events_channel.constant';
import { LiveEvent } from './types/live_event.type';

const MAX_RECONNECT_DELAY_MS = 3000;
const RECONNECT_STEP_MS = 250;

@Injectable()
export class LiveEventsPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LiveEventsPublisher.name);
  private redis_client: Redis;

  constructor(
    @Inject(cacheConfig.KEY)
    private readonly cache_settings: ConfigType<typeof cacheConfig>,
  ) {}

  onModuleInit(): void {
    this.redis_client = new Redis({
      host: this.cache_settings.host,
      port: this.cache_settings.port,
      password: this.cache_settings.password,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt_count) =>
        Math.min(attempt_count * RECONNECT_STEP_MS, MAX_RECONNECT_DELAY_MS),
    });
    this.redis_client.on('error', (error) =>
      this.logger.warn({
        message: 'Redis connection problem',
        error_message: error.message,
      }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.redis_client.disconnect();
  }

  // A live update must never fail the request that caused it: the database
  // is the system of record and the dashboards can refetch.
  async publish(live_event: LiveEvent): Promise<void> {
    try {
      await this.redis_client.publish(
        LIVE_EVENTS_CHANNEL,
        JSON.stringify(live_event),
      );
    } catch (error) {
      this.logger.warn({
        message: 'Live event was not published',
        event: live_event.event,
        error_message: (error as Error).message,
      });
    }
  }
}
