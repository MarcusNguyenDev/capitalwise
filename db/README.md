# Database

Postgres, created from three SQL files that run in name order the first time
the `db` container starts (they are mounted into `/docker-entrypoint-initdb.d`):

| File | What it does |
| --- | --- |
| `01_schema.sql` | Drops and recreates both schemas, tables, constraints, the audit triggers and `bank.recalculate_balances()` |
| `02_seed.sql` | Personas, 60 to 130 days of background transactions, staff, AI agents, prompts, policies, 11 pending cases, 70 historical decided cases |
| `03_views.sql` | Read models for the adapter and the supervisor console |

## Two schemas

**`bank`** is a mock core banking system. It stands in for what a bank
already runs: products, customers, accounts, cards, payees, devices, an
append-only transaction ledger, loans, hardship arrangements, customer flags
and contact history.

**`engine`** is the product: AI agents, prompt versions, staff, the action
registry, versioned policies, calls, call turns, supervisor interventions,
cases, notifications, the audit ledger and autonomy proposals.

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
  `reverses_txn_id` points at the original `FEE`.

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
| CUS-1001 Sarah Mitchell | Lost her card. Card `CRD-10011` (4821), pending $8.50 at Pulse Gym Cafe yesterday 6:42pm | Tier 1, `LOCK_CARD` auto (LC-1) |
| CUS-1002 Daniel Okafor | $15 overdrawn fee `TXN-F1002` after an insurance direct debit, customer 9 years, no earlier refunds | Tier 2, `REFUND_FEE`, recommend APPROVE (RF-3) |
| CUS-1003 Priya Sharma | Lost her job 5 weeks ago. Home loan `ACC-10031` due in 6 days, income down 79.8%, offset drawn from $8,000 to $4,000 | Tier 2, `HARDSHIP_REQUEST` to Sam Patel (HR-3) |
| CUS-1004 Margaret Collins, 78 | $18,500 payment `TXN-H1004` held: new untrusted device, new payee with a failed name check, limit raised two days ago, an earlier $24,500 attempt declined | Tier 3, fraud specialist Morgan Taylor (SC-1, SC-2) |
| CUS-1005 Tom Barker | Third credit card late fee refund request in 12 months (joint everyday account with Emma Barker, CUS-1006) | Tier 2, recommend DECLINE (RF-2) |
| CUS-1007 Riley Hughes | **Your own story** on the phone (Live only, no script). Customer 6 years, no care flags, a bit of everything: Everyday `ACC-10071` with debit card `CRD-10071` (6142), Savings `ACC-10072`, credit card `ACC-10073` / `CRD-10073` (3390), home loan `ACC-10074` with offset `ACC-10075` ($1,745 fortnightly, next due in 10 days, salary still arriving). Charged twice at Northshore Electronics yesterday ($264.00 at 12:14 and 12:15), $38.40 pending at Twilight Pizza Co last night, first ever $15 overdrawn fee `TXN-F1007` after the Ironbark Fitness gym direct debit, $20 credit card late fee `TXN-F1007C`, no earlier refunds | Lock either card: LC-1 auto. Either fee refund: RF-3 APPROVE. Hardship: HR-DEFAULT to Sam Patel (no income drop). Anything without a tool (dispute, cancel a direct debit, change of address): a specialist |
| CUS-2001 to CUS-2010 | Called earlier today about fees | 8 recommend APPROVE (RF-3), 2 DECLINE (RF-2): the batch approval demo |
| CUS-3001 to CUS-3004 | Extra customers used by the call simulator | Frustrated caller, confused elderly caller, supervisor instruction, default-rule refund |

The inbox starts with 11 pending fee refund cases (8 APPROVE, 3 DECLINE).
History holds 45 `REFUND_FEE` decisions with 42 agreements (93.3%) and 25
`HARDSHIP_REQUEST` decisions with 20 agreements (80%).

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
UPDATE engine.audit_events SET actor_id = 'x' WHERE event_id = 1;  -- rejected
```
