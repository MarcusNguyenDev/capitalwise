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
| `ollama` | native `/api/chat`, thinking off | | |
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
| `src/call_tools` | the tool registry (one list for the model and the dispatcher), argument validation, handlers, hold events for scripted calls |
| `src/interventions` | monitor, whisper, take over, hand back, end call, typed staff messages |
| `src/live` | socket.io gateway, Redis `live_events` subscriber, internal event bus |
| `src/simulator` | server-side simulated calls from `simulations/*.json` |
| `src/scripted_calls` | serves `scripted_calls/*.json` to the phone client |
| `src/call_scripts` | script format, loader and `{{placeholder}}` resolver shared by both |
| `src/engine_api` | the one HTTP client to the `api` service |
| `src/prompts`, `prompts/voice_agent.md` | the agent instructions (database row is live, file is the reviewed copy, version 1.3; core warns at startup if they differ) |
| `src/database`, `src/audit`, `src/config`, `src/shared_kernel`, `src/health` | plumbing |
