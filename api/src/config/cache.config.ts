import { registerAs } from '@nestjs/config';

const DEFAULT_CACHE_PORT = 6380;

export const cacheConfig = registerAs('cache', () => ({
  host: process.env.CACHE_HOST ?? 'localhost',
  port: Number(process.env.CACHE_PORT ?? DEFAULT_CACHE_PORT),
  password: process.env.CACHE_PASSWORD ?? 'capitalwise_dev',
}));
