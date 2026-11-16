# core: phone calls and AI logic

NestJS 10 service on port 3001 (prefix `/core`, socket.io on the same port). It owns calls, turns, supervisor interventions, the model's tools, voice session minting, the call simulator and the scripted hero calls. It never reads the `bank` schema: banking data, policy decisions and cases come from the `api` service over HTTP.

## Run

```bash
bun install
cp .env.example .env      # optional: every key has a default
bun run start             # http://localhost:3001/core/health
```

Needs the root compose stack (Postgres on 5433, Redis on 6380) and the `api` service on `API_INTERNAL_URL` (default `http://localhost:3002`). No OpenAI key is needed: without one, Scripted mode and the simulator work and `GET /core/voice/status` reports `is_live_available: false`.

```bash
bun run build
bun run lint
bun run test
```

## Layout

| Folder | What lives there |
| --- | --- |
| `src/calls` | calls, turns, metrics, end-of-call summary |
| `src/call_tools` | the tool registry (one list for the voice session and the dispatcher), argument validation, handlers |
| `src/interventions` | monitor, whisper, take over, hand back, end call, typed staff messages |
| `src/live` | socket.io gateway, Redis `live_events` subscriber, internal event bus |
| `src/voice` | OpenAI Realtime client secret minting. `src/voice/README.md` is the guide for the browser side |
| `src/simulator` | server-side simulated calls from `simulations/*.json` |
| `src/scripted_calls` | serves `scripted_calls/*.json` to the phone client |
| `src/call_scripts` | script format, loader and `{{placeholder}}` resolver shared by both |
| `src/engine_api` | the one HTTP client to the `api` service |
| `src/prompts`, `prompts/voice_agent.md` | the agent instructions (database row is live, file is the reviewed copy) |
| `src/database`, `src/audit`, `src/config`, `src/shared_kernel`, `src/health` | plumbing |
