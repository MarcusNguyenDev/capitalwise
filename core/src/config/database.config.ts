import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5433),
  user: process.env.DB_USER ?? 'capitalwise',
  password: process.env.DB_PASSWORD ?? 'capitalwise_dev',
  name: process.env.DB_NAME ?? 'capitalwise',
}));
