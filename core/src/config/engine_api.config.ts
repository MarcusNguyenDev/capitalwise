import { registerAs } from '@nestjs/config';

export const engineApiConfig = registerAs('engine_api', () => ({
  base_url: (process.env.API_INTERNAL_URL ?? 'http://localhost:3002').replace(
    /\/+$/,
    '',
  ),
  request_timeout_ms: Number(process.env.API_REQUEST_TIMEOUT_MS ?? 10000),
}));
