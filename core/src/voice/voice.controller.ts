import { Body, Controller, Get, Header, Post } from '@nestjs/common';

import { CreateVoiceSessionDto } from './dto/create_voice_session.dto';
import { VoiceSession, VoiceStatus } from './types/realtime_session.type';
import { VoiceService } from './voice.service';

@Controller('voice')
export class VoiceController {
  constructor(private readonly voice_service: VoiceService) {}

  @Get('status')
  getStatus(): VoiceStatus {
    return this.voice_service.getStatus();
  }

  @Post('sessions')
  @Header('Cache-Control', 'no-store')
  createSession(
    @Body() create_voice_session: CreateVoiceSessionDto,
  ): Promise<VoiceSession> {
    return this.voice_service.createSession(create_voice_session.call_id);
  }
}
