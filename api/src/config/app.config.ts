import { registerAs } from '@nestjs/config';

const DEFAULT_API_PORT = 3002;

export const appConfig = registerAs('app', () => ({
  // PORT is what the container sets; API_PORT is the local override.
  port: Number(process.env.PORT ?? process.env.API_PORT ?? DEFAULT_API_PORT),
  bank_name: process.env.BANK_NAME ?? 'Demo Bank',
  is_demo_mode: (process.env.DEMO_MODE ?? 'true').toLowerCase() === 'true',
  db_sql_dir: process.env.DB_SQL_DIR ?? '../db',
  compare_journey_path:
    process.env.COMPARE_JOURNEY_PATH ?? 'config/compare_journey.json',
}));
