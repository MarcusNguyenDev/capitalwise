import { registerAs } from '@nestjs/config';

const DEFAULT_DB_PORT = 5433;

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? DEFAULT_DB_PORT),
  user: process.env.DB_USER ?? 'capitalwise',
  password: process.env.DB_PASSWORD ?? 'capitalwise_dev',
  database_name: process.env.DB_NAME ?? 'capitalwise',
}));
