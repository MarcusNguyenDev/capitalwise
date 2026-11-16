# Live voice: what the phone client must do

`core` mints a short-lived OpenAI Realtime client secret. The browser (the `/phone` page) then talks to OpenAI directly over WebRTC and relays what happens to `core`. The OpenAI API key never leaves `core`.

Everything below was checked against the official OpenAI docs on 2026-11-16 (Realtime GA API):

- WebRTC guide: https://developers.openai.com/api/docs/guides/realtime-webrtc
- Conversations guide: https://developers.openai.com/api/docs/guides/realtime-conversations
- Client secrets reference: https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create
- Client events: https://developers.openai.com/api/reference/resources/realtime/client-events
- Server events: https://developers.openai.com/api/reference/resources/realtime/server-events

There is no OpenAI key on the build machine, so none of this has run against the real API. The server side is unit tested with a mocked HTTP call. Treat the browser flow as verified against the docs, not against a live session.

## 1. Check availability

`GET /core/voice/status` returns `{ "is_live_available": false, "model": "gpt-realtime", "voice": "marin" }`.

When `is_live_available` is `false` (no `OPENAI_API_KEY`), offer Scripted mode only. `POST /core/voice/sessions` answers `503 LIVE_VOICE_UNAVAILABLE` in that case, and `502 VOICE_SESSION_MINT_FAILED` when OpenAI refuses or cannot be reached. Show the "use Scripted mode" toast for both.

## 2. Start a call and mint the session

1. `POST /core/calls` with `{ "caller_number": "+61491570156", "channel": "BROWSER", "mode": "LIVE" }`. Keep `call_id`.
2. Socket: `join` with `{ "role": "PHONE", "call_id": "...", "customer_id": "..." }`.
3. `POST /core/voice/sessions` with `{ "call_id": "..." }`. The response:

```json
{
  "client_secret": "ek_...",
  "expires_at": "2026-11-16T03:10:00.000Z",
  "model": "gpt-realtime",
  "voice": "marin",
  "instructions": "You are the AI phone specialist for Demo Bank. ...",
  "tools": [{ "type": "function", "name": "get_caller_context", "description": "...", "parameters": { "type": "object", "properties": {}, "required": [], "additionalProperties": false } }]
}
```

`expires_at` is an ISO timestamp (OpenAI returns Unix seconds; core converts it). The secret lives 10 minutes and only needs to be valid when the SDP exchange starts. `instructions` and `tools` are returned for display and debugging: they are already baked into the session, so the browser does not send them again.

What core sends to OpenAI (`POST https://api.openai.com/v1/realtime/client_secrets`, `Authorization: Bearer <OPENAI_API_KEY>`):

```json
{
  "expires_after": { "anchor": "created_at", "seconds": 600 },
  "session": {
    "type": "realtime",
    "model": "gpt-realtime",
    "instructions": "...",
    "output_modalities": ["audio"],
    "tools": [],
    "tool_choice": "auto",
    "audio": {
      "input": {
        "noise_reduction": { "type": "near_field" },
        "transcription": { "model": "gpt-4o-mini-transcribe", "language": "en" },
        "turn_detection": {
          "type": "server_vad",
          "threshold": 0.5,
          "prefix_padding_ms": 300,
          "silence_duration_ms": 500,
          "create_response": true,
          "interrupt_response": true
        }
      },
      "output": { "voice": "marin" }
    }
  }
}
```

OpenAI answers `{ "value": "ek_...", "expires_at": 1756310470, "session": { ... } }`. The secret is the top-level `value`.

## 3. SDP exchange (browser)

```ts
const peer_connection = new RTCPeerConnection();

const audio_element = document.createElement('audio');
audio_element.autoplay = true;
peer_connection.ontrack = (event) => (audio_element.srcObject = event.streams[0]);

const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
peer_connection.addTrack(microphone.getTracks()[0]);

// The label must be exactly "oai-events".
const data_channel = peer_connection.createDataChannel('oai-events');

const offer = await peer_connection.createOffer();
await peer_connection.setLocalDescription(offer);

const sdp_response = await fetch('https://api.openai.com/v1/realtime/calls', {
  method: 'POST',
  body: offer.sdp,
  headers: {
    Authorization: `Bearer ${client_secret}`,
    'Content-Type': 'application/sdp',
  },
});
await peer_connection.setRemoteDescription({ type: 'answer', sdp: await sdp_response.text() });
```

All events travel as JSON strings on the data channel: `data_channel.send(JSON.stringify(event))` and `data_channel.onmessage = (message) => JSON.parse(message.data)`.

The prompt tells the model to open the call itself. When the data channel opens, send `{ "type": "response.create" }` once so the AI speaks first instead of waiting for the caller.

## 4. Server events to handle

| Event | Fields you need | What to do |
| --- | --- | --- |
| `input_audio_buffer.speech_started` | `item_id` | The caller started talking. With server VAD the model's audio is interrupted for you. |
| `input_audio_buffer.speech_stopped` | `item_id` | Start the response-time stopwatch. |
| `conversation.item.input_audio_transcription.delta` | `item_id`, `delta` | Socket `transcript_delta` `{ call_id, speaker: 'CUSTOMER', delta, item_id }`. Update the caption. |
| `conversation.item.input_audio_transcription.completed` | `item_id`, `transcript` | `POST /core/calls/:call_id/turns` `{ speaker: 'CUSTOMER', text: transcript }`. Skip empty transcripts. |
| `response.created` | `response.id` | Mark the AI as busy (see whisper below). |
| `output_audio_buffer.started` | `response_id` | WebRTC only: first AI audio is playing. Stop the stopwatch: that is `latency_ms` for this AI turn. |
| `response.output_audio_transcript.delta` | `item_id`, `delta` | Socket `transcript_delta` `{ call_id, speaker: 'AI', delta, item_id }`. |
| `response.output_audio_transcript.done` | `item_id`, `transcript` | `POST /core/calls/:call_id/turns` `{ speaker: 'AI', text: transcript, latency_ms }`. Also sent for an interrupted response, with the partial transcript. |
| `response.function_call_arguments.done` | `call_id`, `name`, `arguments` (JSON string) | Run the tool through core (section 5). Note: this `call_id` is OpenAI's function call id, not our call id. |
| `response.done` | `response.status`, `response.output[]`, `response.usage` | Mark the AI as idle. Report usage (section 8). Send any pending tool outputs (section 5). |
| `output_audio_buffer.stopped` / `.cleared` | `response_id` | The AI finished or was cut off. |
| `error` | `error.type`, `error.code`, `error.message` | Log it. If the data channel or peer connection closes, show the toast offering Scripted mode. |

Transcription arrives asynchronously, so a caller's completed transcript can land after the AI already started answering. Order turns in the UI by the event order, not by `seq`, if that matters to you. Do not rely on input transcription deltas arriving in small pieces: depending on the transcription model, the whole text can arrive in a single delta just before `completed`.

## 5. Function calls

The model's tools are executed by core, never in the browser.

1. On `response.function_call_arguments.done`, immediately call
   `POST /core/calls/:call_id/tools/:name` with `{ "args": JSON.parse(arguments) }`.
   It always answers HTTP 200 with `{ "ok": true, "result": {...} }` or `{ "ok": false, "error": { "code", "message" } }` (404 only for an unknown call, 409 for an ended call). Core writes the tool turn and emits `call.turn` itself: do not post a turn for it.
2. Give the whole JSON body back to the model, success or failure. The error message is written for the model and tells it what to do next:

```json
{
  "type": "conversation.item.create",
  "item": {
    "type": "function_call_output",
    "call_id": "<the call_id from the function call event>",
    "output": "{\"ok\":true,\"result\":{\"verified\":true}}"
  }
}
```

3. Then send `{ "type": "response.create" }` so the model speaks about the result.

Two things to get right:

- Send `response.create` only when no response is in progress. A response that contains a function call ends with `response.done` almost immediately, so the safe pattern is: start the HTTP call on `arguments.done`, and once BOTH the HTTP call has returned AND `response.done` has arrived for that response, send the `function_call_output` item(s) followed by ONE `response.create`. If a response holds several function calls, send all outputs first, then a single `response.create`.
- `send_identity_push` blocks for up to 45 seconds while the customer taps Approve on the phone mockup (`POST /api/notifications/:notification_id/response`). The model has already said its filler line. If the caller speaks during the wait, server VAD starts a new response by itself; when the tool result arrives, wait for that response's `response.done` before sending the output and `response.create`.

## 6. Supervisor whisper (`call.command` INSTRUCTION)

The phone receives `call.command` `{ call_id, command: 'INSTRUCTION', text, staff_id, staff_name, intervention_id }` on the socket.

1. Inject it as a system message, prefixed exactly `Supervisor instruction: ` (the prompt keys on this prefix):

```json
{
  "type": "conversation.item.create",
  "item": {
    "type": "message",
    "role": "system",
    "content": [{ "type": "input_text", "text": "Supervisor instruction: Show extra empathy and mention the National Debt Helpline" }]
  }
}
```

2. If the AI is idle (no response between `response.created` and `response.done`, and the caller is not speaking), send `{ "type": "response.create" }` so the instruction takes effect now. If it is busy, do nothing more: the item is already in the conversation and shapes the next response.
3. Confirm to core: `POST /core/calls/:call_id/interventions/:intervention_id/applied`. Core writes the `INSTRUCTION_APPLIED` audit event and the staff-only "Instruction applied: ..." transcript line. It is idempotent.

Never show or speak the instruction to the caller. Instructions cannot bypass policy: every action still goes through core's tools and the api's policy engine.

## 7. Takeover and handback

**`call.command` TAKEOVER** (`text` = "You're now speaking with Alex from our team"):

1. Stop the AI: if a response is in progress send `{ "type": "response.cancel" }`, then `{ "type": "output_audio_buffer.clear" }` (WebRTC only) to cut the audio already buffered.
2. Turn automatic responses off but keep transcription running:

```json
{
  "type": "session.update",
  "session": {
    "type": "realtime",
    "audio": { "input": { "turn_detection": { "type": "server_vad", "create_response": false, "interrupt_response": false } } }
  }
}
```

   `session.update` changes only the fields you send; `type: "realtime"` is required in every update. Voice and model cannot be changed mid-session.
3. Mute the model's audio element (`audio_element.muted = true`) as a second guard, play the handover tone, and speak `text` with `speechSynthesis`.
4. Keep relaying `conversation.item.input_audio_transcription.completed` as CUSTOMER turns so the supervisor sees what the caller says. Do not send `response.create` and do not execute tools while a human has the call.
5. Staff audio arrives on a separate peer connection, signalled with the socket `webrtc_signal` message (`sender: 'STAFF'` is relayed to the phone's `call:<id>` room, `sender: 'PHONE'` to `staff`). The typed fallback arrives as `call.command` STAFF_MESSAGE: speak `text` with `speechSynthesis` in a different voice, labelled with `staff_name`.

**`call.command` HANDBACK** (`text` = the staff member's one-line note):

1. Unmute the audio element and turn automatic responses back on (same `session.update` with `create_response: true, interrupt_response: true`).
2. Inject the note exactly like a whisper (`Supervisor instruction: <text>`), then send `{ "type": "response.create" }` so the AI picks the call back up.
3. Confirm with `POST /core/calls/:call_id/interventions/:intervention_id/applied` (accepted for HANDBACK as well as INSTRUCTION).

**`call.command` END_CALL**: close the peer connection and stop the microphone. Core has already ended the call.

When the caller hangs up: close the peer connection and `POST /core/calls/:call_id/end` with `{ "ended_by": "CUSTOMER" }` (idempotent).

## 8. Metrics

- Response time: milliseconds from `input_audio_buffer.speech_stopped` to the next `output_audio_buffer.started`. Send it as `latency_ms` on the AI turn. (`POST /core/calls/:call_id/metrics` also accepts `response_time_ms`; use one or the other for a turn, not both, or it is counted twice.)
- Cost: on every `response.done`, post the usage of that response. Core accumulates it and recomputes `estimated_cost_usd` from the configured per-million prices.

`response.usage` looks like:

```json
{
  "total_tokens": 1500, "input_tokens": 1200, "output_tokens": 300,
  "input_token_details": {
    "text_tokens": 400, "audio_tokens": 800, "cached_tokens": 600,
    "cached_tokens_details": { "text_tokens": 300, "audio_tokens": 300 }
  },
  "output_token_details": { "text_tokens": 60, "audio_tokens": 240 }
}
```

`input_token_details.text_tokens` and `.audio_tokens` INCLUDE the cached tokens, and cached tokens are billed at their own cheaper rate, so subtract them:

```ts
const input_details = usage.input_token_details ?? {};
const cached_details = input_details.cached_tokens_details ?? {};
await fetch(`/core/calls/${call_id}/metrics`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    usage: {
      input_text_tokens: (input_details.text_tokens ?? 0) - (cached_details.text_tokens ?? 0),
      input_audio_tokens: (input_details.audio_tokens ?? 0) - (cached_details.audio_tokens ?? 0),
      cached_input_tokens: input_details.cached_tokens ?? 0,
      output_text_tokens: usage.output_token_details?.text_tokens ?? 0,
      output_audio_tokens: usage.output_token_details?.audio_tokens ?? 0,
    },
  }),
});
```

Input transcription is billed separately (the `usage` on the `...transcription.completed` event) and is not part of this estimate.

## 9. Things that differ from older Realtime examples

- GA event names: `response.output_audio_transcript.*` and `response.output_audio.*` (the beta used `response.audio_transcript.*` and `response.audio.*`).
- The session object needs `type: "realtime"`, and audio settings live under `session.audio.input` / `session.audio.output` (voice is `audio.output.voice`, transcription is `audio.input.transcription`).
- The SDP exchange goes to `/v1/realtime/calls` with the ephemeral secret. No `OpenAI-Beta` header and no `?model=` query: the model comes from the session bound to the secret.
- The docs' current examples name a newer model (`gpt-realtime-2.1`) and transcription model (`gpt-transcribe`). The contract's defaults (`gpt-realtime`, `gpt-4o-mini-transcribe`) are still accepted values; change `OPENAI_REALTIME_MODEL` / `OPENAI_TRANSCRIPTION_MODEL` in `core/.env` to switch, and update the price variables to match the model you pick.
