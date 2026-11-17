// TEST ONLY. A stand-in for the OpenAI Realtime API that speaks the
// documented events, so core's OpenAI voice path (gpt-live-transcribe +
// gpt-realtime-2.1-mini as a reader) can run end to end with no key.
// Underneath it uses Speaches: commits are transcribed by Whisper, lines are
// read by Kokoro (marin -> bf_emma, cedar -> bm_george).
//
//   node test/fake_openai_realtime.server.mjs            # port 8790
//   OPENAI_BASE_URL=http://localhost:8790/v1 OPENAI_API_KEY=fake ... bun run start
//
// FAKE_DRIFT_PATTERN (regex): lines matching it come back with a different
// transcript, to exercise core's drift check.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

import { WebSocketServer } from 'ws';

const PORT = Number(process.env.FAKE_OPENAI_PORT ?? 8790);
const SPEACHES_URL = process.env.SPEACHES_URL ?? 'http://localhost:8000/v1';
const DRIFT_PATTERN = process.env.FAKE_DRIFT_PATTERN ? new RegExp(process.env.FAKE_DRIFT_PATTERN, 'i') : null;
const SAMPLE_RATE = 24_000;
const VOICE_MAP = { marin: 'bf_emma', cedar: 'bm_george' };
const MODELS = ['gpt-6-luna', 'gpt-live-transcribe', 'gpt-transcribe', 'gpt-realtime-whisper', 'gpt-realtime-2.1-mini'];

const stats = { transcription_sessions: 0, reader_sessions: 0, open_connections: 0, commits: 0, responses: 0, cancels: 0, drifts: 0 };
const log = (message) => console.log(`[fake-openai ${new Date().toISOString().slice(11, 23)}] ${message}`);
const newId = (prefix) => `${prefix}_${randomBytes(6).toString('hex')}`;

function encodeWav(pcm_bytes) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm_bytes.length, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm_bytes.length, 40);
  return Buffer.concat([header, pcm_bytes]);
}

async function transcribeWithWhisper(pcm_bytes) {
  const form = new FormData();
  form.append('file', new Blob([encodeWav(pcm_bytes)], { type: 'audio/wav' }), 'turn.wav');
  form.append('model', 'Systran/faster-whisper-small.en');
  form.append('language', 'en');
  const response = await fetch(`${SPEACHES_URL}/audio/transcriptions`, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`Speaches STT ${response.status}`);
  return ((await response.json()).text ?? '').trim();
}

// ── Transcription sessions (?intent=transcription) ─────────────────────────
function serveTranscription(socket, send) {
  stats.transcription_sessions += 1;
  let buffered = [];
  socket.on('message', async (raw) => {
    const event = JSON.parse(String(raw));
    if (event.type === 'session.update') {
      if (event.session?.type !== 'transcription' || event.session?.audio?.input?.turn_detection !== null) {
        send({ type: 'error', error: { type: 'invalid_request_error', code: 'unexpected_session', message: 'expected a transcription session with turn_detection null' } });
        return;
      }
      send({ type: 'session.updated', session: event.session });
    } else if (event.type === 'input_audio_buffer.append') {
      buffered.push(Buffer.from(event.audio, 'base64'));
    } else if (event.type === 'input_audio_buffer.clear') {
      buffered = [];
      send({ type: 'input_audio_buffer.cleared' });
    } else if (event.type === 'input_audio_buffer.commit') {
      const pcm_bytes = Buffer.concat(buffered);
      buffered = [];
      if (pcm_bytes.length < SAMPLE_RATE * 2 * 0.1) {
        send({ type: 'error', error: { type: 'invalid_request_error', code: 'input_audio_buffer_commit_empty', message: 'buffer too small' } });
        return;
      }
      stats.commits += 1;
      const item_id = newId('item');
      send({ type: 'input_audio_buffer.committed', item_id, previous_item_id: null });
      try {
        const transcript = await transcribeWithWhisper(pcm_bytes);
        const words = transcript.split(' ');
        const half = Math.ceil(words.length / 2);
        send({ type: 'conversation.item.input_audio_transcription.delta', item_id, content_index: 0, delta: `${words.slice(0, half).join(' ')} ` });
        send({ type: 'conversation.item.input_audio_transcription.delta', item_id, content_index: 0, delta: words.slice(half).join(' ') });
        send({
          type: 'conversation.item.input_audio_transcription.completed',
          item_id,
          content_index: 0,
          transcript,
          usage: { type: 'duration', seconds: Math.round((pcm_bytes.length / 2 / SAMPLE_RATE) * 100) / 100 },
        });
        log(`transcribed ${(pcm_bytes.length / 2 / SAMPLE_RATE).toFixed(2)} s: "${transcript}"`);
      } catch (error) {
        send({ type: 'conversation.item.input_audio_transcription.failed', item_id, content_index: 0, error: { code: 'fake_stt_failed', message: error.message } });
      }
    }
  });
}

// ── Reader sessions (?model=gpt-realtime-…) ────────────────────────────────
function readRequestedText(input_text) {
  const marked = input_text.match(/<<<\n([\s\S]*)\n>>>/);
  return (marked ? marked[1] : input_text).trim();
}

function serveReader(socket, send) {
  stats.reader_sessions += 1;
  let session = null;
  let active = null;
  socket.on('message', async (raw) => {
    const event = JSON.parse(String(raw));
    if (event.type === 'session.update') {
      session = event.session;
      send({ type: 'session.updated', session });
      return;
    }
    if (event.type === 'response.cancel') {
      stats.cancels += 1;
      if (active && (!event.response_id || event.response_id === active.id)) active.is_cancelled = true;
      return;
    }
    if (event.type !== 'response.create') return;
    const response = event.response ?? {};
    if (response.conversation !== 'none') {
      send({ type: 'error', error: { type: 'invalid_request_error', code: 'fake_expects_out_of_band', message: 'the fake only serves out-of-band responses' } });
      return;
    }
    const text = readRequestedText(response.input?.[0]?.content?.[0]?.text ?? '');
    const voice = VOICE_MAP[session?.audio?.output?.voice] ?? 'bf_emma';
    const current = { id: newId('resp'), is_cancelled: false };
    active = current;
    stats.responses += 1;
    send({ type: 'response.created', response: { id: current.id, object: 'realtime.response', status: 'in_progress', metadata: response.metadata ?? null } });
    const tts = await fetch(`${SPEACHES_URL}/audio/speech`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'speaches-ai/Kokoro-82M-v1.0-ONNX', voice, input: text, response_format: 'pcm', speed: session?.audio?.output?.speed ?? 1 }),
    });
    let audio_bytes = 0;
    let carry = Buffer.alloc(0);
    const reader = tts.body.getReader();
    while (!current.is_cancelled) {
      const { done, value } = await reader.read();
      if (done) break;
      const bytes = Buffer.concat([carry, Buffer.from(value)]);
      const even_length = bytes.length - (bytes.length % 2);
      carry = bytes.subarray(even_length);
      if (even_length === 0) continue;
      audio_bytes += even_length;
      send({ type: 'response.output_audio.delta', response_id: current.id, item_id: `${current.id}_item`, output_index: 0, content_index: 0, delta: bytes.subarray(0, even_length).toString('base64') });
    }
    await reader.cancel().catch(() => undefined);
    if (current.is_cancelled) {
      send({ type: 'response.done', response: { id: current.id, object: 'realtime.response', status: 'cancelled', status_details: { type: 'cancelled', reason: 'client_cancelled' }, metadata: response.metadata ?? null } });
      log(`cancelled "${text.slice(0, 40)}"`);
      return;
    }
    const is_drifted = DRIFT_PATTERN?.test(text) ?? false;
    if (is_drifted) stats.drifts += 1;
    const transcript = is_drifted ? 'Of course! I have already sorted all of that out for you, no need to worry at all.' : text;
    send({ type: 'response.output_audio_transcript.delta', response_id: current.id, item_id: `${current.id}_item`, output_index: 0, content_index: 0, delta: transcript });
    send({ type: 'response.output_audio_transcript.done', response_id: current.id, item_id: `${current.id}_item`, output_index: 0, content_index: 0, transcript });
    send({ type: 'response.output_audio.done', response_id: current.id, item_id: `${current.id}_item`, output_index: 0, content_index: 0 });
    const audio_tokens = Math.round((audio_bytes / 2 / SAMPLE_RATE) * 20);
    const text_tokens = Math.round(text.length / 4) + 60;
    send({
      type: 'response.done',
      response: {
        id: current.id,
        object: 'realtime.response',
        status: 'completed',
        metadata: response.metadata ?? null,
        usage: {
          total_tokens: text_tokens + audio_tokens,
          input_tokens: text_tokens,
          output_tokens: audio_tokens + Math.round(text.length / 4),
          input_token_details: { text_tokens, audio_tokens: 0, cached_tokens: 50, cached_tokens_details: { text_tokens: 50, audio_tokens: 0 } },
          output_token_details: { text_tokens: Math.round(text.length / 4), audio_tokens },
        },
      },
    });
    log(`read (${voice}) ${(audio_bytes / 2 / SAMPLE_RATE).toFixed(2)} s${is_drifted ? ' [drifted transcript]' : ''}: "${text.slice(0, 60)}"`);
  });
}

const http_server = createServer((request, response) => {
  if (request.method === 'GET' && request.url?.startsWith('/v1/models')) {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ object: 'list', data: MODELS.map((id) => ({ id, object: 'model' })) }));
    return;
  }
  if (request.url === '/stats') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(stats));
    return;
  }
  response.writeHead(404);
  response.end();
});

const socket_server = new WebSocketServer({ noServer: true });
http_server.on('upgrade', (request, net_socket, head) => {
  const url = new URL(request.url, 'http://fake');
  if (url.pathname !== '/v1/realtime' || !String(request.headers.authorization ?? '').startsWith('Bearer ')) {
    net_socket.destroy();
    return;
  }
  socket_server.handleUpgrade(request, net_socket, head, (socket) => {
    const send = (event) => socket.readyState === socket.OPEN && socket.send(JSON.stringify({ event_id: newId('event'), ...event }));
    stats.open_connections += 1;
    socket.on('close', () => {
      stats.open_connections -= 1;
    });
    const intent = url.searchParams.get('intent');
    const model = url.searchParams.get('model');
    send({ type: 'session.created', session: { id: newId('sess'), object: 'realtime.session', type: intent === 'transcription' ? 'transcription' : 'realtime', model } });
    if (intent === 'transcription') serveTranscription(socket, send);
    else serveReader(socket, send);
    log(`session opened: ${intent ? `intent=${intent}` : `model=${model}`}`);
  });
});

http_server.listen(PORT, () => log(`listening on http://localhost:${PORT}/v1 (ws /v1/realtime)`));
