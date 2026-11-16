import { registerAs } from '@nestjs/config';

function readText(env_key: string, default_value = ''): string {
  return (process.env[env_key] ?? default_value).trim().replace(/\/+$/, '');
}

// The LiveKit server `media`. `url` is how core reaches it; `public_url` is
// what browsers use (empty: the browser falls back to ws://<page host>:7880).
export const livekitConfig = registerAs('livekit', () => ({
  url: readText('LIVEKIT_URL', 'ws://localhost:7880'),
  public_url: readText('LIVEKIT_PUBLIC_URL'),
  api_key: readText('LIVEKIT_API_KEY'),
  api_secret: readText('LIVEKIT_API_SECRET'),
  health_check_timeout_ms: Number(
    process.env.LIVEKIT_HEALTH_CHECK_TIMEOUT_MS ?? 2_000,
  ),
}));

export type LivekitConfig = ReturnType<typeof livekitConfig>;
