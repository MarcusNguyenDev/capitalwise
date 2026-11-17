# Decisions and assumptions

Everything here was decided without asking, as the build prompt instructed.
Where the prompt and the owner's later instructions disagreed, the owner's
instructions won.

## Stack (overrides the build prompt)

| The prompt said | What was built | Why |
| --- | --- | --- |
| ASP.NET Core `core` with Dapper | Two NestJS services, `core` and `api`, with `pg` and raw SQL | The owner asked for NestJS, with `core` holding the phone call and AI logic and `api` holding the API |
| SignalR | socket.io gateway in `core` | The NestJS equivalent |
| `/web`, React + Vite | `app/`, Next.js 16 (already scaffolded in the repo) | Kept the existing front-end folder |
| Postgres 16, database `mockbank`, port 5432 | The repo's existing `db` service: Postgres 18, database `capitalwise`, host port 5433 | Kept the existing infrastructure and its credentials |
| One compose file for db, core and web | The repo's layout: a compose file per service sharing the `capitalwise` project, plus `start.sh` | Matches `.claude/skills/create-container` |
| `core/Prompts/voice-agent.md`, `core/Simulations/*.json` | `core/prompts/voice_agent.md`, `core/simulations/*.json` | `coding_standard.md` requires snake_case files and folders |

## How `core` and `api` are split

- **`api` (port 3002, prefix `/api`)** is the system of record and the
  deterministic decision pipeline: the `CoreBankingAdapter` (the only code
  that touches schema `bank`), fact builder, policy engine, case builder,
  router, executor, notifier, approvals, audit, explainability, resources,
  compare and demo reset.
- **`core` (port 3001, prefix `/core`)** is the conversation runtime: calls,
  transcript turns, the model's tools, supervisor interventions, OpenAI
  the LiveKit voice agent and AI providers, prompts, the simulator, the scripted hero calls
  and the live socket gateway.
- `core` never queries `bank`. Its tools call `api` over HTTP
  (`API_INTERNAL_URL`). This keeps "the AI proposes" and "policy decides" in
  different processes: nothing in the AI runtime can write to the bank.
- `api` publishes live events on Redis channel `live_events`; `core`
  subscribes and fans them out over socket.io. Redis was already in the repo's
  compose file.
- Everything is snake_case end to end (database columns, DTO properties, JSON
  keys), so there is no case mapping layer. This also follows the coding
  standard's rule for variables.

## Coding standard and NestJS conventions

- `coding_standard.md` wins over NestJS's default names: files are
  `snake_case` with a dot suffix (`policy_engine.service.ts`,
  `decide_case.dto.ts`, `case_not_found.error.ts`), variables and properties
  are `snake_case`, functions are `camelCase`.
- React components and hooks are functions, but React requires `PascalCase`
  components and `use` prefixed hooks, so components follow the standard's
  class rule and hooks stay `useThing`.
- Next.js requires `page.tsx`, `layout.tsx` and `globals.css`, and route
  groups such as `(console)`; those names are kept.
- Feature modules, thin controllers, injectable services, SQL in repository
  providers, DTOs validated by `class-validator`, typed config through
  `registerAs`, custom error classes carrying an `error_code`, and a global
  exception filter returning `{ status_code, error_code, message }`.

## Database

- `engine.cases` has two columns beyond the prompt's list, `required_skill`
  and `routing_rule`, so the Resources page can show which rule routed each
  escalation.
- `engine.autonomy_proposals` was added to record "promote to Tier 1"
  proposals. Recording or signing one off never changes a live policy.
- `bank.v_income_rolling` was added next to `v_income_monthly`. Hardship
  income loss compares the last 30 days with the average 30 days across the
  90 days before that. Calendar months shift under data that is reseeded
  relative to `now()`, which would make the demo flaky near month end.
- A `HUMAN_CALLBACK` policy (`POL-HUMAN_CALLBACK-1`, always escalate) was
  seeded so "I want a person" goes through the same policy engine and audit
  trail as every other action.
- Staff have a fourth skill, `CARE`, held by Sam Patel and the team leader.
  Vulnerability concerns route to it.
- Each of the 11 pending cases has a seeded AI-handled call with a transcript,
  so case packs show a transcript excerpt and Call replay has material before
  the first demo call.
- Seeded phone numbers use ACMA's reserved fiction numbers, which include the
  0491 570 to 0491 579 ranges.
- "Yesterday 6:42pm" for Sarah's cafe purchase is computed in
  `Australia/Brisbane` time.
- Extra simulator customers `CUS-3001` to `CUS-3004` are designed so their
  fee refunds do not match RF-3, which keeps the batch at exactly 8 cases
  whenever the simulator has run first.
- `engine.audit_events.occurred_at` for trigger-written rows uses the row's
  own timestamp, so the 70 seeded historical cases have a believable audit
  history.

## Product behaviour

- Staff identity is the header's staff switcher (default Alex Chen). There is
  no authentication, as the prompt put it out of scope.
- `request_human` and `flag_concern` create Tier 3 cases (`HUMAN_CALLBACK`, or
  `RELEASE_HELD_PAYMENT` when a payment is held) so they appear in the
  escalations rail with an assigned specialist and an audit trail.
- The router's load is live supervised calls plus escalated cases. Pending
  Tier 2 approvals do not count, otherwise Jordan's 11 seeded refunds would
  make him unavailable for calls.
- Releasing a held payment is possible only as a staff decision by someone
  with the FRAUD skill. The AI path can only ever escalate it.
- Rejecting a `RELEASE_HELD_PAYMENT` case means "keep it held", which matches
  the policy's recommendation of DECLINE, so it counts as agreement in the
  autonomy statistics.
- Call summaries, the "Explain to customer" text and SMS wording are
  deterministic templates. No model is involved after the call's own turns,
  which keeps explanations reproducible and the demo offline-capable.
- In the simulator the identity push is approved automatically after about
  two seconds. In Scripted and Live mode the presenter taps Approve on the
  phone.

## Voice (revised: self-hosted pipeline over LiveKit)

- **OpenAI Realtime was removed** as too expensive. `core` runs its own loop
  instead: energy-based voice activity detection, speech-to-text, a chat model
  with tools, and text-to-speech, all through one `AiService`
  (`core/src/ai/ai.service.ts`) with one provider file per backend (`ollama`,
  `vllm`, `openai`, `speaches`). Which provider serves chat, speech-to-text
  and text-to-speech is set in `core/.env`.
- **The Ollama provider uses Ollama's native `/api/chat`**, not its
  OpenAI-compatible endpoint, because the native API's `think: false` is the
  reliable way to turn thinking off. In testing, the compatibility
  endpoint's `reasoning_effort: none` was ignored by `qwen3:4b`, which then
  never called a tool.
- **LiveKit carries all call audio** (phone, voice agent, staff listen-in and
  takeover talk). The earlier peer connection signalled over socket.io is
  gone. LiveKit runs in Docker with `--node-ip=127.0.0.1`, which was tested to
  carry audio between the host and containers and between containers.
- **Speaches** (Whisper and Kokoro behind an OpenAI-compatible API) is the
  default speech server, in the root compose file, because it runs on CPU
  with no setup. On this machine's CPU it transcribed 5.6 s of speech in about
  2.4 s and spoke 5.6 s in about 1.3 s.
- **The chat model is not part of the stack.** The owner hosts it (planned:
  `gpt-6:luna` on Ollama) and sets `OLLAMA_BASE_URL`; until then Live voice
  reports itself unavailable with the reason. A throwaway Ollama with
  `qwen3:4b-instruct` was used for testing only.
- **Hold messages, the greeting and the handover line are deterministic**,
  pre-rendered at startup in both voices, so they play instantly and say the
  same thing every time. Prompt version 1.2 tells the model not to announce
  its own lookups and to write plain speakable sentences. The scripted hero
  calls and simulations use the same wording.
- **Typed staff replies during a takeover** are spoken by `core` in a second
  voice in Live mode, so the phone does not need speech synthesis there.
  Scripted mode still speaks them in the browser.
- **The opening is quick:** the greeting plays as soon as the agent joins,
  `get_caller_context` runs automatically, and the model's prompt is
  pre-warmed in the background, so the first model reply does not pay a
  cold-start cost.
- **Speech-to-text runs one request at a time per call.** If more than three
  utterances are waiting, new ones are dropped and logged. After a provider
  error the caller hears an apology at most once every 20 seconds, and a human
  is requested at most once per call. This came from a test where looping
  microphone audio flooded the CPU speech server.
- **There is no server-side echo cancellation.** The phone relies on the
  browser's echo cancellation, and the energy-based voice detection treats
  steady noise as speech. A headset is best for a live demo.
- The phone page on a second device needs `MEDIA_NODE_IP` set to the LAN IP,
  and https (or a browser flag) for the microphone. Scripted mode has no such
  requirement.
- Web fonts are system fonts, not downloaded ones, so the app renders the
  same without a network.

## Configuration

- **Each folder owns its configuration and secrets** (`api/.env`,
  `core/.env`, `app/.env`); no service reads `../.env`. The root `.env` is
  only for infrastructure containers. Values the containers are created with
  (database and cache credentials, the LiveKit key and secret) are therefore
  written in two places, the root file and the service's own file, and each
  `.env.example` says which values must match.
- There is no JWT authentication: staff identity is still the header's
  switcher, as the build prompt put authentication out of scope. The only
  JWTs are LiveKit access tokens, signed by `core` with
  `LIVEKIT_API_SECRET`.

## Decision pipeline details (`api`)

- `POLICY_EVALUATED` is written by actor `SYSTEM / policy-engine`. The AI
  actor and the rule id appear together on `CASE_CREATED`, and
  `ACTION_EXECUTED` carries the AI actor for Tier 1.
- Expected wait for an escalation is `1 + the specialist's current load`
  minutes.
- `flag_concern` does not require a verified caller. An unknown caller gets a
  `HUMAN_CALLBACK` case under customer `UNKNOWN`.
- After a concern is flagged, open cases on the call are re-evaluated with the
  stored hard facts plus the new soft signals. A case can only move up to
  Tier 3, never down.
- A hardship arrangement starts on the loan's next repayment date and ends
  that many months later.
- "Edit and approve" can change only the refund amount (up to the fee) or the
  hardship arrangement type and months (1 to 24).
- A notification response is accepted only for an identity check that is
  still waiting.
- An autonomy proposal is refused unless the action is eligible (at least 90%
  agreement over at least 30 decisions, and reversible), so on seeded data
  only fee refunds can be proposed.
- Dashboard "today" means the last 24 hours, so the numbers do not empty at
  midnight during a demo.
- Amounts given to the model for held payments and the last card transaction
  are positive. Ledger rows stay signed.
- `api/config/compare_journey.json` is re-read on every request, so step
  durations can be edited while the app is running. The optional "a human
  joins" step is shown but not counted in the AI journey's total.
- Locking a card the caller does not own is rejected (`CARD_NOT_OWNED`); it
  does not create an escalation.

## Conversation runtime details (`core`)

- Tool arguments the tool does not define are dropped, not rejected. A
  `customer_id` sent by the model is ignored: the customer always comes from
  the call.
- `propose_action` does not accept `HUMAN_CALLBACK`. The model must use
  `request_human`.
- The identity push waiter listens for the live event and also polls the
  notification every 1.5 seconds, in case a Redis message is missed.
- Ending a call replaces the running summary with a deterministic one built
  from the intent, identity status and cases raised.
- Handing back clears the attention reason and keeps the assigned staff
  member and the risk level.
- In the simulator, waits for a human (instruction, takeover) use real
  seconds at any speed; only speaking pace and pauses scale. A takeover
  pauses a simulated script wherever it is.
- A whisper to a simulated call that has no scripted reaction is logged but
  not marked applied, because no model is there to act on it. Ava Kowalski's
  call is the one that reacts.
- Simulated AI turns carry a random 420 to 800 ms response time so the KPI
  has values before any live call.
- Cost per call is estimated from chat tokens, speech-to-text seconds and
  text-to-speech characters, using prices in `core/.env` that default to 0
  for self-hosted models.

## Web app details

- Batch approve always records reason code "Meets policy"; the confirm dialog
  says so.
- A decided case stays at the top of the approval queue for 12 seconds as a
  "just decided" row, then leaves.
- Call replay runs at 4x and shortens silences longer than 8 seconds.
- The audit log shows the latest 150 records.

## Identity and self-service (revised after owner feedback)

- **The original brief's "caller ID plus app push" was dropped as the main
  method.** The owner's test case is a 90-year-old on a landline or a basic
  phone, who has no app. Identity is now confirmed in conversation:
  - **Level 1:** name, date of birth and postcode.
  - **Level 2:** one dynamic question about the customer's own recent activity.

  The server checks every answer; the AI never sees the expected values. The
  app push remains an optional level-1 method.
- **Step-up, not one gate.** Level 1 allows only protective actions (lock or
  block a card, a statement to the address on file, a callback) and a reduced
  overview with no balances or card digits. Everything that reads account
  details or changes something needs level 2. This stops someone who knows a
  victim's basic details from getting the AI to read out the level-2 answers.
- **Lockout to fraud.** Two failed attempts at a level lock the call and raise
  a Tier 3 case for a fraud specialist. The caller is never told which answer
  was wrong.
- **Customer resolution by answers.** Caller ID is a hint only. If the answers
  match exactly one customer, the call is bound to them: a landline not on
  file, or a spouse on a shared number.
- **The AI completes the job.** The design rule for every new policy: AUTO when
  the action is protective or customer-favourable and checkable against the
  bank's own data; a person when a mistake could move money, hand the account
  to someone else, or harm a vulnerable customer. New self-service actions:
  - card: report lost or stolen, replace, unlock, activate;
  - money: fee refunds (REFUND_FEE v4 promotes the first small refund to
    Tier 1, the earned-autonomy story); duplicate-charge disputes with a
    provisional credit up to $500; short payment arrangements;
  - servicing: statements, preferences (paper, SMS alerts, large-print
    letters).

  Policy escalates:
  - security-sensitive changes;
  - a replacement card when the address changed in the last 30 days;
  - large or unrecognised charges;
  - hardship, which a person decides, as the law expects;
  - anything involving scam or vulnerability signs.
- **A policy can decline on the spot** (`AUTO_DECLINED`, for example a third
  fee refund in a year). The caller hears why and is offered a specialist
  review, instead of waiting for a person to say no.
- **Customers have addresses and postcodes;** dates of birth are fixed dates
  so identity answers are stable across reseeds.
- **A crib card on the simulated phone (demo mode only).** Whoever plays the
  caller sees that customer's name, date of birth and postcode during the
  call, and on tap the address and the answers to the level-2 questions (last
  pay or pension, shops where the card was used this week, loan repayment,
  card digits). It comes from `GET /api/demo/callers/:customer_id/details`,
  which answers 403 `DEMO_MODE_DISABLED` unless `DEMO_MODE=true`. It is the
  only route that returns identity answers. `core` never calls it, so the AI
  still cannot see the answers.
