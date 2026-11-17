import { resamplePcm } from '../../audio/resample_pcm.util';
import { AiProviderRequestFailedError } from '../errors/ai_provider_request_failed.error';
import { TranscriptionResult } from '../types/transcription.type';
import { TranscriptionStream } from '../types/transcription_stream.type';
import {
  buildRealtimeUrl,
  encodePcmBase64,
  OpenAiRealtimeSocket,
  readErrorMessage,
  RealtimeServerEvent,
  RealtimeWebSocketFactory,
} from './openai_realtime.socket';

// The Realtime API takes 24 kHz mono PCM16.
export const REALTIME_SAMPLE_RATE = 24_000;
// A turn whose transcript has not arrived is sent again after a reconnect,
// but not forever.
const MAX_COMMIT_ATTEMPTS = 2;

export interface RealtimeTranscriptionSettings {
  provider_name: string;
  base_url: string;
  api_key: string;
  model: string;
  language?: string;
  prompt?: string;
  timeout_ms: number;
  createWebSocket: RealtimeWebSocketFactory;
}

interface PendingCommit {
  turn_audio: Int16Array[];
  sample_count: number;
  item_id: string | null;
  is_sent: boolean;
  attempt_count: number;
  timeout_timer: NodeJS.Timeout;
  resolve: (transcription_result: TranscriptionResult) => void;
  reject: (error: Error) => void;
}

// gpt-live-transcribe takes a list of language hints; the other models one.
function buildTranscriptionSettings(
  settings: RealtimeTranscriptionSettings,
): Record<string, unknown> {
  const language_field = settings.language
    ? settings.model === 'gpt-live-transcribe'
      ? { languages: [settings.language] }
      : { language: settings.language }
    : {};
  return {
    model: settings.model,
    ...language_field,
    ...(settings.prompt ? { prompt: settings.prompt } : {}),
  };
}

// One Realtime transcription session for a whole call
// (wss://…/realtime?intent=transcription). Turn detection is ours: audio is
// appended while the caller talks and each turn is committed explicitly, so
// the transcript arrives moments after they stop. The audio of an open turn
// is kept so it can be replayed if the connection drops.
export class OpenAiRealtimeTranscriptionStream implements TranscriptionStream {
  private socket: OpenAiRealtimeSocket | null = null;
  private connecting: Promise<OpenAiRealtimeSocket> | null = null;
  private turn_audio: Int16Array[] = [];
  private turn_sample_count = 0;
  private readonly pending_commits: PendingCommit[] = [];
  private readonly delta_listeners = new Set<(delta: string) => void>();
  private is_closed = false;

  constructor(private readonly settings: RealtimeTranscriptionSettings) {}

  // Connects ahead of the first turn (optional: appendAudio connects too).
  async connect(): Promise<void> {
    await this.ensureConnected();
  }

  appendAudio(pcm: Int16Array, sample_rate: number): void {
    if (this.is_closed) {
      return;
    }
    const realtime_pcm = resamplePcm(pcm, sample_rate, REALTIME_SAMPLE_RATE);
    this.turn_audio.push(realtime_pcm);
    this.turn_sample_count += realtime_pcm.length;
    if (this.socket?.is_open) {
      this.sendAudio(this.socket, realtime_pcm);
    } else {
      this.ensureConnected().catch(() => undefined);
    }
  }

  commit(): Promise<TranscriptionResult> {
    if (this.is_closed) {
      return Promise.reject(
        this.buildError('the transcription stream is closed'),
      );
    }
    return new Promise((resolve, reject) => {
      const pending_commit: PendingCommit = {
        turn_audio: this.turn_audio,
        sample_count: this.turn_sample_count,
        item_id: null,
        is_sent: false,
        attempt_count: 0,
        resolve,
        reject,
        timeout_timer: setTimeout(
          () =>
            this.settlePending(pending_commit, () =>
              reject(
                this.buildError(
                  `no transcript within ${this.settings.timeout_ms} ms`,
                ),
              ),
            ),
          this.settings.timeout_ms,
        ),
      };
      this.turn_audio = [];
      this.turn_sample_count = 0;
      this.pending_commits.push(pending_commit);
      if (this.socket?.is_open) {
        this.sendCommit(this.socket, pending_commit, false);
      } else {
        this.ensureConnected().catch((error: Error) =>
          this.settlePending(pending_commit, () => reject(error)),
        );
      }
    });
  }

  clear(): void {
    this.turn_audio = [];
    this.turn_sample_count = 0;
    this.socket?.send({ type: 'input_audio_buffer.clear' });
  }

  onDelta(listener: (delta: string) => void): () => void {
    this.delta_listeners.add(listener);
    return () => this.delta_listeners.delete(listener);
  }

  async close(): Promise<void> {
    this.is_closed = true;
    for (const pending_commit of [...this.pending_commits]) {
      this.settlePending(pending_commit, () =>
        pending_commit.reject(
          this.buildError('the transcription stream was closed'),
        ),
      );
    }
    this.socket?.close();
    this.socket = null;
  }

  private ensureConnected(): Promise<OpenAiRealtimeSocket> {
    if (this.socket?.is_open) {
      return Promise.resolve(this.socket);
    }
    this.connecting ??= this.openSocket().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async openSocket(): Promise<OpenAiRealtimeSocket> {
    const socket = new OpenAiRealtimeSocket({
      provider_name: this.settings.provider_name,
      url: buildRealtimeUrl(this.settings.base_url, 'intent=transcription'),
      api_key: this.settings.api_key,
      connect_timeout_ms: this.settings.timeout_ms,
      createWebSocket: this.settings.createWebSocket,
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: REALTIME_SAMPLE_RATE },
            transcription: buildTranscriptionSettings(this.settings),
            // Ours: the voice agent's VAD decides when a turn ends.
            turn_detection: null,
          },
        },
      },
    });
    socket.onEvent((server_event) => this.handleEvent(server_event));
    socket.onUnexpectedClose(() => this.handleConnectionLost(socket));
    await socket.open();
    if (this.is_closed) {
      socket.close();
      throw this.buildError('the transcription stream was closed');
    }
    this.socket = socket;
    this.replayAfterConnect(socket);
    return socket;
  }

  // Turns committed while disconnected go first, in order, then the audio
  // of the turn still being spoken.
  private replayAfterConnect(socket: OpenAiRealtimeSocket): void {
    for (const pending_commit of this.pending_commits) {
      if (!pending_commit.is_sent) {
        this.sendCommit(socket, pending_commit, true);
      }
    }
    this.turn_audio.forEach((pcm) => this.sendAudio(socket, pcm));
  }

  private sendCommit(
    socket: OpenAiRealtimeSocket,
    pending_commit: PendingCommit,
    should_send_audio: boolean,
  ): void {
    if (should_send_audio) {
      pending_commit.turn_audio.forEach((pcm) => this.sendAudio(socket, pcm));
    }
    pending_commit.is_sent = true;
    pending_commit.attempt_count += 1;
    socket.send({ type: 'input_audio_buffer.commit' });
  }

  private sendAudio(socket: OpenAiRealtimeSocket, pcm: Int16Array): void {
    socket.send({
      type: 'input_audio_buffer.append',
      audio: encodePcmBase64(pcm),
    });
  }

  private handleEvent(server_event: RealtimeServerEvent): void {
    switch (server_event.type) {
      case 'input_audio_buffer.committed':
        return this.assignItemId(server_event.item_id as string);
      case 'conversation.item.input_audio_transcription.delta':
        if (typeof server_event.delta === 'string' && server_event.delta) {
          this.delta_listeners.forEach((listener) =>
            listener(server_event.delta as string),
          );
        }
        return;
      case 'conversation.item.input_audio_transcription.completed':
        return this.completeTurn(server_event);
      case 'conversation.item.input_audio_transcription.failed':
        return this.failTurn(
          server_event.item_id as string,
          readErrorMessage(server_event),
        );
      case 'error':
        return this.failOldestUncommitted(readErrorMessage(server_event));
    }
  }

  private assignItemId(item_id: string): void {
    const pending_commit = this.pending_commits.find(
      (each_commit) => each_commit.is_sent && each_commit.item_id === null,
    );
    if (pending_commit) {
      pending_commit.item_id = item_id;
    }
  }

  private completeTurn(server_event: RealtimeServerEvent): void {
    const pending_commit = this.findPending(server_event.item_id as string);
    if (!pending_commit) {
      return;
    }
    const usage = server_event.usage as
      { type?: string; seconds?: number } | undefined;
    this.settlePending(pending_commit, () =>
      pending_commit.resolve({
        text: String(server_event.transcript ?? '').trim(),
        duration_seconds:
          usage?.type === 'duration' && typeof usage.seconds === 'number'
            ? usage.seconds
            : pending_commit.sample_count / REALTIME_SAMPLE_RATE,
        provider: this.settings
          .provider_name as TranscriptionResult['provider'],
        model: this.settings.model,
      }),
    );
  }

  private failTurn(item_id: string, failure_detail: string): void {
    const pending_commit = this.findPending(item_id);
    if (pending_commit) {
      this.settlePending(pending_commit, () =>
        pending_commit.reject(
          this.buildError(`transcription failed: ${failure_detail}`),
        ),
      );
    }
  }

  // An error event right after a commit (e.g. an empty buffer) belongs to
  // the oldest commit the server has not acknowledged.
  private failOldestUncommitted(failure_detail: string): void {
    const pending_commit = this.pending_commits.find(
      (each_commit) => each_commit.is_sent && each_commit.item_id === null,
    );
    if (pending_commit) {
      this.settlePending(pending_commit, () =>
        pending_commit.reject(this.buildError(failure_detail)),
      );
    }
  }

  // Unanswered turns are sent again on a new connection (at most twice).
  private handleConnectionLost(lost_socket: OpenAiRealtimeSocket): void {
    if (this.socket === lost_socket) {
      this.socket = null;
    }
    for (const pending_commit of [...this.pending_commits]) {
      if (pending_commit.attempt_count >= MAX_COMMIT_ATTEMPTS) {
        this.settlePending(pending_commit, () =>
          pending_commit.reject(
            this.buildError('the connection dropped twice during this turn'),
          ),
        );
        continue;
      }
      pending_commit.is_sent = false;
      pending_commit.item_id = null;
    }
    if (
      !this.is_closed &&
      (this.pending_commits.length > 0 || this.turn_audio.length > 0)
    ) {
      this.ensureConnected().catch((error: Error) => {
        for (const pending_commit of [...this.pending_commits]) {
          this.settlePending(pending_commit, () =>
            pending_commit.reject(error),
          );
        }
      });
    }
  }

  private findPending(item_id: string): PendingCommit | undefined {
    return this.pending_commits.find(
      (pending_commit) => pending_commit.item_id === item_id,
    );
  }

  private settlePending(
    pending_commit: PendingCommit,
    settle: () => void,
  ): void {
    const pending_index = this.pending_commits.indexOf(pending_commit);
    if (pending_index === -1) {
      return;
    }
    this.pending_commits.splice(pending_index, 1);
    clearTimeout(pending_commit.timeout_timer);
    settle();
  }

  private buildError(failure_detail: string): AiProviderRequestFailedError {
    return new AiProviderRequestFailedError(
      this.settings.provider_name,
      failure_detail,
    );
  }
}
