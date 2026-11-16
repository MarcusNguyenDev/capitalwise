import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { voiceConfig } from '../config/voice.config';
import { VoiceSessionMintFailedError } from './errors/voice_session_mint_failed.error';
import {
  RealtimeClientSecret,
  RealtimeClientSecretRequest,
} from './types/realtime_session.type';

const CLIENT_SECRETS_PATH = '/realtime/client_secrets';
const MINT_TIMEOUT_MS = 15_000;

// The only code that holds the OpenAI API key. The browser only ever sees the
// short-lived client secret this returns.
@Injectable()
export class OpenAiRealtimeClient {
  constructor(
    @Inject(voiceConfig.KEY)
    private readonly voice_config: ConfigType<typeof voiceConfig>,
  ) {}

  async createClientSecret(
    client_secret_request: RealtimeClientSecretRequest,
  ): Promise<RealtimeClientSecret> {
    const response = await this.postClientSecretRequest(client_secret_request);
    const response_body = (await response.json().catch(() => null)) as {
      value?: unknown;
      expires_at?: unknown;
      error?: { message?: string };
    } | null;
    if (!response.ok) {
      throw new VoiceSessionMintFailedError(
        response_body?.error?.message ?? `HTTP ${response.status}`,
      );
    }
    if (
      typeof response_body?.value !== 'string' ||
      typeof response_body.expires_at !== 'number'
    ) {
      throw new VoiceSessionMintFailedError(
        'the response had no client secret',
      );
    }
    return { value: response_body.value, expires_at: response_body.expires_at };
  }

  private async postClientSecretRequest(
    client_secret_request: RealtimeClientSecretRequest,
  ): Promise<Response> {
    try {
      return await fetch(
        `${this.voice_config.openai_base_url}${CLIENT_SECRETS_PATH}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.voice_config.openai_api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(client_secret_request),
          signal: AbortSignal.timeout(MINT_TIMEOUT_MS),
        },
      );
    } catch (error) {
      throw new VoiceSessionMintFailedError((error as Error).message);
    }
  }
}
