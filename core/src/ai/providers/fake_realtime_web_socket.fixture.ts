import { RealtimeWebSocket } from '../wire/openai_realtime.socket';

type Listener = (...listener_args: unknown[]) => void;

// Test double of one Realtime WebSocket: records what core sends, lets the
// test play the server. It completes the handshake by itself
// (session.created, then session.updated after a session.update).
export class FakeRealtimeWebSocket implements RealtimeWebSocket {
  readonly sent_events: Record<string, unknown>[] = [];
  private readonly listeners = new Map<string, Listener[]>();
  is_closed = false;

  constructor(
    readonly url: string,
    readonly headers: Record<string, string>,
  ) {
    setImmediate(() =>
      this.emitServerEvent({ type: 'session.created', session: {} }),
    );
  }

  on(event_name: string, listener: Listener): this {
    this.listeners.set(event_name, [
      ...(this.listeners.get(event_name) ?? []),
      listener,
    ]);
    return this;
  }

  send(data: string): void {
    const client_event = JSON.parse(data) as Record<string, unknown>;
    this.sent_events.push(client_event);
    if (client_event.type === 'session.update') {
      setImmediate(() =>
        this.emitServerEvent({
          type: 'session.updated',
          session: client_event.session,
        }),
      );
    }
  }

  close(): void {
    if (this.is_closed) {
      return;
    }
    this.is_closed = true;
    this.listeners.get('close')?.forEach((listener) => listener());
  }

  emitServerEvent(server_event: Record<string, unknown>): void {
    this.listeners
      .get('message')
      ?.forEach((listener) =>
        listener(Buffer.from(JSON.stringify(server_event))),
      );
  }

  // The server drops the connection.
  dropConnection(): void {
    this.close();
  }

  readSent(event_type: string): Record<string, unknown>[] {
    return this.sent_events.filter(
      (client_event) => client_event.type === event_type,
    );
  }
}

export function buildFakeSocketFactory() {
  const sockets: FakeRealtimeWebSocket[] = [];
  const createWebSocket = (url: string, headers: Record<string, string>) => {
    const fake_socket = new FakeRealtimeWebSocket(url, headers);
    sockets.push(fake_socket);
    return fake_socket;
  };
  return { sockets, createWebSocket };
}

export async function waitForCondition(
  isConditionMet: () => boolean,
  label: string,
): Promise<void> {
  const deadline_ms = Date.now() + 2_000;
  while (!isConditionMet()) {
    if (Date.now() > deadline_ms) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

export function encodeSamplesBase64(samples: number[]): string {
  return Buffer.from(Int16Array.from(samples).buffer).toString('base64');
}
