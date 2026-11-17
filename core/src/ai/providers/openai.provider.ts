import { Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { resamplePcm } from '../../audio/resample_pcm.util';
import { aiConfig } from '../../config/ai.config';
import { AiCapability } from '../types/ai_capability.enum';
import { ResolvedChatRequest } from '../types/chat_request.type';
import { SpeechStream, SpeechSummary } from '../types/speech_stream.type';
import {
  ResolvedSpeechRequest,
  SpeechResult,
} from '../types/speech_synthesis.type';
import {
  ResolvedTranscriptionStreamRequest,
  TranscriptionStream,
} from '../types/transcription_stream.type';
import { OpenAiRealtimeReaderPool } from '../wire/openai_realtime.reader';
import {
  createWsRealtimeWebSocket,
  RealtimeWebSocketFactory,
} from '../wire/openai_realtime.socket';
import {
  OpenAiRealtimeTranscriptionStream,
  REALTIME_SAMPLE_RATE,
} from '../wire/openai_realtime_transcription.stream';
import { readPcmChunks } from '../wire/read_pcm_chunks.util';
import { OpenAiCompatibleProvider } from './openai_compatible.provider';

// DI token for the WebSocket factory (tests and the fake server swap it).
export const REALTIME_WEB_SOCKET_FACTORY = Symbol(
  'REALTIME_WEB_SOCKET_FACTORY',
);

// Realtime transcription models: streamed over a transcription session.
// Others (whisper-1) go through the file endpoint.
const REALTIME_TRANSCRIPTION_MODEL_PATTERN =
  /^(gpt-live-transcribe|gpt-realtime-whisper|gpt-transcribe|gpt-4o(-mini)?-transcribe)/;
// gpt-realtime… voices have no /audio/speech: they are driven as readers.
const REALTIME_SPEECH_MODEL_PATTERN = /^gpt-realtime/;

// OpenAI cloud: chat (Chat Completions), streaming transcription (Realtime
// transcription sessions), speech (a Realtime model used as a reader, or
// /audio/speech for the older dedicated TTS models), file transcription.
@Injectable()
export class OpenAiProvider
  extends OpenAiCompatibleProvider
  implements OnModuleDestroy
{
  readonly provider_name = 'openai' as const;
  readonly capabilities = [
    AiCapability.CHAT,
    AiCapability.TRANSCRIBE,
    AiCapability.SYNTHESIZE,
  ];
  readonly configuration_hint = 'OPENAI_API_KEY';
  // gpt-4o-mini-tts takes tone instructions.
  protected readonly supports_speech_instructions = true;

  private readonly reader_pool = new OpenAiRealtimeReaderPool();
  private readonly createWebSocket: RealtimeWebSocketFactory;

  constructor(
    @Inject(aiConfig.KEY) ai_config: ConfigType<typeof aiConfig>,
    @Optional()
    @Inject(REALTIME_WEB_SOCKET_FACTORY)
    create_web_socket?: RealtimeWebSocketFactory,
  ) {
    super(ai_config.providers.openai);
    this.createWebSocket = create_web_socket ?? createWsRealtimeWebSocket;
  }

  onModuleDestroy(): void {
    this.reader_pool.closeAll();
  }

  releaseSessions(session_key: string): void {
    this.reader_pool.closeSessions(session_key);
  }

  // The base URL has a default, so the key is what makes it usable.
  isConfigured(): boolean {
    return super.isConfigured() && this.connection.api_key.length > 0;
  }

  // Current OpenAI models take max_completion_tokens. reasoning_effort is sent
  // whenever it is configured, "none" included: GPT-6 models default to
  // "medium", and gpt-6-luna supports function calling in Chat Completions
  // only with "none". Leave AI_CHAT_REASONING_EFFORT empty for older
  // non-reasoning models (gpt-4o, gpt-4.1), which reject the parameter.
  protected buildChatBody(
    chat_request: ResolvedChatRequest,
  ): Record<string, unknown> {
    const { max_tokens, ...chat_body } = super.buildChatBody(chat_request);
    return {
      ...chat_body,
      max_completion_tokens: max_tokens,
      ...(chat_request.reasoning_effort
        ? { reasoning_effort: chat_request.reasoning_effort }
        : {}),
    };
  }

  openTranscriptionStream(
    stream_request: ResolvedTranscriptionStreamRequest,
  ): TranscriptionStream {
    if (!REALTIME_TRANSCRIPTION_MODEL_PATTERN.test(stream_request.model)) {
      return super.openTranscriptionStream(stream_request);
    }
    this.assertSupports(AiCapability.TRANSCRIBE, stream_request.model);
    const transcription_stream = new OpenAiRealtimeTranscriptionStream({
      provider_name: this.provider_name,
      base_url: this.resolveBaseUrl(stream_request.base_url),
      api_key: this.connection.api_key,
      model: stream_request.model,
      language: stream_request.language,
      prompt: stream_request.prompt,
      timeout_ms: stream_request.timeout_ms,
      createWebSocket: this.createWebSocket,
    });
    // Connect while the caller is still being greeted; failures surface on
    // the first commit.
    transcription_stream.connect().catch(() => undefined);
    return transcription_stream;
  }

  synthesizeStream(speech_request: ResolvedSpeechRequest): SpeechStream {
    this.assertSupports(AiCapability.SYNTHESIZE, speech_request.model);
    return REALTIME_SPEECH_MODEL_PATTERN.test(speech_request.model)
      ? this.readAloud(speech_request)
      : this.streamSpeechEndpoint(speech_request);
  }

  async synthesize(
    speech_request: ResolvedSpeechRequest,
  ): Promise<SpeechResult> {
    if (!REALTIME_SPEECH_MODEL_PATTERN.test(speech_request.model)) {
      return super.synthesize(speech_request);
    }
    const speech_stream = this.synthesizeStream(speech_request);
    const chunks: Int16Array[] = [];
    for await (const chunk of speech_stream) {
      chunks.push(chunk);
    }
    const summary = await speech_stream.summary;
    const pcm = new Int16Array(
      chunks.reduce((total, chunk) => total + chunk.length, 0),
    );
    let write_offset = 0;
    for (const chunk of chunks) {
      pcm.set(chunk, write_offset);
      write_offset += chunk.length;
    }
    return {
      pcm,
      sample_rate: speech_request.sample_rate ?? REALTIME_SAMPLE_RATE,
      provider: summary.provider,
      model: summary.model,
      voice: summary.voice,
    };
  }

  private readAloud(speech_request: ResolvedSpeechRequest): SpeechStream {
    const reader = this.reader_pool.acquire({
      provider_name: this.provider_name,
      base_url: this.resolveBaseUrl(speech_request.base_url),
      api_key: this.connection.api_key,
      model: speech_request.model,
      voice: speech_request.voice,
      speed: speech_request.speed,
      instructions: speech_request.instructions,
      timeout_ms: speech_request.timeout_ms,
      createWebSocket: this.createWebSocket,
      session_key: speech_request.session_key,
    });
    const speech_stream = reader.read({
      text: speech_request.text,
      sample_rate: speech_request.sample_rate,
      abort_signal: speech_request.abort_signal,
    });
    speech_stream.summary
      .catch(() => undefined)
      .finally(() => this.reader_pool.release(reader));
    return speech_stream;
  }

  // Dedicated TTS models (gpt-4o-mini-tts, tts-1: shut down 2027-01-06):
  // /audio/speech as raw 24 kHz PCM, streamed as it arrives.
  private streamSpeechEndpoint(
    speech_request: ResolvedSpeechRequest,
  ): SpeechStream {
    const response_promise = this.postSpeech(speech_request, {
      response_format: 'pcm',
    });
    const summary: Promise<SpeechSummary> = response_promise.then(() => ({
      provider: this.provider_name,
      model: speech_request.model,
      voice: speech_request.voice,
      requested_text: speech_request.text,
      spoken_transcript: null,
      is_drifted: false,
      usage: null,
    }));
    summary.catch(() => undefined);
    const target_sample_rate =
      speech_request.sample_rate ?? REALTIME_SAMPLE_RATE;
    return {
      summary,
      async *[Symbol.asyncIterator](): AsyncGenerator<Int16Array> {
        const response = await response_promise;
        for await (const chunk of readPcmChunks(
          response.body as ReadableStream<Uint8Array>,
        )) {
          yield resamplePcm(chunk, REALTIME_SAMPLE_RATE, target_sample_rate);
        }
      },
    };
  }
}
