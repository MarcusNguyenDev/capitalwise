import { WebSocket } from 'ws';

import { AiProviderRequestFailedError } from '../errors/ai_provider_request_failed.error';

export interface RealtimeServerEvent {
  type: string;
  [field_name: string]: unknown;
}

// The part of a `ws` WebSocket the realtime socket uses (tests fake it):
// 'open', 'message' (data), 'close' and 'error' (Error) events.
export interface RealtimeWebSocket {
  send(data: string): void;
  close(code?: number): void;
  on(event_name: string, listener: (...listener_args: any[]) => void): unknown;
}

export type RealtimeWebSocketFactory = (
  url: string,
  headers: Record<string, string>,
) => RealtimeWebSocket;

export const createWsRealtimeWebSocket: RealtimeWebSocketFactory = (
  url,
  headers,
) => new WebSocket(url, { headers }) as unknown as RealtimeWebSocket;

export interface RealtimeSocketSettings {
  provider_name: string;
  url: string;
  api_key: string;
  // session.update `session` object sent right after session.created.
  session: Record<string, unknown>;
  connect_timeout_ms: number;
  createWebSocket: RealtimeWebSocketFactory;
}

// The Realtime API's https base URL becomes its WebSocket URL, so pointing
// OPENAI_BASE_URL at another server (a test double) moves both.
export function buildRealtimeUrl(base_url: string, query: string): string {
  return `${base_url.replace(/^http/, 'ws')}/realtime?${query}`;
}

// One OpenAI Realtime WebSocket: connects, configures the session and hands
// every server event to its listeners.
export class OpenAiRealtimeSocket {
  private web_socket: RealtimeWebSocket | null = null;
  private readonly event_listeners = new Set<
    (server_event: RealtimeServerEvent) => void
  >();
  private readonly close_listeners = new Set<() => void>();
  private is_ready = false;
  private is_closed_by_us = false;

  constructor(private readonly settings: RealtimeSocketSettings) {}

  get is_open(): boolean {
    return this.is_ready && this.web_socket !== null;
  }

  // Resolves once session.updated confirms the configuration.
  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const fail = (failure_detail: string) => {
        clearTimeout(connect_timer);
        this.close();
        reject(
          new AiProviderRequestFailedError(
            this.settings.provider_name,
            failure_detail,
          ),
        );
      };
      const connect_timer = setTimeout(
        () =>
          fail(
            `no Realtime session from ${this.settings.url} within ${this.settings.connect_timeout_ms} ms`,
          ),
        this.settings.connect_timeout_ms,
      );
      const web_socket = this.settings.createWebSocket(this.settings.url, {
        Authorization: `Bearer ${this.settings.api_key}`,
      });
      this.web_socket = web_socket;
      web_socket.on('message', (raw_data: unknown) => {
        const server_event = this.parseEvent(raw_data);
        if (!server_event) {
          return;
        }
        if (!this.is_ready) {
          if (server_event.type === 'session.created') {
            this.send({
              type: 'session.update',
              session: this.settings.session,
            });
          } else if (server_event.type === 'session.updated') {
            this.is_ready = true;
            clearTimeout(connect_timer);
            resolve();
          } else if (server_event.type === 'error') {
            fail(readErrorMessage(server_event));
          }
          return;
        }
        this.event_listeners.forEach((listener) => listener(server_event));
      });
      web_socket.on('error', (error: Error) => {
        if (!this.is_ready) {
          fail(`${this.settings.url} could not be reached (${error.message})`);
        }
      });
      web_socket.on('close', () => {
        const was_ready = this.is_ready;
        this.is_ready = false;
        this.web_socket = null;
        if (!was_ready) {
          fail(`${this.settings.url} closed the connection`);
          return;
        }
        if (!this.is_closed_by_us) {
          this.close_listeners.forEach((listener) => listener());
        }
      });
    });
  }

  send(client_event: Record<string, unknown>): void {
    this.web_socket?.send(JSON.stringify(client_event));
  }

  onEvent(listener: (server_event: RealtimeServerEvent) => void): () => void {
    this.event_listeners.add(listener);
    return () => this.event_listeners.delete(listener);
  }

  // Called when the server (not us) closes a ready connection.
  onUnexpectedClose(listener: () => void): () => void {
    this.close_listeners.add(listener);
    return () => this.close_listeners.delete(listener);
  }

  close(): void {
    this.is_closed_by_us = true;
    this.is_ready = false;
    const web_socket = this.web_socket;
    this.web_socket = null;
    web_socket?.close(1000);
  }

  private parseEvent(raw_data: unknown): RealtimeServerEvent | null {
    try {
      const parsed_event = JSON.parse(String(raw_data)) as RealtimeServerEvent;
      return typeof parsed_event?.type === 'string' ? parsed_event : null;
    } catch {
      return null;
    }
  }
}

export function readErrorMessage(server_event: RealtimeServerEvent): string {
  const error_detail = server_event.error as
    { message?: string; code?: string } | undefined;
  return `${error_detail?.code ? `${error_detail.code}: ` : ''}${error_detail?.message ?? 'unknown Realtime error'}`;
}

export function encodePcmBase64(pcm: Int16Array): string {
  return Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).toString(
    'base64',
  );
}

export function decodePcmBase64(audio_base64: string): Int16Array {
  const audio_bytes = Buffer.from(audio_base64, 'base64');
  const sample_count = Math.floor(audio_bytes.length / 2);
  const pcm = new Int16Array(sample_count);
  for (let sample_index = 0; sample_index < sample_count; sample_index++) {
    pcm[sample_index] = audio_bytes.readInt16LE(sample_index * 2);
  }
  return pcm;
}
