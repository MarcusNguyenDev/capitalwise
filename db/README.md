# Database

Postgres, created from three SQL files that run in name order the first time
the `db` container starts (they are mounted into `/docker-entrypoint-initdb.d`):

| File | What it does |
| --- | --- |
| `01_schema.sql` | Drops and recreates both schemas, tables, constraints, the audit triggers and `bank.recalculate_balances()` |
| `02_seed.sql` | Personas (fixed dates of birth, addresses, contact preferences), 60 to 130 days of background transactions, staff, AI agents, prompts, the action registry with identity levels, versioned policies, 11 pending cases, 70 historical decided cases, one signed-off autonomy proposal |
| `03_views.sql` | Read models for the adapter and the supervisor console |

## Two schemas

**`bank`** is a mock core banking system. It stands in for what a bank
already runs: products, customers (with street address, postcode and when the
address last changed), accounts, cards (`ACTIVE`, `INACTIVE`, `TEMP_LOCKED`,
`BLOCKED_LOST`, `BLOCKED_STOLEN`, `CANCELLED`), card orders, payees, devices,
an append-only transaction ledger, loans, hardship arrangements, payment
arrangements, disputes, statement requests, customer contact preferences,
customer flags and contact history.

**`engine`** is the product: AI agents, prompt versions, staff, the action
registry (with `required_identity_level` per action), versioned policies,
calls (with `identity_level`, `identity_method`, `is_identity_locked`, written
by `core`), identity challenges and attempts (written by `api`), call turns,
supervisor interventions, cases, notifications, the audit ledger and autonomy
proposals.

There are **no foreign keys from `engine` into `bank`**. Engine rows keep
reference ids (`customer_id`, `fee_txn_id`) plus snapshots (`customer_name`).
In code, the `api` service's `CoreBankingAdapter` is the only thing that
reads or writes `bank`. That is the seam where a real bank API plugs in.

Conventions:

- Money is `numeric(14,2)` from the customer's point of view: positive in,
  negative out. Loans and credit cards carry negative balances.
- Ids are text with readable prefixes (`CUS-1001`, `ACC-10011`, `CRD-10011`,
  `CASE-001101`).
- Every seed timestamp is relative to `now()`, so the data is always fresh.
- Phone numbers are from ACMA's list of numbers reserved for fiction. BSBs
  start with the fictional prefix `999`.
- The ledger is append-only. A refund is a new `FEE_REFUND` row whose
  `reverses_txn_id` points at the original `FEE`; a provisional dispute
  credit is a `DISPUTE_CREDIT` row reversing the disputed charge.
- Dates of birth are fixed dates (not relative to `now()`), because callers
  confirm their identity with them.

## Identity (contract v3)

Callers confirm who they are in conversation, only to the level the task
needs. `api` checks the answers; the AI never sees the expected values.

| Level | Asked | Unlocks |
| --- | --- | --- |
| 0 | nothing | `HUMAN_CALLBACK` |
| 1 | full name, date of birth, postcode | account reads, `LOCK_CARD`, `REPORT_LOST_STOLEN`, `REQUEST_STATEMENT`, `SERVICE_REQUEST` |
| 2 | level 1 plus one question about the customer's own recent activity (last pay or pension amount within 10% or $50, a card merchant in the last 7 days, the last four digits of a card, a loan repayment within 10%) | everything else |

`engine.identity_attempts` is the record: one row per submitted attempt (kind
of questions, passed or not, resolved customer), never the answers. Two failed
attempts at one level lock the call and raise a Tier 3 `HUMAN_CALLBACK` case
for the FRAUD skill. The optional app push still exists and grants level 1.

| Persona | Date of birth | Postcode | Level 2 questions offered (expected answer) |
| --- | --- | --- | --- |
| CUS-1001 Sarah Mitchell | 14 September 1992 | 4220 (Burleigh Heads) | last pay ($3,180 salary), card merchant (Pulse Gym Cafe, Harvest Lane Foods, Bean There Cafe, ...) |
| CUS-1002 Daniel Okafor | 21 June 1985 | 4215 (Southport) | last pay ($4,210), card merchant (Harvest Lane Foods, The Daily Grind, Reelhouse) |
| CUS-1003 Priya Sharma | 8 March 1989 | 4226 (Robina) | last Centrelink payment ($793.60 JobSeeker), card merchant |
| CUS-1004 Margaret Collins | 3 March 1948 | 4221 (Palm Beach) | last pension ($1,144.40), card merchant |
| CUS-1005 Tom Barker | 9 October 1981 | 4211 (Nerang) | last pay ($5,120), card merchant |
| CUS-1006 Emma Barker | 11 February 1983 | 4211 (Nerang) | last pay ($5,120, joint account), last four of her card (2255) |
| CUS-1007 Marcus Edward | 19 July 1990 | 4221 (Elanora) | last pay ($2,780), card merchant (Northshore Electronics, Twilight Pizza Co, ...) |
| CUS-3002 Dorothy Evans | 12 May 1942 | 4225 (Coolangatta) | last pension ($1,144.40), card merchant |
| CUS-3004 Ben Hartley | 30 April 2002 | 4209 (Pimpama) | moved 9 days ago: a replacement card goes to a specialist (RC-2) |

## Audit rules, enforced in the database

- Triggers on `cases`, `calls`, `interventions` and `notifications` write to
  `engine.audit_events`, so the application cannot forget.
- `engine.audit_events` rejects `UPDATE`, `DELETE` and `TRUNCATE`.
- The actor comes from transaction settings. Every write transaction runs
  `SELECT set_config('app.actor_type', 'STAFF', true), set_config('app.actor_id', 'STF-01', true)`
  and the triggers read them, defaulting to `SYSTEM`.

## Personas

| Customer | Story | Expected route |
| --- | --- | --- |
| CUS-1001 Sarah Mitchell | Lost her card. Card `CRD-10011` (4821), pending $8.50 at Pulse Gym Cafe yesterday 6:42pm | Level 1: `REPORT_LOST_STOLEN` auto (RL-1); level 2: `REPLACE_CARD` auto (RC-4), new card to Burleigh Heads in 5 business days |
| CUS-1002 Daniel Okafor | $15 overdrawn fee `TXN-F1002` after an insurance direct debit, customer 9 years, no earlier refunds | Level 2: `REFUND_FEE` auto under v4 (RF-3, earned autonomy) |
| CUS-1003 Priya Sharma | Lost her job 5 weeks ago. Home loan `ACC-10031` due in 6 days, income down 79.8%, offset drawn from $8,000 to $4,000 | Tier 2, `HARDSHIP_REQUEST` to Sam Patel (HR-3) |
| CUS-1004 Margaret Collins, 78 | $18,500 payment `TXN-H1004` held: new untrusted device, new payee with a failed name check, limit raised two days ago, an earlier $24,500 attempt declined | Tier 3, fraud specialist Morgan Taylor (SC-1, SC-2) |
| CUS-1005 Tom Barker | Third credit card late fee refund request in 12 months (joint everyday account with Emma Barker, CUS-1006) | Declined on the spot (RF-2, status `AUTO_DECLINED`); the seeded case CASE-001100 stays pending under v3 |
| CUS-1007 Marcus Edward | **Your own story** on the phone (Live only, no script). Customer 6 years, no care flags, a bit of everything: Everyday `ACC-10071` with debit card `CRD-10071` (6142), Savings `ACC-10072`, credit card `ACC-10073` / `CRD-10073` (3390), home loan `ACC-10074` with offset `ACC-10075` ($1,745 fortnightly, next due in 10 days, salary still arriving). Charged twice at Northshore Electronics yesterday ($264.00 at 12:14 and 12:15), $38.40 pending at Twilight Pizza Co last night, first ever $15 overdrawn fee `TXN-F1007` after the Ironbark Fitness gym direct debit, $20 credit card late fee `TXN-F1007C`, no earlier refunds | Lock either card: LC-1 auto. Either fee refund: RF-3 auto. Northshore Electronics duplicate: `RAISE_DISPUTE` auto with a provisional credit (RD-3). Home loan payment arrangement up to 8 weeks: auto (PA-3). Hardship: HR-DEFAULT to Sam Patel. Change of address: a specialist (SR-1) |
| CUS-2001 to CUS-2010 | Called earlier today about fees | 8 recommend APPROVE (RF-3), 2 DECLINE (RF-2): the batch approval demo |
| CUS-3001 to CUS-3004 | Extra customers used by the call simulator | Frustrated caller, confused elderly caller (large-print letters), supervisor instruction, default-rule refund. Ben Hartley (CUS-3004) changed address 9 days ago |

The inbox starts with 11 pending fee refund cases (8 APPROVE, 3 DECLINE, all
under `REFUND_FEE` v3). History holds 45 `REFUND_FEE` decisions with 42
agreements (93.3%) and 25 `HARDSHIP_REQUEST` decisions with 20 agreements
(80%). That agreement earned autonomy: a proposal to promote RF-3 to Tier 1,
signed off by Alex Chen, published as `REFUND_FEE` v4
(`engine.autonomy_proposals.published_policy_id`).

## Policies

First match wins. `AUTO` + `DECLINE` means "declined on the spot": the case
is `AUTO_DECLINED`, nothing is executed, and the customer can ask for a
review. A rule's `skill` routes that outcome to another skill (CARE).

| Action | Level | Rules (in order) |
| --- | --- | --- |
| LOCK_CARD v2 | 1 | LC-1 level >= 1 and own card: AUTO |
| REPORT_LOST_STOLEN v1 | 1 | RL-1 level >= 1 and own card: AUTO (card BLOCKED_LOST / BLOCKED_STOLEN) |
| UNLOCK_CARD v1 | 2 | UC-1 scam signals: ESCALATE; UC-2 card blocked or cancelled: AUTO DECLINE; UC-3 TEMP_LOCKED and level 2: AUTO |
| REPLACE_CARD v1 | 2 | RC-1 scam: ESCALATE; RC-2 address changed <= 30 days ago: ESCALATE; RC-3 >= 3 replacements in 12 months: ESCALATE; RC-4 level 2 and own card: AUTO |
| ACTIVATE_CARD v1 | 2 | AC-1 INACTIVE, own card, level 2: AUTO |
| REFUND_FEE v4 | 2 | RF-1 vulnerability: ESCALATE; RF-2 >= 2 refunds in 12 months: AUTO DECLINE; RF-4 fee > $50: APPROVE; RF-3 first refund, >= 2 years, fee <= $30: AUTO |
| RAISE_DISPUTE v1 | 2 | RD-1 scam: ESCALATE; RD-2 unrecognised and > $500: ESCALATE; RD-3 confirmed duplicate <= $500: AUTO with provisional credit; RD-4 > $2,000: APPROVE; default AUTO (lodged, no credit) |
| REQUEST_STATEMENT v1 | 1 | RS-1 level >= 1: AUTO |
| UPDATE_PREFERENCES v1 | 2 | UP-1 level 2: AUTO |
| PAYMENT_ARRANGEMENT v1 | 2 | PA-1 care flag: ESCALATE to CARE; PA-2 vulnerability: ESCALATE to CARE; PA-3 level 2, <= 30 days in arrears, <= 8 weeks: AUTO; default APPROVE (hardship specialist) |
| HARDSHIP_REQUEST v1 | 2 | unchanged (HR-1 to HR-3) |
| RELEASE_HELD_PAYMENT v1 | 2 | unchanged: never automatic |
| SERVICE_REQUEST v1 | 1 | SR-1 change of address, phone or email, limit increase, new payee, transfer, closing an account: ESCALATE; default APPROVE (staff, callback) |
| HUMAN_CALLBACK v1 | 0 | unchanged: always ESCALATE |

Staff: Alex Chen (team leader), Jordan Lee (frontline), Sam Patel (hardship),
Morgan Taylor (fraud), Casey Brown (fraud, on break).

## Reset

```bash
./reset.sh          # from the repo root: wipes the volume and reseeds
```

Or press **Reset demo** in the web app (when `DEMO_MODE=true`), which
re-runs the three files in place and stops the simulator.

## Poke around

```bash
docker compose exec db psql -U capitalwise -d capitalwise
```

```sql
SELECT * FROM engine.v_approval_inbox;
SELECT * FROM engine.v_autonomy_stats;
SELECT * FROM bank.v_income_rolling WHERE customer_id = 'CUS-1003';
SELECT * FROM engine.identity_attempts ORDER BY created_at DESC LIMIT 10;
UPDATE engine.audit_events SET actor_id = 'x' WHERE event_id = 1;  -- rejected
```
