import { createServer, Server } from 'node:http';

import { WebSocketServer } from 'ws';

import {
  buildRealtimeUrl,
  createWsRealtimeWebSocket,
  OpenAiRealtimeSocket,
} from './openai_realtime.socket';

describe('OpenAiRealtimeSocket over a real ws connection', () => {
  let http_server: Server;
  let socket_server: WebSocketServer;
  let base_url: string;
  const received_headers: string[] = [];

  beforeAll(async () => {
    http_server = createServer();
    socket_server = new WebSocketServer({ server: http_server });
    socket_server.on('connection', (socket, request) => {
      received_headers.push(String(request.headers.authorization));
      socket.send(JSON.stringify({ type: 'session.created', session: {} }));
      socket.on('message', (raw) => {
        const event = JSON.parse(String(raw));
        if (event.type === 'session.update') {
          socket.send(
            JSON.stringify({ type: 'session.updated', session: event.session }),
          );
        }
      });
    });
    await new Promise<void>((resolve) => http_server.listen(0, resolve));
    const address = http_server.address() as { port: number };
    base_url = `http://127.0.0.1:${address.port}/v1`;
  });

  afterAll(async () => {
    socket_server.close();
    await new Promise((resolve) => http_server.close(resolve));
  });

  it('derives the WebSocket URL from the https base URL', () => {
    expect(
      buildRealtimeUrl('https://api.openai.com/v1', 'intent=transcription'),
    ).toBe('wss://api.openai.com/v1/realtime?intent=transcription');
    expect(buildRealtimeUrl('http://localhost:8790/v1', 'model=x')).toBe(
      'ws://localhost:8790/v1/realtime?model=x',
    );
  });

  it('connects with the bearer token and completes the session handshake', async () => {
    const realtime_socket = new OpenAiRealtimeSocket({
      provider_name: 'openai',
      url: buildRealtimeUrl(base_url, 'intent=transcription'),
      api_key: 'sk-test',
      session: { type: 'transcription' },
      connect_timeout_ms: 2_000,
      createWebSocket: createWsRealtimeWebSocket,
    });

    await realtime_socket.open();

    expect(realtime_socket.is_open).toBe(true);
    expect(received_headers).toContain('Bearer sk-test');
    realtime_socket.close();
  });
});
