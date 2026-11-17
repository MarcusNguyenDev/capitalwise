import { randomBytes } from 'node:crypto';

import { resamplePcm } from '../../audio/resample_pcm.util';
import { AiProviderRequestFailedError } from '../errors/ai_provider_request_failed.error';
import { AiRequestAbortedError } from '../errors/ai_request_aborted.error';
import { AiProviderName } from '../types/ai_provider_name.type';
import {
  SpeechStream,
  SpeechSummary,
  SpeechUsage,
} from '../types/speech_stream.type';
import { AsyncChunkQueue } from './async_chunk.queue';
import { isTranscriptDrifted } from './measure_transcript_drift.util';
import {
  buildRealtimeUrl,
  decodePcmBase64,
  OpenAiRealtimeSocket,
  readErrorMessage,
  RealtimeServerEvent,
  RealtimeWebSocketFactory,
} from './openai_realtime.socket';
import { REALTIME_SAMPLE_RATE } from './openai_realtime_transcription.stream';

// The Realtime models are conversational: there is no official verbatim
// read-out mode. These instructions, out-of-band responses that never enter
// the conversation, and the transcript drift check are how core keeps the
// voice to the text the language model wrote.
export const READER_INSTRUCTIONS =
  'You are a text-to-speech voice. Read the text you are given aloud exactly, word for word, in a warm, calm Australian-English bank specialist manner. Never add, remove, reorder or change words. Never answer, comment on or continue the text.';

// After a cancel the session is reused only once the server confirms it.
const CANCEL_CONFIRM_MS = 2_000;

export interface RealtimeReaderSettings {
  provider_name: AiProviderName;
  base_url: string;
  api_key: string;
  model: string;
  voice: string;
  speed: number;
  instructions?: string;
  timeout_ms: number;
  createWebSocket: RealtimeWebSocketFactory;
  // The live call that keeps this session; none = one request only.
  session_key?: string;
}

export interface ReadAloudRequest {
  text: string;
  sample_rate?: number;
  abort_signal?: AbortSignal;
}

export function buildReadAloudInput(text: string): string {
  return `Read the text between the markers aloud, exactly as written, and nothing else.\n<<<\n${text}\n>>>`;
}

function readUsage(response: Record<string, unknown>): SpeechUsage | null {
  const usage = response.usage as
    | {
        input_token_details?: { text_tokens?: number; cached_tokens?: number };
        output_token_details?: { text_tokens?: number; audio_tokens?: number };
      }
    | undefined;
  if (!usage) {
    return null;
  }
  return {
    input_text_tokens: usage.input_token_details?.text_tokens ?? 0,
    cached_input_tokens: usage.input_token_details?.cached_tokens ?? 0,
    output_audio_tokens: usage.output_token_details?.audio_tokens ?? 0,
    output_text_tokens: usage.output_token_details?.text_tokens ?? 0,
  };
}

// One Realtime session (wss://…/realtime?model=<gpt-realtime…>) used only as
// a reader: text goes in, the voice reads it, one response at a time.
export class OpenAiRealtimeReader {
  private socket: OpenAiRealtimeSocket | null = null;
  private is_reading = false;
  private is_broken = false;

  constructor(readonly settings: RealtimeReaderSettings) {}

  get is_available(): boolean {
    return !this.is_reading && !this.is_broken;
  }

  get is_usable(): boolean {
    return !this.is_broken;
  }

  read(read_request: ReadAloudRequest): SpeechStream {
    this.is_reading = true;
    const chunk_queue = new AsyncChunkQueue<Int16Array>();
    let resolveSummary: (summary: SpeechSummary) => void = () => undefined;
    let rejectSummary: (error: unknown) => void = () => undefined;
    const summary = new Promise<SpeechSummary>((resolve, reject) => {
      resolveSummary = resolve;
      rejectSummary = reject;
    });
    summary.catch(() => undefined);
    void this.runResponse(read_request, {
      chunk_queue,
      resolveSummary,
      rejectSummary,
    });
    return {
      summary,
      [Symbol.asyncIterator]: () => chunk_queue[Symbol.asyncIterator](),
    };
  }

  close(): void {
    this.is_broken = true;
    this.socket?.close();
    this.socket = null;
  }

  private async ensureOpen(): Promise<OpenAiRealtimeSocket> {
    if (this.socket?.is_open) {
      return this.socket;
    }
    const socket = new OpenAiRealtimeSocket({
      provider_name: this.settings.provider_name,
      url: buildRealtimeUrl(
        this.settings.base_url,
        `model=${encodeURIComponent(this.settings.model)}`,
      ),
      api_key: this.settings.api_key,
      connect_timeout_ms: this.settings.timeout_ms,
      createWebSocket: this.settings.createWebSocket,
      session: {
        type: 'realtime',
        instructions: this.settings.instructions
          ? `${READER_INSTRUCTIONS}\nVoice style: ${this.settings.instructions}`
          : READER_INSTRUCTIONS,
        output_modalities: ['audio'],
        tools: [],
        audio: {
          // core never sends this session audio.
          input: { turn_detection: null },
          output: {
            format: { type: 'audio/pcm', rate: REALTIME_SAMPLE_RATE },
            voice: this.settings.voice,
            speed: this.settings.speed,
          },
        },
      },
    });
    socket.onUnexpectedClose(() => {
      this.is_broken = true;
    });
    await socket.open();
    this.socket = socket;
    return socket;
  }

  private async runResponse(
    read_request: ReadAloudRequest,
    outputs: {
      chunk_queue: AsyncChunkQueue<Int16Array>;
      resolveSummary: (summary: SpeechSummary) => void;
      rejectSummary: (error: unknown) => void;
    },
  ): Promise<void> {
    let socket: OpenAiRealtimeSocket;
    try {
      socket = await this.ensureOpen();
    } catch (error) {
      this.is_broken = true;
      this.is_reading = false;
      outputs.chunk_queue.fail(error);
      outputs.rejectSummary(error);
      return;
    }
    const request_id = randomBytes(6).toString('hex');
    const target_sample_rate = read_request.sample_rate ?? REALTIME_SAMPLE_RATE;
    let response_id: string | null = null;
    let spoken_transcript = '';
    let idle_timer: NodeJS.Timeout | null = null;
    let cancel_timer: NodeJS.Timeout | null = null;

    const finish = (outcome: {
      error?: unknown;
      response?: Record<string, unknown>;
    }) => {
      unsubscribe();
      unsubscribeClose();
      read_request.abort_signal?.removeEventListener('abort', cancelResponse);
      [idle_timer, cancel_timer].forEach(
        (timer) => timer && clearTimeout(timer),
      );
      this.is_reading = false;
      if (outcome.error) {
        outputs.chunk_queue.fail(outcome.error);
        outputs.rejectSummary(outcome.error);
        return;
      }
      const response = outcome.response ?? {};
      const is_completed = response.status === 'completed';
      outputs.chunk_queue.end();
      outputs.resolveSummary({
        provider: this.settings.provider_name,
        model: this.settings.model,
        voice: this.settings.voice,
        requested_text: read_request.text,
        spoken_transcript: spoken_transcript || null,
        is_drifted:
          is_completed &&
          spoken_transcript.length > 0 &&
          isTranscriptDrifted(read_request.text, spoken_transcript),
        usage: readUsage(response),
      });
    };
    const fail = (failure_detail: string) => {
      this.is_broken = true;
      finish({
        error: new AiProviderRequestFailedError(
          this.settings.provider_name,
          failure_detail,
        ),
      });
    };
    const restartIdleTimer = () => {
      if (idle_timer) {
        clearTimeout(idle_timer);
      }
      idle_timer = setTimeout(
        () => fail(`no speech for ${this.settings.timeout_ms} ms`),
        this.settings.timeout_ms,
      );
    };
    const cancelResponse = () => {
      // The caller stops listening now; the session waits for the server's
      // confirmation before it reads anything else.
      outputs.chunk_queue.fail(
        new AiRequestAbortedError(this.settings.provider_name),
      );
      socket.send({
        type: 'response.cancel',
        ...(response_id ? { response_id } : {}),
      });
      cancel_timer = setTimeout(() => {
        this.is_broken = true;
        finish({ response: { status: 'cancelled' } });
      }, CANCEL_CONFIRM_MS);
    };
    const isOurResponse = (server_event: RealtimeServerEvent) => {
      const event_response_id =
        (server_event.response_id as string | undefined) ??
        (server_event.response as { id?: string } | undefined)?.id;
      return (
        response_id === null ||
        event_response_id === undefined ||
        event_response_id === response_id
      );
    };

    const unsubscribe = socket.onEvent((server_event) => {
      restartIdleTimer();
      switch (server_event.type) {
        case 'response.created': {
          const response = server_event.response as {
            id?: string;
            metadata?: { request_id?: string } | null;
          };
          if (
            !response.metadata?.request_id ||
            response.metadata.request_id === request_id
          ) {
            response_id = response.id ?? null;
          }
          return;
        }
        case 'response.output_audio.delta':
          if (isOurResponse(server_event) && !outputs.chunk_queue.has_ended) {
            outputs.chunk_queue.push(
              resamplePcm(
                decodePcmBase64(String(server_event.delta ?? '')),
                REALTIME_SAMPLE_RATE,
                target_sample_rate,
              ),
            );
          }
          return;
        case 'response.output_audio_transcript.delta':
          if (isOurResponse(server_event)) {
            spoken_transcript += String(server_event.delta ?? '');
          }
          return;
        case 'response.output_audio_transcript.done':
          if (
            isOurResponse(server_event) &&
            typeof server_event.transcript === 'string'
          ) {
            spoken_transcript = server_event.transcript;
          }
          return;
        case 'response.done': {
          if (!isOurResponse(server_event)) {
            return;
          }
          const response = server_event.response as Record<string, unknown>;
          if (response.status === 'failed') {
            const status_details = response.status_details as
              { error?: { message?: string } } | undefined;
            return fail(
              status_details?.error?.message ?? 'the response failed',
            );
          }
          return finish({ response });
        }
        case 'error':
          return fail(readErrorMessage(server_event));
      }
    });
    const unsubscribeClose = socket.onUnexpectedClose(() =>
      fail('the Realtime connection closed while reading'),
    );
    if (read_request.abort_signal?.aborted) {
      finish({ error: new AiRequestAbortedError(this.settings.provider_name) });
      return;
    }
    read_request.abort_signal?.addEventListener('abort', cancelResponse, {
      once: true,
    });
    restartIdleTimer();
    socket.send({
      type: 'response.create',
      response: {
        // Out of band: nothing accumulates in the session between lines.
        conversation: 'none',
        output_modalities: ['audio'],
        metadata: { request_id },
        input: [
          {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: buildReadAloudInput(read_request.text),
              },
            ],
          },
        ],
      },
    });
  }
}

// Reader sessions kept open between the lines of ONE call (keyed by its
// session key and voice settings) and closed when that call ends. A request
// without a session key gets a session of its own, closed right after it, so
// no connection outlives the work it was opened for.
export class OpenAiRealtimeReaderPool {
  private readonly idle_readers = new Map<string, OpenAiRealtimeReader[]>();
  private readonly released_session_keys = new Set<string>();

  constructor(private readonly max_idle_per_voice = 2) {}

  acquire(settings: RealtimeReaderSettings): OpenAiRealtimeReader {
    if (!settings.session_key) {
      return new OpenAiRealtimeReader(settings);
    }
    this.released_session_keys.delete(settings.session_key);
    const pool_key = this.buildKey(settings);
    const idle_readers = (this.idle_readers.get(pool_key) ?? []).filter(
      (reader) => reader.is_usable,
    );
    const reader = idle_readers.find((each_reader) => each_reader.is_available);
    this.idle_readers.set(
      pool_key,
      idle_readers.filter((each_reader) => each_reader !== reader),
    );
    return reader ?? new OpenAiRealtimeReader(settings);
  }

  release(reader: OpenAiRealtimeReader): void {
    const session_key = reader.settings.session_key;
    if (
      !session_key ||
      !reader.is_usable ||
      this.released_session_keys.has(session_key)
    ) {
      reader.close();
      return;
    }
    const pool_key = this.buildKey(reader.settings);
    const idle_readers = this.idle_readers.get(pool_key) ?? [];
    if (idle_readers.length >= this.max_idle_per_voice) {
      reader.close();
      return;
    }
    this.idle_readers.set(pool_key, [...idle_readers, reader]);
  }

  // The call ended: its idle sessions close now, busy ones when they finish.
  closeSessions(session_key: string): void {
    this.released_session_keys.add(session_key);
    for (const [pool_key, readers] of this.idle_readers) {
      if (readers[0]?.settings.session_key === session_key) {
        readers.forEach((reader) => reader.close());
        this.idle_readers.delete(pool_key);
      }
    }
  }

  get open_session_count(): number {
    return [...this.idle_readers.values()].reduce(
      (reader_total, readers) => reader_total + readers.length,
      0,
    );
  }

  closeAll(): void {
    this.idle_readers.forEach((readers) =>
      readers.forEach((reader) => reader.close()),
    );
    this.idle_readers.clear();
  }

  private buildKey(settings: RealtimeReaderSettings): string {
    return [
      settings.session_key ?? '',
      settings.base_url,
      settings.model,
      settings.voice,
      settings.speed,
      settings.instructions ?? '',
    ].join('|');
  }
}
