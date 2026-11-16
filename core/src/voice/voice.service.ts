import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { AiService } from '../ai/ai.service';
import { CapabilityStatus } from '../ai/types/ai_status.type';
import { CallsService } from '../calls/calls.service';
import { CallRow } from '../calls/types/call_row.type';
import { aiConfig } from '../config/ai.config';
import { StaffNotFoundError } from '../interventions/errors/staff_not_found.error';
import { StaffUsersRepository } from '../interventions/staff_users.repository';
import {
  buildCallRoomName,
  buildStaffIdentity,
  CUSTOMER_IDENTITY,
} from '../livekit/constants/call_room.constant';
import { MediaUnavailableError } from '../livekit/errors/media_unavailable.error';
import { LivekitRoomsService } from '../livekit/livekit_rooms.service';
import { LivekitTokensService } from '../livekit/livekit_tokens.service';
import { VoiceAgentSessionManager } from '../voice_agent/voice_agent_session.manager';
import { CreateStaffVoiceTokenDto } from './dto/create_staff_voice_token.dto';
import { LiveVoiceUnavailableError } from './errors/live_voice_unavailable.error';
import { StaffCannotPublishError } from './errors/staff_cannot_publish.error';
import { VoiceModelStatus, VoiceStatus } from './types/voice_status.type';
import { VoiceRoomAccess } from './types/voice_room_access.type';

const UNKNOWN_CALLER_NAME = 'Caller';

function toModelStatus(capability_status: CapabilityStatus): VoiceModelStatus {
  return {
    provider: capability_status.provider,
    model: capability_status.model,
    is_reachable: capability_status.is_reachable,
    detail: capability_status.detail,
  };
}

// Live voice availability and LiveKit room access for phones and dashboards.
@Injectable()
export class VoiceService {
  constructor(
    private readonly ai_service: AiService,
    private readonly calls_service: CallsService,
    private readonly staff_users_repository: StaffUsersRepository,
    private readonly livekit_tokens_service: LivekitTokensService,
    private readonly livekit_rooms_service: LivekitRoomsService,
    private readonly voice_agent_session_manager: VoiceAgentSessionManager,
    @Inject(aiConfig.KEY)
    private readonly ai_config: ConfigType<typeof aiConfig>,
  ) {}

  // Live needs LiveKit and the chat, speech-to-text and text-to-speech
  // providers all configured and reachable (each probe is cached ~15 s).
  async getStatus(): Promise<VoiceStatus> {
    const [ai_status, media_availability] = await Promise.all([
      this.ai_service.getStatus(),
      this.livekit_rooms_service.checkAvailability(),
    ]);
    const { chat, transcribe, synthesize } = ai_status.capabilities;
    const unavailable_reason =
      media_availability.unavailable_reason ??
      [chat, transcribe, synthesize].find(
        (capability_status) => !capability_status.is_reachable,
      )?.detail ??
      null;
    return {
      is_live_available: unavailable_reason === null,
      unavailable_reason,
      livekit_url: this.livekit_rooms_service.readBrowserUrl(),
      is_media_available: media_availability.is_available,
      language_model: toModelStatus(chat),
      speech_to_text: toModelStatus(transcribe),
      text_to_speech: {
        ...toModelStatus(synthesize),
        ai_voice: this.ai_config.synthesize.ai_voice,
        staff_voice: this.ai_config.synthesize.staff_voice,
      },
    };
  }

  // The phone's token. For a LIVE call it also starts the call's voice agent.
  async createCustomerSession(call_id: string): Promise<VoiceRoomAccess> {
    const call = await this.calls_service.getActiveCall(call_id);
    const is_live_call = call.metrics.mode === 'LIVE';
    if (is_live_call) {
      await this.assertLiveAvailable();
    } else {
      await this.assertMediaAvailable();
    }
    const room_access = await this.buildRoomAccess(call, {
      identity: CUSTOMER_IDENTITY,
      display_name: call.customer_name ?? UNKNOWN_CALLER_NAME,
      can_publish: true,
    });
    if (is_live_call) {
      await this.voice_agent_session_manager.startSession(call);
    }
    return room_access;
  }

  // Listen-in for any staff member; talking only after their own takeover.
  async createStaffToken(
    create_staff_voice_token: CreateStaffVoiceTokenDto,
  ): Promise<VoiceRoomAccess> {
    const { call_id, staff_id, can_publish } = create_staff_voice_token;
    const call = await this.calls_service.getActiveCall(call_id);
    const staff_user = await this.staff_users_repository.findById(staff_id);
    if (!staff_user) {
      throw new StaffNotFoundError(staff_id);
    }
    const is_talk_allowed =
      call.status === 'HUMAN_ACTIVE' && call.assigned_staff_id === staff_id;
    if (can_publish && !is_talk_allowed) {
      throw new StaffCannotPublishError(call_id, staff_id);
    }
    await this.assertMediaAvailable();
    return this.buildRoomAccess(call, {
      identity: buildStaffIdentity(staff_id),
      display_name: staff_user.name,
      can_publish,
    });
  }

  private async buildRoomAccess(
    call: CallRow,
    participant: {
      identity: string;
      display_name: string;
      can_publish: boolean;
    },
  ): Promise<VoiceRoomAccess> {
    const room_name = buildCallRoomName(call.call_id);
    const token = await this.livekit_tokens_service.mintToken({
      room_name,
      ...participant,
    });
    return {
      room_name,
      livekit_url: this.livekit_rooms_service.readBrowserUrl(),
      token,
      identity: participant.identity,
    };
  }

  private async assertLiveAvailable(): Promise<void> {
    const voice_status = await this.getStatus();
    if (!voice_status.is_live_available) {
      throw new LiveVoiceUnavailableError(
        voice_status.unavailable_reason ?? 'unknown reason.',
      );
    }
  }

  private async assertMediaAvailable(): Promise<void> {
    const media_availability =
      await this.livekit_rooms_service.checkAvailability();
    if (!media_availability.is_available) {
      throw new MediaUnavailableError(
        media_availability.unavailable_reason ?? 'unknown reason.',
      );
    }
  }
}
