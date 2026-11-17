import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: Number(process.env.CORE_PORT ?? process.env.PORT ?? 3001),
  bank_name: process.env.BANK_NAME ?? 'Demo Bank',
  // The bank's local time zone, used to tell the model today's date.
  bank_time_zone: process.env.BANK_TIME_ZONE ?? 'Australia/Brisbane',
}));
