// End-to-end test of the LIVE voice pipeline against the running stack:
// a synthetic caller joins the call's LiveKit room as `customer`, speaks
// lines rendered by Speaches in a different voice (af_heart), approves the
// identity push through the api, and exercises INSTRUCTION, TAKEOVER +
// STAFF_MESSAGE + HANDBACK and the end of the call.
//
//   cd core && node test/live_voice_caller.e2e.mjs
//
// Needs core (with a reachable chat model), api, LiveKit and Speaches running.
// It does NOT reset the database. Exit code 0 = every assertion passed.
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

import {
  AudioFrame,
  AudioSource,
  AudioStream,
  dispose,
  LocalAudioTrack,
  Room,
  RoomEvent,
  TrackKind,
  TrackPublishOptions,
  TrackSource,
} from '@livekit/rtc-node';
import { RoomServiceClient } from 'livekit-server-sdk';
import { io } from 'socket.io-client';

const CORE_URL = process.env.CORE_URL ?? 'http://localhost:3001';
const API_URL = process.env.API_URL ?? 'http://localhost:3002';
const LIVEKIT_URL = process.env.LIVEKIT_URL ?? 'ws://localhost:7880';
const SPEACHES_URL = process.env.SPEACHES_URL ?? 'http://localhost:8000/v1';
const CALLER_VOICE = process.env.CALLER_VOICE ?? 'af_heart';
const SARAH_NUMBER = '+61491570156';
const STAFF_ID = 'STF-01';
const SAMPLE_RATE = 24_000;
const FRAME_SAMPLES = 240;
const AUDIBLE_RMS = 300;
// The CPU test model can need ~30 s per turn when the prompt is not cached.
const APPROVAL_DELAY_MS = Number(process.env.APPROVAL_DELAY_MS ?? 11_000);
const TURN_TIMEOUT_MS = Number(process.env.TURN_TIMEOUT_MS ?? 150_000);

const started_at_ms = Date.now();
const log = (message) =>
  console.log(`[${((Date.now() - started_at_ms) / 1000).toFixed(1)}s] ${message}`);
const sleep = (duration_ms) => new Promise((resolve) => setTimeout(resolve, duration_ms));

function readCoreEnv() {
  const env_values = {};
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env_values[match[1]] = match[2].trim();
  }
  return env_values;
}

async function callJson(base_url, path, method = 'GET', body) {
  const response = await fetch(`${base_url}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text}`);
  return parsed;
}
const core = {
  get: (path) => callJson(CORE_URL, `/core${path}`),
  post: (path, body = {}) => callJson(CORE_URL, `/core${path}`, 'POST', body),
};
const api = {
  get: (path) => callJson(API_URL, `/api${path}`),
  post: (path, body = {}) => callJson(API_URL, `/api${path}`, 'POST', body),
};

async function waitUntil(label, checkCondition, timeout_ms = TURN_TIMEOUT_MS) {
  const deadline_ms = Date.now() + timeout_ms;
  while (Date.now() < deadline_ms) {
    const result = await checkCondition();
    if (result) return result;
    await sleep(250);
  }
  throw new Error(`Timed out after ${timeout_ms} ms waiting for ${label}`);
}

function measureRms(samples) {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

async function renderCallerLine(text) {
  const response = await fetch(`${SPEACHES_URL}/audio/speech`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
      voice: CALLER_VOICE,
      input: text,
      response_format: 'pcm',
    }),
  });
  assert.ok(response.ok, `Speaches TTS failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 2));
}

function encodeWav(pcm, sample_rate) {
  const wav = Buffer.alloc(44 + pcm.length * 2);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + pcm.length * 2, 4);
  wav.write('WAVEfmt ', 8, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sample_rate, 24);
  wav.writeUInt32LE(sample_rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(pcm.length * 2, 40);
  Buffer.from(pcm.buffer, pcm.byteOffset, pcm.length * 2).copy(wav, 44);
  return wav;
}

async function transcribe(pcm) {
  const form = new FormData();
  form.append('file', new Blob([encodeWav(pcm, SAMPLE_RATE)], { type: 'audio/wav' }), 'heard.wav');
  form.append('model', 'Systran/faster-whisper-small.en');
  form.append('language', 'en');
  const response = await fetch(`${SPEACHES_URL}/audio/transcriptions`, { method: 'POST', body: form });
  return (await response.json()).text ?? '';
}

// ── The synthetic phone ────────────────────────────────────────────────────

class SyntheticPhone {
  constructor() {
    this.room = new Room();
    this.speech_queue = [];
    this.is_running = true;
    this.last_audible_at_ms = 0;
    this.audible_onsets = [];
    this.recording = null;
    this.speech_end_listeners = [];
    this.is_disconnected = false;
  }

  async join(livekit_url, token) {
    this.room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (track.kind === TrackKind.KIND_AUDIO) {
        log(`Subscribed to ${participant.identity}'s audio`);
        void this.listen(new AudioStream(track, { sampleRate: SAMPLE_RATE, numChannels: 1 }));
      }
    });
    this.room.on(RoomEvent.Disconnected, () => {
      this.is_disconnected = true;
      log('The phone was disconnected from the room');
    });
    await this.room.connect(livekit_url, token, { autoSubscribe: true });
    this.source = new AudioSource(SAMPLE_RATE, 1, 100);
    const track = LocalAudioTrack.createAudioTrack('phone_mic', this.source);
    const options = new TrackPublishOptions();
    options.source = TrackSource.SOURCE_MICROPHONE;
    await this.room.localParticipant.publishTrack(track, options);
    void this.pumpMicrophone();
  }

  async listen(audio_stream) {
    let was_audible = false;
    for await (const frame of audio_stream) {
      const is_audible = measureRms(frame.data) > AUDIBLE_RMS;
      if (is_audible) {
        if (!was_audible && Date.now() - this.last_audible_at_ms > 400) {
          this.audible_onsets.push(Date.now());
        }
        this.last_audible_at_ms = Date.now();
      }
      was_audible = is_audible;
      if (this.recording) this.recording.push(new Int16Array(frame.data));
      if (!this.is_running) break;
    }
  }

  // A real microphone never stops: silence between lines, speech when asked.
  async pumpMicrophone() {
    const silence = new Int16Array(FRAME_SAMPLES);
    while (this.is_running) {
      const frame = this.speech_queue.shift();
      await this.source.captureFrame(new AudioFrame(frame ?? silence, SAMPLE_RATE, 1, FRAME_SAMPLES));
      if (frame && this.speech_queue.length === 0) {
        const ended_at_ms = Date.now() + this.source.queuedDuration;
        this.speech_end_listeners.splice(0).forEach((resolve) => resolve(ended_at_ms));
      }
    }
  }

  // Resolves with the time the last speech frame reached the room.
  speak(pcm) {
    for (let offset = 0; offset < pcm.length; offset += FRAME_SAMPLES) {
      const frame = new Int16Array(FRAME_SAMPLES);
      frame.set(pcm.subarray(offset, offset + FRAME_SAMPLES));
      this.speech_queue.push(frame);
    }
    return new Promise((resolve) => this.speech_end_listeners.push(resolve));
  }

  firstAudioAfter(time_ms) {
    return this.audible_onsets.find((onset_ms) => onset_ms >= time_ms) ?? null;
  }

  async waitForQuiet(quiet_ms = 1_500, timeout_ms = TURN_TIMEOUT_MS) {
    await waitUntil('the agent to stop speaking', () => Date.now() - this.last_audible_at_ms > quiet_ms, timeout_ms);
  }

  startRecording() {
    this.recording = [];
  }

  stopRecording() {
    const frames = this.recording ?? [];
    this.recording = null;
    const total = frames.reduce((sum, frame) => sum + frame.length, 0);
    const pcm = new Int16Array(total);
    let offset = 0;
    for (const frame of frames) {
      pcm.set(frame, offset);
      offset += frame.length;
    }
    return pcm;
  }

  async leave() {
    this.is_running = false;
    await this.room.disconnect().catch(() => undefined);
  }
}

// ── The test ───────────────────────────────────────────────────────────────

const report = { customer_turns: [], checks: [], model_behaviour: [] };
const check = (label, condition, detail = '') => {
  report.checks.push({ label, ok: Boolean(condition), detail });
  log(`${condition ? 'PASS' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
};

const live_events = [];
const socket = io(CORE_URL, { transports: ['websocket'] });
for (const event_name of ['call.hold', 'call.turn', 'call.command', 'call.transcript_delta', 'call.updated', 'call.ended']) {
  socket.on(event_name, (payload) => live_events.push({ event_name, payload, at_ms: Date.now() }));
}
await new Promise((resolve) => socket.on('connect', resolve));
socket.emit('join', { role: 'STAFF', staff_id: STAFF_ID });

const voice_status = await core.get('/voice/status');
log(`Voice status: live=${voice_status.is_live_available} model=${voice_status.language_model.model}`);
assert.ok(voice_status.is_live_available, `live voice unavailable: ${voice_status.unavailable_reason}`);

// Sarah's card starts ACTIVE (unlock it if an earlier run locked it is not
// possible through the api, so the check below compares before/after).
const overview_before = await api.get('/banking/customers/CUS-1001/overview');
const card_before = (overview_before.cards ?? []).find((card) => card.card_id === 'CRD-10011');
log(`CRD-10011 status before: ${card_before?.status}`);

const call = await core.post('/calls', { caller_number: SARAH_NUMBER, channel: 'BROWSER', mode: 'LIVE' });
const call_id = call.call_id;
log(`Call ${call_id} created`);
socket.emit('join', { role: 'PHONE', call_id, customer_id: 'CUS-1001' });

const session_started_ms = Date.now();
const voice_session = await core.post('/voice/sessions', { call_id });
log(`Voice session minted in ${Date.now() - session_started_ms} ms: room ${voice_session.room_name}, identity ${voice_session.identity}`);
check('session is for the customer identity in call_<id>', voice_session.identity === 'customer' && voice_session.room_name === `call_${call_id}`);

const phone = new SyntheticPhone();
await phone.join(voice_session.livekit_url ?? LIVEKIT_URL, voice_session.token);
const joined_at_ms = Date.now();

// Approve the identity push as soon as it appears (the customer taps Approve).
let approved_notification_id = null;
let hold_audio_heard = '';
const approval_loop = (async () => {
  while (phone.is_running && !approved_notification_id) {
    const notifications = await api.get(`/notifications?call_id=${call_id}`).catch(() => []);
    const pending = notifications.find((each) => each.kind === 'IDENTITY_CHECK' && each.status === 'SENT');
    if (pending) {
      // The caller takes a while to find the app: long enough for a hold
      // reminder and a "Thanks for holding." on return.
      phone.startRecording();
      await sleep(APPROVAL_DELAY_MS);
      hold_audio_heard = await transcribe(phone.stopRecording());
      log(`Phone heard while waiting for the approval: ${JSON.stringify(hold_audio_heard)}`);
      await api.post(`/notifications/${pending.notification_id}/response`, { response: 'APPROVED' });
      approved_notification_id = pending.notification_id;
      log(`Approved identity push ${pending.notification_id}`);
    }
    await sleep(500);
  }
})();

const readTurns = async () => (await core.get(`/calls/${call_id}`)).turns;
const aiTurnsAfter = async (seq) => (await readTurns()).filter((turn) => turn.speaker === 'AI' && turn.seq > seq);

// Greeting, then the model's personalised hello.
await waitUntil('the greeting audio', () => phone.audible_onsets.length > 0, 20_000);
log(`Greeting audio heard ${phone.audible_onsets[0] - joined_at_ms} ms after joining`);
await waitUntil('the opening reply', async () => (await readTurns()).filter((turn) => turn.speaker === 'AI').length >= 2);
await phone.waitForQuiet();
const opening_turns = await readTurns();
log(`Opening AI turns: ${opening_turns.filter((t) => t.speaker === 'AI').map((t) => JSON.stringify(t.text)).join(' | ')}`);
check('greeting recorded as the first AI turn', /AI specialist\. This call is recorded/.test(opening_turns.find((turn) => turn.speaker === 'AI')?.text ?? ''));
check('get_caller_context ran through the dispatcher', opening_turns.some((turn) => turn.tool_name === 'get_caller_context'));

const CUSTOMER_LINES = [
  "Hi, I think I've lost my debit card. Can you lock it for me please?",
  'Yes please, lock my debit card ending in four eight two one.',
  'Yes, go ahead and lock it now.',
  'Yes please.',
];

async function speakAndWaitForReply(line) {
  const turns_before = await readTurns();
  const last_seq = turns_before.at(-1)?.seq ?? 0;
  const pcm = await renderCallerLine(line);
  log(`Caller says: "${line}" (${(pcm.length / SAMPLE_RATE).toFixed(1)} s)`);
  const ended_at_ms = await phone.speak(pcm);
  const customer_turn = await waitUntil('the customer turn to be transcribed', async () =>
    (await readTurns()).find((turn) => turn.speaker === 'CUSTOMER' && turn.seq > last_seq),
  );
  const first_audio_ms = await waitUntil('the agent to answer', () => phone.firstAudioAfter(ended_at_ms));
  await waitUntil('an AI turn', async () => (await aiTurnsAfter(customer_turn.seq)).length > 0);
  await phone.waitForQuiet(2_500);
  const new_turns = (await readTurns()).filter((turn) => turn.seq > last_seq);
  const entry = {
    said: line,
    transcribed: customer_turn.text,
    end_of_speech_to_first_audio_client_ms: first_audio_ms - ended_at_ms,
    ai_turns: new_turns.filter((turn) => turn.speaker === 'AI').map((turn) => ({ text: turn.text, latency_ms: turn.latency_ms })),
    tools: new_turns.filter((turn) => turn.tool_name).map((turn) => ({ tool_name: turn.tool_name, args: turn.tool_args, ok: !turn.tool_result?.error })),
  };
  report.customer_turns.push(entry);
  log(`  transcribed: ${JSON.stringify(entry.transcribed)}; first agent audio ${entry.end_of_speech_to_first_audio_client_ms} ms after end of speech`);
  entry.ai_turns.forEach((turn) => log(`  AI: ${JSON.stringify(turn.text)} latency_ms=${turn.latency_ms}`));
  entry.tools.forEach((tool) => log(`  tool: ${tool.tool_name} ${JSON.stringify(tool.args)} ok=${tool.ok}`));
  return entry;
}

const isCardLocked = async () => {
  const overview = await api.get('/banking/customers/CUS-1001/overview');
  return (overview.cards ?? []).find((card) => card.card_id === 'CRD-10011')?.status === 'TEMP_LOCKED';
};

for (const line of CUSTOMER_LINES) {
  await speakAndWaitForReply(line);
  // A lookup may still be running (the identity push waits for the app).
  await sleep(1_000);
  if (await isCardLocked()) break;
}

const all_turns = await readTurns();
const customer_turns = all_turns.filter((turn) => turn.speaker === 'CUSTOMER');
const latency_turns = all_turns.filter((turn) => turn.speaker === 'AI' && turn.latency_ms !== null);
const hold_events = live_events.filter((event) => event.event_name === 'call.hold' && event.payload.call_id === call_id);
check('customer turns were transcribed into call_turns', customer_turns.length >= 1, `${customer_turns.length} turns`);
check('AI turns carry latency_ms', latency_turns.length >= 1, latency_turns.map((turn) => turn.latency_ms).join(', '));
check('call.hold start and end events were emitted', hold_events.some((e) => e.payload.is_on_hold) && hold_events.some((e) => !e.payload.is_on_hold && e.payload.ended_at), hold_events.map((e) => `${e.payload.is_on_hold ? 'start' : 'end'}:${e.payload.reason}:${e.payload.tool_name}`).join(', '));
const hold_line_turn = all_turns.find((turn) => turn.speaker === 'AI' && /place you on hold|check that for you|notification to your banking app|look that up|in the system now/.test(turn.text ?? ''));
const first_lookup = all_turns.find((turn) => turn.tool_name && !['get_caller_context', 'update_call_insight'].includes(turn.tool_name));
check('a hold line was played before a lookup', hold_line_turn && first_lookup && hold_line_turn.seq < first_lookup.seq, hold_line_turn ? JSON.stringify(hold_line_turn.text) : 'no hold line');
check('a hold reminder was heard while waiting for the app approval', /take your time|still here/i.test(hold_audio_heard), hold_audio_heard);
check('"Thanks for holding." after the long hold', all_turns.some((turn) => turn.speaker === 'AI' && turn.text === 'Thanks for holding.'));
const card_locked = await isCardLocked();
check('card CRD-10011 ends TEMP_LOCKED', card_locked);
if (!card_locked) {
  report.model_behaviour.push(`Tools called: ${all_turns.filter((t) => t.tool_name).map((t) => `${t.tool_name}(${JSON.stringify(t.tool_args)})`).join(', ')}`);
}
const call_after_tools = (await core.get(`/calls/${call_id}`)).call;
check('metrics.total_hold_ms recorded', (call_after_tools.metrics.total_hold_ms ?? 0) > 0, `${call_after_tools.metrics.total_hold_ms} ms`);

// ── Supervisor: INSTRUCTION ────────────────────────────────────────────────
await phone.waitForQuiet();
const seq_before_instruction = (await readTurns()).at(-1).seq;
const instruction = await core.post(`/calls/${call_id}/interventions`, {
  staff_id: STAFF_ID,
  type: 'INSTRUCTION',
  text: 'Remind the caller she can unlock the card any time in the app.',
});
await waitUntil('the instruction to be applied', async () =>
  (await readTurns()).some((turn) => turn.seq > seq_before_instruction && turn.text?.startsWith('Instruction applied:')),
);
const instructed_reply = await waitUntil('a reply after the instruction', async () =>
  (await aiTurnsAfter(seq_before_instruction))[0],
);
log(`AI after the instruction: ${JSON.stringify(instructed_reply.text)}`);
check('INSTRUCTION applied by the voice agent and answered', Boolean(instruction.intervention_id && instructed_reply));
await phone.waitForQuiet();

// ── Supervisor: TAKEOVER + STAFF_MESSAGE + HANDBACK ────────────────────────
const takeover_at_ms = Date.now();
await core.post(`/calls/${call_id}/interventions`, { staff_id: STAFF_ID, type: 'TAKEOVER' });
await waitUntil('the handover audio', () => phone.firstAudioAfter(takeover_at_ms), 20_000);
await phone.waitForQuiet();
const handover_turn = (await readTurns()).find((turn) => turn.speaker === 'AI' && /now speaking with Alex/.test(turn.text ?? ''));
check('TAKEOVER: handover line spoken in the AI voice', Boolean(handover_turn), handover_turn?.text);
const seq_during_takeover = (await readTurns()).at(-1).seq;

phone.startRecording();
const staff_message_at_ms = Date.now();
await core.post(`/calls/${call_id}/staff_messages`, {
  staff_id: STAFF_ID,
  text: 'Hi Sarah, this is Alex from the team. Your card is safely locked.',
});
await waitUntil('the staff message audio', () => phone.firstAudioAfter(staff_message_at_ms), 20_000);
await phone.waitForQuiet();
const staff_audio = phone.stopRecording();
const heard_staff_text = await transcribe(staff_audio);
log(`Phone heard during takeover: ${JSON.stringify(heard_staff_text)}`);
check('STAFF_MESSAGE heard as audio on the customer side', /alex/i.test(heard_staff_text), heard_staff_text);

await speakAndWaitForTakeoverTranscript();
async function speakAndWaitForTakeoverTranscript() {
  const pcm = await renderCallerLine('Thanks Alex, that is a relief.');
  await phone.speak(pcm);
  await waitUntil('the customer turn during the takeover', async () =>
    (await readTurns()).some((turn) => turn.speaker === 'CUSTOMER' && turn.seq > seq_during_takeover),
  );
  await sleep(4_000);
  const ai_during_takeover = (await aiTurnsAfter(seq_during_takeover));
  check('the agent stays silent while HUMAN_ACTIVE (keeps transcribing)', ai_during_takeover.length === 0, `${ai_during_takeover.length} AI turns`);
}

const seq_before_handback = (await readTurns()).at(-1).seq;
await core.post(`/calls/${call_id}/interventions`, {
  staff_id: STAFF_ID,
  type: 'HANDBACK',
  text: 'Customer is reassured. Confirm the card is locked and close warmly.',
});
const handback_reply = await waitUntil('the AI to resume after HANDBACK', async () =>
  (await aiTurnsAfter(seq_before_handback))[0],
);
log(`AI after the handback: ${JSON.stringify(handback_reply.text)}`);
check('HANDBACK: the AI resumes and answers', Boolean(handback_reply));
await phone.waitForQuiet();

// ── End of call ────────────────────────────────────────────────────────────
const ended_call = await core.post(`/calls/${call_id}/end`, { ended_by: 'CUSTOMER' });
check('call ended', ended_call.status === 'ENDED');
const env_values = readCoreEnv();
const room_service = new RoomServiceClient(LIVEKIT_URL.replace(/^ws/, 'http'), env_values.LIVEKIT_API_KEY, env_values.LIVEKIT_API_SECRET);
const is_room_gone = await waitUntil('the room to be deleted', async () =>
  !(await room_service.listRooms()).some((room) => room.name === `call_${call_id}`),
  10_000,
).catch(() => false);
check('the call room was deleted', is_room_gone);
await waitUntil('the phone to be disconnected', () => phone.is_disconnected, 10_000).catch(() => undefined);
check('the phone was disconnected by the room deletion', phone.is_disconnected);

const final_call = (await core.get(`/calls/${call_id}`)).call;
if (process.env.E2E_EXPECT_REALTIME === '1') {
  const customer_deltas = live_events.filter(
    (event) => event.event_name === 'call.transcript_delta' && event.payload.call_id === call_id && event.payload.speaker === 'CUSTOMER',
  );
  check('live caption deltas for the CUSTOMER arrived while transcribing', customer_deltas.length > 0, `${customer_deltas.length} deltas`);
  const usage = final_call.metrics.usage ?? {};
  check('realtime voice token usage recorded', (usage.tts_output_audio_tokens ?? 0) > 0, JSON.stringify(usage));
  check('transcription seconds recorded', (usage.stt_audio_seconds ?? 0) > 0, String(usage.stt_audio_seconds));
  if (process.env.E2E_EXPECT_DRIFT === '1') {
    check('voice drift counted (fake server altered a line)', (final_call.metrics.tts_drift_count ?? 0) >= 1, String(final_call.metrics.tts_drift_count));
  }
}
report.call_id = call_id;
report.metrics = final_call.metrics;
report.hold_events = hold_events.map((event) => event.payload);
report.approved_notification_id = approved_notification_id;
report.transcript = (await readTurns()).map((turn) =>
  turn.tool_name ? `SYSTEM tool ${turn.tool_name}` : `${turn.speaker}: ${turn.text}${turn.latency_ms !== null ? ` [${turn.latency_ms} ms]` : ''}`,
);

await phone.leave();
await approval_loop.catch(() => undefined);
socket.close();
await dispose();

console.log('\n===== REPORT =====');
console.log(JSON.stringify(report, null, 2));
const failed_checks = report.checks.filter((each) => !each.ok);
console.log(`\n${report.checks.length - failed_checks.length}/${report.checks.length} checks passed`);
process.exit(failed_checks.length === 0 ? 0 : 1);
