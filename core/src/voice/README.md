# Live voice: core's speech pipeline over LiveKit

All call audio (customer phone, AI agent, staff) goes through **LiveKit** (`media`). The AI side of a LIVE call is a **voice agent inside core**: it joins the call's room like any participant, listens to the customer, and speaks back. core orchestrates the whole conversation (turn detection, the language model and its tools, hold lines, supervisor controls); no speech-to-speech model ever decides what is said. It runs its own loop

```
customer mic ─► LiveKit ─► voice agent: turn detection (VAD) ─► speech-to-text ─► language model + tools ─► text-to-speech ─► LiveKit ─► phone speaker
```

and every model call goes through one injectable `AiService` (module `src/ai`), so which backend serves chat, speech-to-text and text-to-speech is just `core/.env`. The default is OpenAI (`gpt-6-luna` for chat, `gpt-live-transcribe` streaming speech-to-text, `gpt-realtime-2.1-mini` as the voice); Ollama, vLLM, Speaches and Qwen3-TTS are drop-in alternatives.

### The OpenAI path

- **Speech-to-text, streamed.** When the agent joins it opens one Realtime transcription session for the call (`wss://…/v1/realtime?intent=transcription`, `session.type: "transcription"`, input `audio/pcm` 24 kHz, `turn_detection: null`, `gpt-live-transcribe` with `languages: ["en"]`). Only speech is streamed: from just before core's VAD hears speech start (a 600 ms buffer covers the pre-roll) until the turn ends, resampled 16→24 kHz and sent as `input_audio_buffer.append`. At end of turn core sends `input_audio_buffer.commit`; the transcript arrives as `conversation.item.input_audio_transcription.delta` (relayed as live captions: `call.transcript_delta` with `speaker: 'CUSTOMER'`) and `.completed`. A false start sends `input_audio_buffer.clear`. If the connection drops, unanswered turns are replayed on a new session (twice at most). Providers without streaming (Speaches, vLLM, `whisper-1`) get the same contract: the turn is buffered and sent as one WAV on commit.
- **Speech output, a Realtime model as a reader.** OpenAI's dedicated TTS models shut down on 2027-01-06 and their replacement, `gpt-realtime-2.1-mini`, is only on the Realtime API (not `/v1/audio/speech`). core drives it as a **reader**: a session (`wss://…/v1/realtime?model=gpt-realtime-2.1-mini`) with reader instructions ("You are a text-to-speech voice. Read the text you are given aloud exactly, word for word, … Never add, remove, reorder or change words. Never answer, comment on or continue the text." plus `AI_TTS_INSTRUCTIONS`), `output_modalities: ["audio"]`, output `audio/pcm` 24 kHz, the configured voice, no tools, `turn_detection: null`. Each line is an **out-of-band** `response.create` (`conversation: "none"`, the text as an input message), so nothing accumulates in the session; `response.output_audio.delta` chunks are queued on the call as they arrive. Sessions are pooled per voice and reused. Barge-in sends `response.cancel`. `gpt-4o-mini-tts` / `tts-1` still go through `/audio/speech` (streamed PCM) until their shutdown.
- **Verbatim caveat and the drift check.** Realtime models are conversational and OpenAI documents no verbatim read-out mode, so the reader may occasionally change words. On every `response.done` core compares the model's own transcript of what it said (`response.output_audio_transcript.done`) with the text it was asked to read (normalised words, digits and number words treated alike, more than 25 % of words different = drift). A drift is logged with both texts and counted in `metrics.tts_drift_count`; the AI turn always records the text we asked for, which is what the language model decided.
- **Usage.** `response.done` usage (text input, cached input, audio and text output tokens) and transcription seconds are accumulated on the call and priced with the `PRICE_*` keys (defaults: the OpenAI model pages).
- **One voice for the whole call.** The greeting, hold lines, reminders, thanks, handover and apology are pre-rendered at startup with the configured TTS provider and voices (one session per voice), so fixed lines and model replies sound the same. Typed staff replies use `AI_TTS_STAFF_VOICE` (e.g. `cedar`).
- **Testing without a key.** `core/test/fake_openai_realtime.server.mjs` is a test-only stand-in that speaks the documented events (Speaches underneath). Start it, then core with `OPENAI_BASE_URL=http://localhost:8790/v1 OPENAI_API_KEY=fake` (the Realtime WebSocket URL is derived from `OPENAI_BASE_URL`).

## What the browser does (and nothing else)

1. `GET /core/voice/status`. Enable "Live" only when `is_live_available` is true; otherwise show `unavailable_reason` (e.g. "Chat provider ollama is not configured. Set OLLAMA_BASE_URL in core/.env.").
2. `POST /core/calls` `{ caller_number, channel: 'BROWSER', mode: 'LIVE' }`, then socket `join` `{ role: 'PHONE', call_id, customer_id }`.
3. `POST /core/voice/sessions` `{ call_id }` → `{ room_name, livekit_url, token, identity: 'customer' }`. This also starts the voice agent for the call.
4. Join the room with `livekit-client`: `room.connect(livekit_url ?? 'ws://' + location.hostname + ':7880', token)`, call `room.startAudio()` from the click that started the call (autoplay policy), **publish the microphone** with echo cancellation, noise suppression and auto gain on, and **attach every remote audio track** to an `<audio autoplay>` element. The AI's voice, staff speaking after a takeover and typed staff replies all arrive as remote audio.
5. Show captions from socket `call.turn` (final turns) and `call.transcript_delta` (`speaker: 'AI'`, streamed while the AI speaks). Show "On hold" from `call.hold`. On `call.command` only update the UI (human joined banner, ended): in LIVE mode core acts on the commands itself.
6. **Type instead of speaking** (optional, no microphone or a noisy room): `POST /core/calls/:call_id/customer_messages` `{ text }` (1 to 500 characters) → `202 { is_accepted: true }`. The voice agent treats the line exactly like a transcribed utterance without speech-to-text: it interrupts the AI if it is speaking, records and emits the CUSTOMER turn (so it arrives as `call.turn` like speech), answers it unless the call is `HUMAN_ACTIVE` or a cost guard stopped the AI, and counts it as caller activity for the idle timer. Errors: `404 CALL_NOT_FOUND`, `409 CALL_ENDED`, `409 CALL_NOT_LIVE` (a Scripted call), `409 VOICE_AGENT_NOT_RUNNING` (no agent listening yet, or it stopped).
7. Hang up: disconnect and `POST /core/calls/:call_id/end` `{ ended_by: 'CUSTOMER' }`. When a call ends by any path core deletes the room, which disconnects every participant.

The browser never talks to a model, never relays transcripts and never runs tools.

Dashboards: `POST /core/voice/staff_tokens` `{ call_id, staff_id, can_publish }` → `{ room_name, livekit_url, token, identity: 'staff_<id>' }`. `can_publish: false` = listen in (any staff, any time). `can_publish: true` = talk; only while the call is `HUMAN_ACTIVE` and assigned to that staff member (else `409 STAFF_CANNOT_PUBLISH`).

Errors: `503 LIVE_VOICE_UNAVAILABLE` (LIVE call, live not available: the message contains the reason), `503 MEDIA_UNAVAILABLE` (LiveKit down: also blocks SCRIPTED sessions and staff tokens), `503 VOICE_AGENT_START_FAILED`, `404 CALL_NOT_FOUND`, `409 CALL_ENDED`. Offer Scripted mode on any of them.

## Rooms and identities

| | |
| --- | --- |
| Room | `call_<call_id>`, one per call, created on first join, deleted when the call ends (`/end`, END_CALL, customer gone > 10 s, no customer within 30 s, demo reset) |
| `customer` | the phone (publish + subscribe), name = the customer's name |
| `ai_specialist` | the core voice agent, one 24 kHz mono track, name "AI specialist" |
| `staff_<staff_id>` | a dashboard, name = the staff member's name |

## What can spend money, and the guards

With the OpenAI setup these code paths make paid requests; nothing else does.

| Code path | When | Paid for |
| --- | --- | --- |
| Voice agent, chat (`AiService.chat`, Chat Completions) | each model reply of a LIVE call (opening, each customer turn, up to 4 tool rounds, instructions, handback) | gpt-6-luna tokens |
| Voice agent, transcription session (one WebSocket per LIVE call) | opened when the agent joins, closed when the call ends; audio is sent only while the caller speaks | gpt-live-transcribe minutes of streamed speech |
| Voice agent, reader sessions (per LIVE call, closed when the call ends) | each sentence of a model reply and each typed staff message | gpt-realtime-2.1-mini tokens |
| Phrase rendering (greeting, hold lines, goodbyes, handover lines) | only when a phrase is not yet in `core/.cache/phrase_audio` (first startup, a new voice/model/text, or a new staff name in the handover line); one one-off session at a time per voice | gpt-realtime-2.1-mini tokens |
| Try-it endpoints `POST /core/ai/chat`, `/core/ai/transcriptions`, `/core/ai/speech` | only when someone calls them | per request |

Never paid: reachability probes (`GET /models` only, cached 15 s, behind `/core/ai/status` and `/core/voice/status`), Scripted and simulated calls (no model, no WebSocket: the tool dispatcher only), the prompt warm-up (sent only to self-hosted chat backends, never to OpenAI), LiveKit.

Guards (`core/.env`):
- `AI_MAX_CALL_COST_USD` (1.00): once a call's estimated cost passes it, the agent stops generating, says "Sorry, I'm having trouble with that. Let me get someone from our team to help." (a cached phrase) and calls `request_human`. It keeps transcribing, so staff can still read along.
- `AI_MAX_LIVE_CALL_MINUTES` (15): the agent says a short goodbye and ends the call (`ended_by: SYSTEM`).
- `AI_IDLE_HANGUP_SECONDS` (90): if the caller says nothing while the agent has nothing in progress, it says a goodbye and ends the call. It never counts while a staff member has the call or the caller is on hold.
- Connections are per call: the transcription session and reader sessions belong to one LIVE call and close when it ends (any path, including demo reset). One-off renders open a session for that one request.
- Phrase audio is cached on disk, so restarts do not render the ~44 fixed phrases (22 lines in two voices) again.
- Provider error messages are scrubbed of anything that looks like a key or bearer token before they are logged or returned; no code logs request headers.

## The voice agent's loop (one per LIVE call, `src/voice_agent`)

1. **Join** as `ai_specialist`, publish its track, open the call's transcription stream, and warm the model's prompt cache (system prompt + tools, up to 120 s for a cold self-hosted model). No customer audio within 30 s: the call is ended (`SYSTEM`).
2. **Opening**: plays the pre-rendered greeting "Hello, you've reached {BANK_NAME}'s AI specialist. This call is recorded." (an AI turn), runs `get_caller_context` through the normal tool dispatcher, waits for the warm-up to finish (so the two requests never race on a cold model), then lets the model greet the caller by name.
3. **Listen**: the customer's track at 16 kHz goes through an energy VAD with an adaptive noise floor (`src/turn_detection`): speech starts after `VAD_SPEECH_START_MS` (200) above `VAD_ENERGY_THRESHOLD_RATIO` (3) × the noise floor, the turn ends after `VAD_END_OF_TURN_SILENCE_MS` (700) of silence, minimum 300 ms of speech, maximum 30 s, 300 ms of pre-roll kept.
4. **Barge-in**: if the caller starts talking while the AI is replying, the queued audio is cleared, the model and TTS requests are aborted, and the AI turn is recorded with only what was heard plus " …". Hold lines, the greeting and staff speech are never cut.
5. **Transcribe** (streamed while the caller speaks, committed at end of turn, results recorded in order): empty, punctuation-only, bracketed (`[BLANK_AUDIO]`) and known Whisper hallucinations on very short audio are dropped. The CUSTOMER turn is recorded and emitted (`call.turn`). A line the caller typed on the phone (`POST /core/calls/:call_id/customer_messages`) joins here, after any utterance still being transcribed, and is handled the same way, barge-in included.
6. While the call is `HUMAN_ACTIVE` the agent only transcribes.
7. **Think**: streamed chat with the active prompt version (`{BANK_NAME}` filled in), the last 30 messages, supervisor instructions as `system` messages ("Supervisor instruction: ..."), and the single tool registry (`src/call_tools/constants/tool_definitions.constant.ts`).
8. **Speak while streaming**: text is cut into sentences (or a clause at ~120 characters), markdown and symbols are removed, each chunk is synthesised in order (chunk N+1 renders while N plays) through `AiService.synthesizeStream`, and its audio is queued on the track piece by piece as the voice produces it (10 ms frames). `call.transcript_delta` is emitted as text streams. One AI turn is recorded per reply with `latency_ms` = end of the caller's speech → first audio of the answer (also appended to `metrics.response_times_ms`).
9. **Tools with a hold buffer** (`src/hold_buffer`): `get_caller_context` and `update_call_insight` are silent; `send_identity_push` plays "I've just sent a notification to your banking app. Please tap Approve when you see it, and I'll wait on the line."; every other tool plays "Thank you for that. I'll need to place you on hold for a moment while I check the system. I'll be right back with you." (a shorter rotating variant if the full line was heard in the last 30 s). While the tools run: a reminder every `HOLD_REMINDER_INTERVAL_MS` (max 3) and, with `HOLD_TONE_ENABLED`, a soft two-note tone between lines. A hold longer than `HOLD_RETURN_THRESHOLD_MS` ends with "Thanks for holding.". `call.hold` start/end events are emitted and `metrics.hold` / `metrics.total_hold_ms` updated. At most 4 tool rounds per customer turn, then a fallback line.
10. **Supervisor commands** (internal event bus, not the socket): INSTRUCTION (added and answered at once if the agent is idle, then marked applied), TAKEOVER (stops, plays a chime and "You're now speaking with <first name> from our team." in the AI voice, goes silent), STAFF_MESSAGE (spoken in the staff voice `AI_TTS_STAFF_VOICE` on the agent's track; the turn is recorded by the endpoint), HANDBACK (the note becomes an instruction, marked applied, the AI resumes), END_CALL.
11. **Usage**: `llm_input_tokens`, `llm_cached_input_tokens`, `llm_output_tokens`, `stt_audio_seconds`, `tts_characters`, `tts_input_tokens`, `tts_cached_input_tokens`, `tts_output_audio_tokens`, `tts_output_text_tokens` are accumulated on the call (`metrics.usage`), plus `metrics.tts_drift_count`; `estimated_cost_usd` uses the `PRICE_*` variables (set them to 0 when self-hosted).
12. **Failures**: any provider error during a turn plays "Sorry, I'm having trouble with that. Let me get someone from our team to help." (at most once per 20 s) and calls `request_human` once. Nothing crashes the process; logs carry the call id and stage. Each answered turn logs `Turn timing call=… end_of_speech_to_first_audio_ms=… stt_ms=… llm_first_token_ms=… tts_first_chunk_ms=…`.

At startup core stamps `engine.ai_agents.model` with `<AI_CHAT_PROVIDER>/<AI_CHAT_MODEL>` (again after a demo reset) and pre-renders the fixed phrases in both voices.

## The `ai` module (`src/ai`)

```
ai/
  ai.module.ts                     registers the providers in one map
  ai.service.ts                    AiService: chat / transcribe / openTranscriptionStream / synthesize / synthesizeStream / getStatus / listModels
  ai.controller.ts, ai_playground.service.ts   try-it endpoints
  providers/
    ai_provider.ts                 abstract AiProvider (the shared contract) + AI_PROVIDER_REGISTRY token
    openai_compatible.provider.ts  shared base for OpenAI-style APIs (not registered itself)
    ollama.provider.ts             Ollama native /api/chat (NDJSON, think: false), /api/tags
    vllm.provider.ts               chat (+ enable_thinking=false), Whisper transcriptions, vLLM-Omni speech (Qwen3-TTS)
    openai.provider.ts             chat, streaming transcription (Realtime), speech (Realtime reader or /audio/speech)
    speaches.provider.ts           transcriptions + speech (Whisper, Kokoro, Piper)
  wire/                            NDJSON/SSE readers, stream decoders, <think> filter, idle watchdog, WAV/PCM decoding,
                                   Realtime socket, transcription stream, reader + pool, drift check, default streams
  types/  dto/  errors/
```

Shared structures (snake_case): `ChatRequest { model?, messages, tools?, temperature?, max_output_tokens?, abort_signal? }`; `chat()` yields `{ type: 'text_delta', text }`, `{ type: 'tool_call', tool_call_id, name, arguments }` (complete, parsed) and `{ type: 'done', finish_reason, usage }`; `transcribe({ audio: wav Buffer, model?, language?, prompt? }) → { text, duration_seconds, provider, model }`; `synthesize({ text, model?, voice?, speed?, instructions?, sample_rate? }) → { pcm: Int16Array, sample_rate, provider, model, voice }`; `synthesizeStream(same) → SpeechStream` (async iterable of PCM chunks + `summary: { spoken_transcript, is_drifted, usage, … }`); `openTranscriptionStream({ model?, language?, prompt? }) → TranscriptionStream { appendAudio(pcm, sample_rate), commit(): Promise<TranscriptionResult>, clear(), onDelta(listener), close() }`. Every provider gets the streams: the defaults wrap `transcribe()` / `synthesize()`. Providers hide the wire differences (NDJSON vs SSE, tool call ids Ollama may omit, argument strings vs objects, `<think>` blocks, `reasoning` fields, WAV parsing and resampling).

The chat timeout (`AI_CHAT_TIMEOUT_MS`) is an **idle** timeout: it restarts on every streamed chunk.

**One server per capability.** `AI_CHAT_BASE_URL`, `AI_STT_BASE_URL` and `AI_TTS_BASE_URL` (optional) point one capability at its own server; empty means the provider's own `*_BASE_URL`. A capability URL alone is enough to count the provider as configured for that capability, and `/core/ai/status` probes that server. It only applies to the provider configured for the capability (a try-it request that picks another provider uses that provider's URL). This is what vLLM needs, because one vLLM server runs one model.

**Tone instructions.** `AI_TTS_INSTRUCTIONS` is sent as `instructions` to providers that accept it (vLLM-Omni, OpenAI); `POST /core/ai/speech` takes `instructions` to override it for one request. Speaches never receives it.

**Sample rates.** WAV answers carry their rate in the header; raw PCM answers are read from `Content-Type: audio/pcm; rate=…` or `x-sample-rate` (24 kHz only if undeclared). Audio is resampled to the 24 kHz the agent's track uses.

### Example: Qwen3-TTS on your GPU with vLLM-Omni

vLLM-Omni serves an OpenAI-compatible `POST /v1/audio/speech` (`model`, `input`, `voice`, `response_format`, `speed`, `instructions`, and `stream: true` with `stream_format: "audio"` for audio bytes as they decode) and `GET /v1/audio/voices`.

```
AI_CHAT_PROVIDER=ollama
AI_CHAT_MODEL=gpt-6:luna
OLLAMA_BASE_URL=http://gpu-box:11434

AI_TTS_PROVIDER=vllm
AI_TTS_MODEL=Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice      # the model the TTS server serves (GET <url>/models)
AI_TTS_AI_VOICE=vivian                                 # GET <url>/audio/voices lists the voices
AI_TTS_STAFF_VOICE=ryan
AI_TTS_SPEED=1.0                                       # streaming needs speed 1.0
AI_TTS_INSTRUCTIONS=Warm, calm, reassuring bank specialist. Natural pace.
AI_TTS_BASE_URL=http://gpu-box:8091/v1
```

The vLLM provider asks for a streamed WAV (`stream: true`, `stream_format: "audio"`, `response_format: "wav"`, so the rate comes from the header) when the speed is 1.0, and falls back to one plain WAV request if the server answers 4xx or the speed is not 1.0. core still waits for each sentence's audio to finish before queuing it, so streaming mostly saves the server's buffering today; per-sentence chunks keep the first audio short. Try a voice before switching:

```bash
curl -X POST localhost:3001/core/ai/speech -H 'content-type: application/json' -D - -o qwen.wav \
  -d '{"provider":"vllm","model":"Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice","voice":"vivian","text":"Thanks for holding.","instructions":"Warm and calm."}'
```

(A try-it request with `provider: vllm` uses `AI_TTS_BASE_URL` only when vLLM is also the configured TTS provider; otherwise it uses `VLLM_BASE_URL`.)

### Adding a provider

1. Create `src/ai/providers/<name>.provider.ts`: an `@Injectable()` class extending `AiProvider` (or `OpenAiCompatibleProvider` for an OpenAI-style API) with `provider_name`, `capabilities`, `configuration_hint`, `isConfigured()`, `listModels()` and the capabilities it supports.
2. Add `<name>` to `AI_PROVIDER_NAMES` (`types/ai_provider_name.type.ts`), the class to `AI_PROVIDER_CLASSES` in `ai.module.ts`, and its connection keys to `src/config/ai.config.ts`.
3. Point `AI_CHAT_PROVIDER` / `AI_STT_PROVIDER` / `AI_TTS_PROVIDER` at it.

A capability a provider does not offer throws `AI_CAPABILITY_NOT_SUPPORTED`; a wrong route in `.env` is logged at startup and reported by `/core/ai/status` and `/core/voice/status`, never fatal.

### Auditioning models and voices (no restart)

```bash
curl localhost:3001/core/ai/status                                   # per capability: provider, model, reachable, detail
curl localhost:3001/core/ai/providers/speaches/models                # { models: [...] }
curl -X POST localhost:3001/core/ai/speech -H 'content-type: application/json' \
  -d '{"text":"Thanks for holding.","voice":"bf_isabella","speed":1.05}' -D - -o line.wav   # x-latency-ms, x-provider, x-model
curl -X POST localhost:3001/core/ai/transcriptions -F file=@line.wav -F model=Systran/faster-whisper-small.en
curl -X POST localhost:3001/core/ai/chat -H 'content-type: application/json' \
  -d '{"provider":"ollama","model":"qwen3:1.7b","messages":[{"role":"user","content":"Say hi"}]}'   # text, tool_calls, usage, latency_ms, first_token_ms
```

Every try-it request accepts `provider` (and `model`, `voice`) to override `core/.env` for that one request. Once happy, put the choice in `core/.env` and restart.

## Configuration (`core/.env`, see `core/.env.example`)

`AI_CHAT_BASE_URL` / `AI_STT_BASE_URL` / `AI_TTS_BASE_URL` (optional per-capability servers), `AI_TTS_INSTRUCTIONS`; `LIVEKIT_URL` (how core reaches LiveKit), `LIVEKIT_PUBLIC_URL` (browser-facing; empty = `ws://<page host>:7880`), `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` (= root `MEDIA_API_KEY` / `MEDIA_API_SECRET`); `AI_CHAT_*`, `AI_STT_*`, `AI_TTS_*` (provider, model, voices, speed, timeouts); `OLLAMA_*`, `VLLM_*`, `OPENAI_*`, `SPEACHES_*` connections; `VAD_*`; `HOLD_*`; `PRICE_*`.

Use a non-thinking (instruct) chat model: a thinking model adds seconds of silence before every answer.

## Socket events added

`call.hold` (rooms `staff`, `call:<id>`): `{ call_id, is_on_hold, reason: 'CHECKING_SYSTEM' | 'WAITING_FOR_APP_APPROVAL', tool_name, started_at, ended_at }`. Scripted and simulated calls get the same events from the tool dispatcher. `call.transcript_delta` from the voice agent goes to `staff` and `call:<id>`. The `webrtc_signal` relay is gone.
