import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: Number(process.env.CORE_PORT ?? process.env.PORT ?? 3001),
  bank_name: process.env.BANK_NAME ?? 'Demo Bank',
}));
