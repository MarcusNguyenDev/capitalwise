import { Body, Controller, Get, Header, Post } from '@nestjs/common';

import { CreateStaffVoiceTokenDto } from './dto/create_staff_voice_token.dto';
import { CreateVoiceSessionDto } from './dto/create_voice_session.dto';
import { VoiceRoomAccess } from './types/voice_room_access.type';
import { VoiceStatus } from './types/voice_status.type';
import { VoiceService } from './voice.service';

@Controller('voice')
export class VoiceController {
  constructor(private readonly voice_service: VoiceService) {}

  @Get('status')
  getStatus(): Promise<VoiceStatus> {
    return this.voice_service.getStatus();
  }

  @Post('sessions')
  @Header('Cache-Control', 'no-store')
  createSession(
    @Body() create_voice_session: CreateVoiceSessionDto,
  ): Promise<VoiceRoomAccess> {
    return this.voice_service.createCustomerSession(
      create_voice_session.call_id,
    );
  }

  @Post('staff_tokens')
  @Header('Cache-Control', 'no-store')
  createStaffToken(
    @Body() create_staff_voice_token: CreateStaffVoiceTokenDto,
  ): Promise<VoiceRoomAccess> {
    return this.voice_service.createStaffToken(create_staff_voice_token);
  }
}
