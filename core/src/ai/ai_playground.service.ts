import { Injectable } from '@nestjs/common';

import { encodeWav } from '../audio/encode_wav.util';
import { AiService } from './ai.service';
import { TryChatDto, TryChatMessageDto } from './dto/try_chat.dto';
import { TrySpeechDto } from './dto/try_speech.dto';
import { TryTranscriptionDto } from './dto/try_transcription.dto';
import {
  ChatTrialResult,
  SpeechTrialResult,
  TranscriptionTrialResult,
} from './types/ai_playground_result.type';
import {
  ChatMessage,
  ChatToolCall,
  ChatToolDefinition,
} from './types/chat_request.type';
import { ChatUsage } from './types/chat_stream_event.type';

function mapTrialMessage(trial_message: TryChatMessageDto): ChatMessage {
  if (trial_message.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: trial_message.tool_call_id ?? '',
      name: trial_message.name ?? '',
      content: trial_message.content,
    };
  }
  if (trial_message.role === 'assistant') {
    return {
      role: 'assistant',
      content: trial_message.content,
      tool_calls: trial_message.tool_calls,
    };
  }
  return { role: trial_message.role, content: trial_message.content };
}

// The try-it endpoints: one request to one capability, timed, so the owner
// can audition models and voices without restarting core.
@Injectable()
export class AiPlaygroundService {
  constructor(private readonly ai_service: AiService) {}

  async tryChat(try_chat: TryChatDto): Promise<ChatTrialResult> {
    const started_at_ms = Date.now();
    let first_token_ms: number | null = null;
    let text = '';
    let finish_reason = 'stop';
    let usage: ChatUsage = {
      input_tokens: 0,
      output_tokens: 0,
      cached_input_tokens: 0,
    };
    const tool_calls: ChatToolCall[] = [];
    const chat_stream = this.ai_service.chat(
      {
        model: try_chat.model,
        messages: try_chat.messages.map(mapTrialMessage),
        tools: try_chat.tools as unknown as ChatToolDefinition[] | undefined,
      },
      { provider: try_chat.provider },
    );
    for await (const chat_event of chat_stream) {
      if (chat_event.type !== 'done' && first_token_ms === null) {
        first_token_ms = Date.now() - started_at_ms;
      }
      if (chat_event.type === 'text_delta') {
        text += chat_event.text;
      } else if (chat_event.type === 'tool_call') {
        tool_calls.push({
          tool_call_id: chat_event.tool_call_id,
          name: chat_event.name,
          arguments: chat_event.arguments,
        });
      } else {
        finish_reason = chat_event.finish_reason;
        usage = chat_event.usage;
      }
    }
    return {
      text: text.trim(),
      tool_calls,
      usage,
      finish_reason,
      latency_ms: Date.now() - started_at_ms,
      first_token_ms,
    };
  }

  async tryTranscription(
    audio: Buffer,
    try_transcription: TryTranscriptionDto,
  ): Promise<TranscriptionTrialResult> {
    const started_at_ms = Date.now();
    const transcription_result = await this.ai_service.transcribe(
      {
        audio,
        model: try_transcription.model,
        language: try_transcription.language,
      },
      { provider: try_transcription.provider },
    );
    return {
      text: transcription_result.text,
      duration_seconds:
        Math.round(transcription_result.duration_seconds * 100) / 100,
      latency_ms: Date.now() - started_at_ms,
      provider: transcription_result.provider,
      model: transcription_result.model,
    };
  }

  async trySpeech(try_speech: TrySpeechDto): Promise<SpeechTrialResult> {
    const started_at_ms = Date.now();
    const speech_result = await this.ai_service.synthesize(
      {
        text: try_speech.text,
        model: try_speech.model,
        voice: try_speech.voice,
        speed: try_speech.speed,
        instructions: try_speech.instructions,
      },
      { provider: try_speech.provider },
    );
    return {
      wav: encodeWav(speech_result.pcm, speech_result.sample_rate),
      latency_ms: Date.now() - started_at_ms,
      provider: speech_result.provider,
      model: speech_result.model,
      voice: speech_result.voice,
    };
  }
}
