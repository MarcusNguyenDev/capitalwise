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
  Realtime session minting, prompts, the simulator, the scripted hero calls
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

## Voice

- No OpenAI key was available while building, so Live mode is implemented
  but was not run end to end. Scripted mode and the simulator cover the
  acceptance test.
- Scripted hero calls are replayed by the phone page with the browser's
  `speechSynthesis`, through the same call, turn, tool, policy, notification
  and audit pipeline as a live call.
- The phone page on a second device needs HTTPS (or `localhost`) for the
  browser to allow microphone access. Scripted mode has no such requirement.
- Web fonts are system fonts, not downloaded ones, so the app renders the
  same without a network.

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
- Usage sent from the browser separates cached from non-cached input tokens,
  and cost uses the per-token prices in `core/.env`.
- The OpenAI Realtime API was checked against the official documentation
  while building and is written up in `core/src/voice/README.md`. The docs'
  newest examples name `gpt-realtime-2.1`; the default here is `gpt-realtime`
  as the build prompt specified. Model, voice, transcription model and prices
  are all environment settings.

## Web app details

- Batch approve always records reason code "Meets policy"; the confirm dialog
  says so.
- A decided case stays at the top of the approval queue for 12 seconds as a
  "just decided" row, then leaves.
- Call replay runs at 4x and shortens silences longer than 8 seconds.
- The audit log shows the latest 150 records.
