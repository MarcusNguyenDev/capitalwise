import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { listRealtimeToolDefinitions } from '../call_tools/constants/tool_definitions.constant';
import { CallsService } from '../calls/calls.service';
import { voiceConfig } from '../config/voice.config';
import { PromptsService } from '../prompts/prompts.service';
import { buildRealtimeSessionPayload } from './build_realtime_session_payload.util';
import { LiveVoiceUnavailableError } from './errors/live_voice_unavailable.error';
import { OpenAiRealtimeClient } from './openai_realtime.client';
import { VoiceSession, VoiceStatus } from './types/realtime_session.type';

const MILLISECONDS_PER_SECOND = 1000;

@Injectable()
export class VoiceService {
  constructor(
    @Inject(voiceConfig.KEY)
    private readonly voice_config: ConfigType<typeof voiceConfig>,
    private readonly calls_service: CallsService,
    private readonly prompts_service: PromptsService,
    private readonly openai_realtime_client: OpenAiRealtimeClient,
  ) {}

  getStatus(): VoiceStatus {
    return {
      is_live_available: this.voice_config.openai_api_key.length > 0,
      model: this.voice_config.realtime_model,
      voice: this.voice_config.realtime_voice,
    };
  }

  async createSession(call_id: string): Promise<VoiceSession> {
    if (!this.getStatus().is_live_available) {
      throw new LiveVoiceUnavailableError();
    }
    await this.calls_service.getActiveCall(call_id);
    const { instructions } =
      await this.prompts_service.getVoiceAgentInstructions();
    const tools = listRealtimeToolDefinitions();
    const client_secret = await this.openai_realtime_client.createClientSecret(
      buildRealtimeSessionPayload({
        model: this.voice_config.realtime_model,
        voice: this.voice_config.realtime_voice,
        transcription_model: this.voice_config.transcription_model,
        instructions,
        tools,
      }),
    );
    return {
      client_secret: client_secret.value,
      expires_at: new Date(
        client_secret.expires_at * MILLISECONDS_PER_SECOND,
      ).toISOString(),
      model: this.voice_config.realtime_model,
      voice: this.voice_config.realtime_voice,
      instructions,
      tools,
    };
  }
}
