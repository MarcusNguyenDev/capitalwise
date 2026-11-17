# core: phone calls and AI logic

NestJS 10 service on port 3001 (prefix `/core`, socket.io on the same port). It owns calls, turns, supervisor interventions, the model's tools, the **live voice agent** (our own speech pipeline over LiveKit), the AI provider layer, the call simulator and the scripted hero calls. It never reads the `bank` schema: banking data, policy decisions and cases come from the `api` service over HTTP.

## Run

```bash
bun install
cp .env.example .env      # then fill in DB/CACHE/LIVEKIT secrets to match the root .env
bun run start             # http://localhost:3001/core/health
```

core reads **only `core/.env`** (never `../.env`). It needs the root compose stack: Postgres (5433), Redis (6380), LiveKit `media` (ws://localhost:7880), Speaches `speech` (http://localhost:8000/v1), and the `api` service on `API_INTERNAL_URL`.

Live voice needs its three AI capabilities. The default `core/.env` is the owner's OpenAI setup (chat `gpt-6-luna`, streaming speech-to-text `gpt-live-transcribe`, voice `gpt-realtime-2.1-mini` read as a reader with voices `marin` / `cedar`): it only needs `OPENAI_API_KEY`. Without a usable provider, Scripted mode and the simulator still work and `GET /core/voice/status` explains why live is unavailable. To run fully self-hosted without editing `.env` (what the shared dev instance on :3001 uses):

```bash
OLLAMA_BASE_URL=http://localhost:11434 AI_CHAT_PROVIDER=ollama AI_CHAT_MODEL=qwen3:4b-instruct \
AI_STT_PROVIDER=speaches AI_STT_MODEL=Systran/faster-whisper-small.en \
AI_TTS_PROVIDER=speaches AI_TTS_MODEL=speaches-ai/Kokoro-82M-v1.0-ONNX AI_TTS_AI_VOICE=bf_emma AI_TTS_STAFF_VOICE=bm_george \
bun run start
```

| Provider | Chat | Speech-to-text | Text-to-speech |
| --- | --- | --- | --- |
| `openai` | Chat Completions (`gpt-6-luna`, reasoning effort `none` for tools) | streaming: one Realtime transcription session per call (`gpt-live-transcribe`, `gpt-transcribe`, `gpt-realtime-whisper`); `whisper-1` per file | `gpt-realtime…` as a reader over a Realtime session (streamed, drift-checked); `gpt-4o-mini-tts` / `tts-1` via `/audio/speech` (shut down 2027-01-06) |
| `ollama` | native `/api/chat`, thinking off, context `OLLAMA_CONTEXT_TOKENS` (default 16384: Ollama's own 4096 is smaller than prompt 1.4 plus the tools) | | |
| `vllm` | OpenAI-compatible chat | Whisper per turn | vLLM-Omni `/audio/speech` (Qwen3-TTS), streamed WAV |
| `speaches` | | Whisper per turn | Kokoro / Piper |

In Docker (`docker compose up -d` in this folder) the compose file overrides the hosts with the in-network ones (`db`, `cache`, `api`, `media`, `speech`); an Ollama on the host is `http://host.docker.internal:11434`.

```bash
bun run build
bun run lint
bun run test                              # unit tests (jest)
node test/live_voice_caller.e2e.mjs       # live end-to-end: a synthetic caller over LiveKit (needs the full stack)
node test/fake_openai_realtime.server.mjs # TEST ONLY: a stand-in for the OpenAI Realtime API (port 8790, uses Speaches)
```

Cost guards for live calls (`AI_MAX_CALL_COST_USD`, `AI_MAX_LIVE_CALL_MINUTES`, `AI_IDLE_HANGUP_SECONDS`, the on-disk phrase cache) and the list of code paths that can spend money are in `src/voice/README.md`.

## Switching models and providers

Each capability is routed to a provider in `core/.env`: `AI_CHAT_PROVIDER` / `AI_CHAT_MODEL`, `AI_STT_PROVIDER` / `AI_STT_MODEL`, `AI_TTS_PROVIDER` / `AI_TTS_MODEL` / `AI_TTS_AI_VOICE` / `AI_TTS_STAFF_VOICE`, with providers `ollama | vllm | openai | speaches` and their connection keys (`OLLAMA_BASE_URL`, `VLLM_BASE_URL`, `OPENAI_API_KEY`, `SPEACHES_BASE_URL`, ...). Audition first with the try-it endpoints (`/core/ai/status`, `/core/ai/providers/:name/models`, `/core/ai/chat`, `/core/ai/transcriptions`, `/core/ai/speech`), then set the values and restart. Details and how to add a provider: `src/voice/README.md`.

## Layout

| Folder | What lives there |
| --- | --- |
| `src/ai` | `AiService` (chat, transcribe, streaming transcription, synthesize, streaming speech) and one provider per backend (OpenAI, Ollama, vLLM, Speaches), try-it endpoints |
| `src/voice` | `/core/voice/status`, customer sessions, staff tokens. `src/voice/README.md` is the guide to the pipeline and the browser side |
| `src/voice_agent` | one in-process voice agent per LIVE call: listen, transcribe, think, speak, barge-in, supervisor commands |
| `src/turn_detection` | energy VAD with an adaptive noise floor |
| `src/hold_buffer` | hold policy, hold phrases, tool hold classes, pre-rendered phrase audio, tones |
| `src/livekit` | token minting, room service (availability, deletion), room clean-up when calls end |
| `src/audio` | WAV encode/decode, resampling, framing, tone generation |
| `src/calls` | calls, turns, metrics (usage, cost, hold state), end-of-call summary |
| `src/call_tools` | the tool registry (one list for the model and the dispatcher), argument and per-action param validation, handlers (identity checks, lookups, actions), hold events for scripted calls |
| `src/interventions` | monitor, whisper, take over, hand back, end call, typed staff messages |
| `src/live` | socket.io gateway, Redis `live_events` subscriber, internal event bus |
| `src/simulator` | server-side simulated calls from `simulations/*.json` |
| `src/scripted_calls` | serves `scripted_calls/*.json` to the phone client |
| `src/call_scripts` | script format, loader and `{{placeholder}}` resolver shared by both |
| `src/engine_api` | the one HTTP client to the `api` service |
| `src/prompts`, `prompts/voice_agent.md` | the agent instructions (database row is live, file is the reviewed copy, version 1.5; core warns at startup if they differ) |
| `src/database`, `src/audit`, `src/config`, `src/shared_kernel`, `src/health` | plumbing |

## Conversation and identity (prompt 1.4)

The greeting asks for the caller's full name. `get_caller_context` is only a hint (`{ is_known_number }`); the model never uses a name before identity level 1. Identity is confirmed in conversation, just in time and only to the level the task needs, through the api (core never sees the expected answers):

| Tool | What it does |
| --- | --- |
| `start_identity_check { level: 1 \| 2 }` | `POST /api/identity/challenges`. Level 1: full name, date of birth, postcode. Level 2 (after level 1): two questions about the caller's own recent activity, ask one, offer the other. Returns `challenge_id`, `questions [{ question_id, kind, prompt }]`, `guidance`. A level the call already has is answered without a new challenge. `LEVEL_ONE_REQUIRED`, `NO_DYNAMIC_QUESTION_AVAILABLE` and `IDENTITY_LOCKED` come back as `ok:false` with a message written for the model. |
| `submit_identity_answers { challenge_id, answers: [{ question_id, answer }] }` | `POST /api/identity/challenges/:id/answers`. On a pass core writes `engine.calls` (customer_id, customer_name, identity_level, identity_method, identity_verified, verified_at, `metrics.time_to_identity_ms` of the first confirmation) and emits `call.updated` BEFORE returning `{ is_passed, identity_level, first_name }`. On a lock: `is_identity_locked`, `NEEDS_ATTENTION`, risk `HIGH`, the staff member of the api's fraud case. A failed attempt never says which answer was wrong. |
| `send_app_identity_check` | The old push, optional and only when the caller asks: level 1, method `APP_PUSH`. |

Level 1 only protects: `get_customer_overview` (a reduced view, `is_reduced_view: true`, no balances or card digits), `lock_card`, and the actions `LOCK_CARD`, `REPORT_LOST_STOLEN`, `REQUEST_STATEMENT`, `SERVICE_REQUEST`. Reading details (`get_recent_transactions`, `get_fee_history`, `get_income_summary`, `get_loan_details`, `get_held_payments`) and every other action need level 2. Core checks the tool's level before calling the api, and every account read sends `?call_id=` so the api checks the verified caller itself. The api's other identity gates (`IDENTITY_LOCKED`, `VERIFIED_CALLER_MISMATCH`, `CUSTOMER_NOT_VERIFIED_CALLER`) also come back as `ok:false` with a message for the model. `propose_action` accepts every action code in `src/call_tools/constants/proposable_action_codes.constant.ts` (the description the model sees is built from that list: params and identity level per code), validates the params per code (codes and numbers are normalised, e.g. `"lost"` → `LOST`), and the api enforces the level each action needs: its `403 IDENTITY_LEVEL_REQUIRED` becomes `ok:false` with `IDENTITY_LEVEL_REQUIRED` and "Confirm identity to level 2 first: call start_identity_check with level 2.". `lock_card` stays as a shortcut for `LOCK_CARD`.

**Scripts and identity values.** The seeded dates of birth and postcodes are fixed values in `db/02_seed.sql`, so the scripts say them as plain text ("14th of September 1992", "4220"); `shipped_call_scripts.spec.ts` parses the seed and fails if a script's name, date of birth or postcode stops matching its customer (and checks that the impostor in `failed_identity` matches nobody). Question and challenge ids come from the tool results (`{{start_identity_check.questions.1.question_id}}`), and level 2 lines ask the api's own prompt (`{{start_identity_check.questions.0.prompt}}`). The api offers level 2 questions in a fixed order (last income first, then a recent card merchant), so the scripted answers are the seeded last pay or pension (said without a thousands separator, or in words) and, for Sarah, who cannot remember her pay, Pulse Gym Cafe. Core drops thousands separators from answers ("$4,200" → "$4200") because the api's amount parser reads the comma as two numbers. Tool arguments are placeholder-resolved by the simulator (as by the phone).

**Simulations** (start order): balance query, frustrated caller routed to Jordan, card left at a restaurant (temporary lock), fee refund that waits for a whisper, confused elderly caller (vulnerability), landline caller not on file (identity resolves by answers, statement by post), failed identity (locked after two attempts, fraud case), fee refund plus a replacement card that a specialist confirms after a recent move. `POST /core/simulator/start` accepts 1 to 8 calls.

