import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

import { AiService } from './ai.service';
import { AiPlaygroundService } from './ai_playground.service';
import { TryChatDto } from './dto/try_chat.dto';
import { TrySpeechDto } from './dto/try_speech.dto';
import { TryTranscriptionDto } from './dto/try_transcription.dto';
import { AudioFileRequiredError } from './errors/audio_file_required.error';
import {
  ChatTrialResult,
  TranscriptionTrialResult,
} from './types/ai_playground_result.type';
import { AiStatus } from './types/ai_status.type';

const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024;

// Try-it endpoints for auditioning providers, models and voices.
@Controller('ai')
export class AiController {
  constructor(
    private readonly ai_service: AiService,
    private readonly ai_playground_service: AiPlaygroundService,
  ) {}

  @Get('status')
  getStatus(): Promise<AiStatus> {
    return this.ai_service.getStatus();
  }

  @Get('providers/:provider_name/models')
  async listModels(
    @Param('provider_name') provider_name: string,
  ): Promise<{ models: string[] }> {
    return { models: await this.ai_service.listModels(provider_name) };
  }

  @Post('chat')
  @HttpCode(200)
  tryChat(@Body() try_chat: TryChatDto): Promise<ChatTrialResult> {
    return this.ai_playground_service.tryChat(try_chat);
  }

  @Post('transcriptions')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_AUDIO_UPLOAD_BYTES } }),
  )
  tryTranscription(
    @UploadedFile() audio_file: Express.Multer.File | undefined,
    @Body() try_transcription: TryTranscriptionDto,
  ): Promise<TranscriptionTrialResult> {
    if (!audio_file) {
      throw new AudioFileRequiredError();
    }
    return this.ai_playground_service.tryTranscription(
      audio_file.buffer,
      try_transcription,
    );
  }

  @Post('speech')
  @HttpCode(200)
  async trySpeech(
    @Body() try_speech: TrySpeechDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const speech_trial = await this.ai_playground_service.trySpeech(try_speech);
    response.set({
      'Content-Type': 'audio/wav',
      'x-latency-ms': String(speech_trial.latency_ms),
      'x-provider': speech_trial.provider,
      'x-model': speech_trial.model,
      'x-voice': speech_trial.voice,
      'Access-Control-Expose-Headers':
        'x-latency-ms, x-provider, x-model, x-voice',
    });
    return new StreamableFile(speech_trial.wav);
  }
}
