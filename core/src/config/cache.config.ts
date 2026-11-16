import { registerAs } from '@nestjs/config';

export const cacheConfig = registerAs('cache', () => ({
  host: process.env.CACHE_HOST ?? 'localhost',
  port: Number(process.env.CACHE_PORT ?? 6380),
  password: process.env.CACHE_PASSWORD ?? 'capitalwise_dev',
}));
