-- 01_schema.sql
-- Two schemas:
--   bank   : a mock core banking system (what a bank already runs)
--   engine : our product (AI phone specialist with human oversight)
-- There are NO foreign keys from engine into bank. Engine stores reference ids
-- plus snapshots. Re-runnable: dropping both schemas makes "Reset demo" a
-- plain re-execution of the three SQL files.

DROP SCHEMA IF EXISTS engine CASCADE;
DROP SCHEMA IF EXISTS bank CASCADE;

CREATE SCHEMA bank;
CREATE SCHEMA engine;

-- ===========================================================================
-- bank
-- ===========================================================================

CREATE TABLE bank.products (
  product_code   text PRIMARY KEY,
  name           text NOT NULL,
  category       text NOT NULL CHECK (category IN ('TRANSACTION', 'SAVINGS', 'OFFSET', 'CREDIT_CARD', 'HOME_LOAN')),
  monthly_fee    numeric(14,2) NOT NULL DEFAULT 0,
  overdrawn_fee  numeric(14,2) NOT NULL DEFAULT 0,
  late_fee       numeric(14,2) NOT NULL DEFAULT 0,
  interest_rate  numeric(6,3)  NOT NULL DEFAULT 0
);

CREATE TABLE bank.customers (
  customer_id    text PRIMARY KEY,
  first_name     text NOT NULL,
  last_name      text NOT NULL,
  date_of_birth  date NOT NULL,
  mobile_phone   text NOT NULL UNIQUE CHECK (mobile_phone LIKE '+6149157%'),
  email          text NOT NULL,
  suburb         text NOT NULL,
  state          text NOT NULL,
  customer_since date NOT NULL
);

CREATE TABLE bank.accounts (
  account_id           text PRIMARY KEY,
  product_code         text NOT NULL REFERENCES bank.products (product_code),
  bsb                  text NOT NULL CHECK (bsb LIKE '999-%'),
  account_number       text NOT NULL,
  nickname             text NOT NULL,
  status               text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FROZEN', 'CLOSED')),
  opened_on            date NOT NULL,
  current_balance      numeric(14,2) NOT NULL DEFAULT 0,
  available_balance    numeric(14,2) NOT NULL DEFAULT 0,
  overdraft_limit      numeric(14,2) NOT NULL DEFAULT 0,
  credit_limit         numeric(14,2) NOT NULL DEFAULT 0,
  daily_transfer_limit numeric(14,2) NOT NULL DEFAULT 5000
);

CREATE TABLE bank.account_holders (
  account_id  text NOT NULL REFERENCES bank.accounts (account_id),
  customer_id text NOT NULL REFERENCES bank.customers (customer_id),
  role        text NOT NULL CHECK (role IN ('PRIMARY', 'JOINT', 'AUTHORISED_SIGNATORY')),
  PRIMARY KEY (account_id, customer_id)
);

CREATE TABLE bank.cards (
  card_id     text PRIMARY KEY,
  account_id  text NOT NULL REFERENCES bank.accounts (account_id),
  customer_id text NOT NULL REFERENCES bank.customers (customer_id),
  card_type   text NOT NULL CHECK (card_type IN ('DEBIT', 'CREDIT')),
  last4       text NOT NULL CHECK (last4 ~ '^[0-9]{4}$'),
  status      text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TEMP_LOCKED', 'BLOCKED_LOST', 'BLOCKED_STOLEN')),
  expires_on  date NOT NULL
);

CREATE TABLE bank.payees (
  payee_id            text PRIMARY KEY,
  customer_id         text NOT NULL REFERENCES bank.customers (customer_id),
  name                text NOT NULL,
  payee_type          text NOT NULL CHECK (payee_type IN ('BSB_ACCOUNT', 'PAYID', 'BPAY')),
  bsb                 text,
  account_number      text,
  payid               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  name_check          text NOT NULL DEFAULT 'NOT_CHECKED' CHECK (name_check IN ('MATCH', 'CLOSE_MATCH', 'NO_MATCH', 'NOT_CHECKED')),
  name_check_returned text
);

CREATE TABLE bank.devices (
  device_id     text PRIMARY KEY,
  customer_id   text NOT NULL REFERENCES bank.customers (customer_id),
  device_name   text NOT NULL,
  platform      text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  is_trusted    boolean NOT NULL DEFAULT false
);

CREATE SEQUENCE bank.txn_seq START 100001;

CREATE TABLE bank.transactions (
  txn_id          text PRIMARY KEY DEFAULT 'TXN-' || nextval('bank.txn_seq'),
  account_id      text NOT NULL REFERENCES bank.accounts (account_id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  posted_at       timestamptz,
  status          text NOT NULL CHECK (status IN ('PENDING', 'POSTED', 'DECLINED', 'HELD')),
  txn_type        text NOT NULL CHECK (txn_type IN ('PURCHASE', 'SALARY', 'GOVT_BENEFIT', 'TRANSFER_IN', 'TRANSFER_OUT', 'DIRECT_DEBIT', 'FEE', 'FEE_REFUND', 'LOAN_REPAYMENT', 'INTEREST')),
  channel         text NOT NULL CHECK (channel IN ('CARD', 'NPP', 'BECS', 'BPAY', 'INTERNAL')),
  amount          numeric(14,2) NOT NULL,
  description     text NOT NULL,
  merchant        text,
  payee_id        text REFERENCES bank.payees (payee_id),
  device_id       text REFERENCES bank.devices (device_id),
  card_id         text REFERENCES bank.cards (card_id),
  reverses_txn_id text REFERENCES bank.transactions (txn_id),
  hold_reason     text,
  risk_score      numeric(4,2)
);

CREATE INDEX transactions_account_created_idx ON bank.transactions (account_id, created_at DESC);
-- The ledger is append-only: a fee can be reversed at most once.
CREATE UNIQUE INDEX transactions_single_reversal_idx ON bank.transactions (reverses_txn_id) WHERE reverses_txn_id IS NOT NULL;

CREATE TABLE bank.loans (
  account_id          text PRIMARY KEY REFERENCES bank.accounts (account_id),
  repayment_type      text NOT NULL CHECK (repayment_type IN ('P_AND_I', 'INTEREST_ONLY')),
  original_amount     numeric(14,2) NOT NULL,
  interest_rate       numeric(6,3) NOT NULL,
  repayment_amount    numeric(14,2) NOT NULL,
  repayment_frequency text NOT NULL CHECK (repayment_frequency IN ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY')),
  next_repayment_due  date NOT NULL,
  arrears_amount      numeric(14,2) NOT NULL DEFAULT 0,
  days_in_arrears     integer NOT NULL DEFAULT 0,
  offset_account_id   text REFERENCES bank.accounts (account_id)
);

CREATE SEQUENCE bank.arrangement_seq START 5001;

CREATE TABLE bank.hardship_arrangements (
  arrangement_id     text PRIMARY KEY DEFAULT 'HSA-' || nextval('bank.arrangement_seq'),
  account_id         text NOT NULL REFERENCES bank.accounts (account_id),
  customer_id        text NOT NULL REFERENCES bank.customers (customer_id),
  notice_received_on date NOT NULL DEFAULT current_date,
  notice_channel     text NOT NULL DEFAULT 'PHONE',
  -- National Credit Code: a hardship notice must be answered within 21 days.
  response_due_on    date GENERATED ALWAYS AS (notice_received_on + 21) STORED,
  arrangement_type   text NOT NULL CHECK (arrangement_type IN ('REPAYMENT_PAUSE', 'REDUCED_REPAYMENTS', 'TERM_EXTENSION')),
  start_on           date,
  end_on             date,
  status             text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED', 'DECLINED', 'ACTIVE')),
  case_number        text
);

CREATE SEQUENCE bank.flag_seq START 7001;

CREATE TABLE bank.customer_flags (
  flag_id     text PRIMARY KEY DEFAULT 'FLG-' || nextval('bank.flag_seq'),
  customer_id text NOT NULL REFERENCES bank.customers (customer_id),
  flag_type   text NOT NULL CHECK (flag_type IN ('VULNERABILITY', 'POWER_OF_ATTORNEY', 'INTERPRETER_REQUIRED')),
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE bank.contact_seq START 30001;

CREATE TABLE bank.contact_history (
  contact_id  text PRIMARY KEY DEFAULT 'CON-' || nextval('bank.contact_seq'),
  customer_id text NOT NULL REFERENCES bank.customers (customer_id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  channel     text NOT NULL CHECK (channel IN ('PHONE', 'APP_CHAT', 'APP_SETTINGS', 'BRANCH')),
  event_type  text NOT NULL,
  summary     text NOT NULL
);

-- current_balance   = sum of POSTED transactions
-- available_balance = current + overdraft or credit limit + PENDING and HELD debits
CREATE FUNCTION bank.recalculate_balances() RETURNS void
LANGUAGE sql AS $$
  UPDATE bank.accounts AS account
  SET current_balance   = totals.posted_total,
      available_balance = totals.posted_total
                          + account.overdraft_limit
                          + account.credit_limit
                          + totals.uncleared_debit_total
  FROM (
    SELECT each_account.account_id,
           COALESCE(SUM(txn.amount) FILTER (WHERE txn.status = 'POSTED'), 0) AS posted_total,
           COALESCE(SUM(txn.amount) FILTER (WHERE txn.status IN ('PENDING', 'HELD') AND txn.amount < 0), 0) AS uncleared_debit_total
    FROM bank.accounts AS each_account
    LEFT JOIN bank.transactions AS txn ON txn.account_id = each_account.account_id
    GROUP BY each_account.account_id
  ) AS totals
  WHERE totals.account_id = account.account_id;
$$;

-- ===========================================================================
-- engine
-- ===========================================================================

CREATE TABLE engine.prompt_versions (
  version     text PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  content     text NOT NULL,
  change_note text NOT NULL,
  is_active   boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX prompt_versions_single_active_idx ON engine.prompt_versions (is_active) WHERE is_active;

CREATE TABLE engine.ai_agents (
  agent_id             text PRIMARY KEY,
  display_name         text NOT NULL,
  model                text NOT NULL,
  prompt_version       text NOT NULL REFERENCES engine.prompt_versions (version),
  status               text NOT NULL DEFAULT 'ONLINE' CHECK (status IN ('ONLINE', 'PAUSED')),
  max_concurrent_calls integer NOT NULL DEFAULT 5
);

CREATE TABLE engine.staff_users (
  staff_id                   text PRIMARY KEY,
  name                       text NOT NULL,
  role                       text NOT NULL CHECK (role IN ('FRONTLINE', 'HARDSHIP_SPECIALIST', 'FRAUD_SPECIALIST', 'TEAM_LEADER')),
  skills                     text[] NOT NULL DEFAULT '{}',
  status                     text NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BUSY', 'ON_BREAK', 'OFFLINE')),
  max_concurrent_supervision integer NOT NULL DEFAULT 6
);

CREATE TABLE engine.action_types (
  action_code       text PRIMARY KEY,
  description       text NOT NULL,
  risk_class        text NOT NULL CHECK (risk_class IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  reversible        boolean NOT NULL,
  required_evidence text[] NOT NULL DEFAULT '{}',
  required_skill    text
);

CREATE TABLE engine.policies (
  policy_id   text PRIMARY KEY,
  action_code text NOT NULL REFERENCES engine.action_types (action_code),
  version     integer NOT NULL,
  is_active   boolean NOT NULL DEFAULT false,
  definition  jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  approved_by text NOT NULL,
  UNIQUE (action_code, version)
);

CREATE UNIQUE INDEX policies_single_active_idx ON engine.policies (action_code) WHERE is_active;

CREATE TABLE engine.calls (
  call_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_number       text NOT NULL,
  customer_id         text,
  customer_name       text,
  channel             text NOT NULL CHECK (channel IN ('BROWSER', 'PHONE', 'SIMULATED')),
  status              text NOT NULL DEFAULT 'AI_ACTIVE' CHECK (status IN ('AI_ACTIVE', 'NEEDS_ATTENTION', 'HUMAN_ACTIVE', 'ENDED')),
  handled_by_agent_id text REFERENCES engine.ai_agents (agent_id),
  assigned_staff_id   text REFERENCES engine.staff_users (staff_id),
  identity_verified   boolean NOT NULL DEFAULT false,
  verified_at         timestamptz,
  intent              text,
  sentiment           text NOT NULL DEFAULT 'NEUTRAL' CHECK (sentiment IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'DISTRESSED')),
  risk_level          text NOT NULL DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  attention_reason    text,
  started_at          timestamptz NOT NULL DEFAULT now(),
  ended_at            timestamptz,
  ai_summary          text,
  metrics             jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX calls_status_idx ON engine.calls (status, started_at DESC);

CREATE TABLE engine.call_turns (
  turn_id     bigserial PRIMARY KEY,
  call_id     uuid NOT NULL REFERENCES engine.calls (call_id),
  seq         integer NOT NULL,
  speaker     text NOT NULL CHECK (speaker IN ('CUSTOMER', 'AI', 'STAFF', 'SYSTEM')),
  text        text,
  tool_name   text,
  tool_args   jsonb,
  tool_result jsonb,
  latency_ms  integer,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (call_id, seq)
);

CREATE SEQUENCE engine.intervention_seq START 1;

CREATE TABLE engine.interventions (
  intervention_id text PRIMARY KEY DEFAULT 'INT-' || lpad(nextval('engine.intervention_seq')::text, 5, '0'),
  call_id         uuid NOT NULL REFERENCES engine.calls (call_id),
  staff_id        text NOT NULL REFERENCES engine.staff_users (staff_id),
  type            text NOT NULL CHECK (type IN ('MONITOR', 'INSTRUCTION', 'TAKEOVER', 'HANDBACK', 'END_CALL')),
  text            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX interventions_call_idx ON engine.interventions (call_id, created_at);

-- Historical seed cases use CASE-001001 to CASE-001100; live cases start at CASE-001101.
CREATE SEQUENCE engine.case_seq START 1101;

CREATE TABLE engine.cases (
  case_number          text PRIMARY KEY DEFAULT 'CASE-' || lpad(nextval('engine.case_seq')::text, 6, '0'),
  call_id              uuid REFERENCES engine.calls (call_id),
  customer_id          text NOT NULL,
  customer_name        text NOT NULL,
  action_code          text NOT NULL REFERENCES engine.action_types (action_code),
  params               jsonb NOT NULL DEFAULT '{}'::jsonb,
  tier                 integer NOT NULL CHECK (tier IN (1, 2, 3)),
  status               text NOT NULL CHECK (status IN ('AUTO_EXECUTED', 'PENDING_APPROVAL', 'ESCALATED', 'APPROVED', 'EDITED_AND_APPROVED', 'REJECTED', 'EXECUTED')),
  priority             integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  summary              text NOT NULL,
  customer_statement   text,
  facts                jsonb NOT NULL DEFAULT '{}'::jsonb,
  soft_signals         jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendation       text NOT NULL CHECK (recommendation IN ('APPROVE', 'DECLINE', 'ESCALATE')),
  confidence           numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  policy_id            text NOT NULL REFERENCES engine.policies (policy_id),
  policy_version       integer NOT NULL,
  matched_rule_id      text NOT NULL,
  route_reason         text NOT NULL,
  required_skill       text,
  routing_rule         text,
  model                text NOT NULL,
  prompt_version       text NOT NULL,
  assigned_staff_id    text REFERENCES engine.staff_users (staff_id),
  sla_due_at           timestamptz,
  response_due_on      date,
  decision             text CHECK (decision IN ('APPROVED', 'EDITED_AND_APPROVED', 'REJECTED')),
  decision_reason_code text,
  decided_by           text REFERENCES engine.staff_users (staff_id),
  decided_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cases_status_idx ON engine.cases (status, priority, sla_due_at);
CREATE INDEX cases_call_idx ON engine.cases (call_id);

CREATE SEQUENCE engine.notification_seq START 1;

CREATE TABLE engine.notifications (
  notification_id text PRIMARY KEY DEFAULT 'NTF-' || lpad(nextval('engine.notification_seq')::text, 5, '0'),
  customer_id     text NOT NULL,
  call_id         uuid REFERENCES engine.calls (call_id),
  case_number     text REFERENCES engine.cases (case_number),
  channel         text NOT NULL CHECK (channel IN ('APP_PUSH', 'SMS')),
  kind            text NOT NULL CHECK (kind IN ('IDENTITY_CHECK', 'CASE_UPDATE')),
  body            text NOT NULL,
  status          text NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'APPROVED', 'DENIED', 'EXPIRED')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  responded_at    timestamptz
);

CREATE INDEX notifications_customer_idx ON engine.notifications (customer_id, created_at DESC);

CREATE TABLE engine.audit_events (
  event_id    bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_type  text NOT NULL CHECK (actor_type IN ('AI', 'STAFF', 'SYSTEM', 'CUSTOMER')),
  actor_id    text,
  event_type  text NOT NULL,
  call_id     uuid,
  case_number text,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX audit_events_occurred_idx ON engine.audit_events (occurred_at DESC, event_id DESC);
CREATE INDEX audit_events_call_idx ON engine.audit_events (call_id);
CREATE INDEX audit_events_case_idx ON engine.audit_events (case_number);

-- "Earned autonomy" proposals. Recording one never changes live policy; a
-- team leader has to sign it off and publish a new policy version.
CREATE TABLE engine.autonomy_proposals (
  proposal_id     bigserial PRIMARY KEY,
  action_code     text NOT NULL REFERENCES engine.action_types (action_code),
  matched_rule_id text,
  title           text NOT NULL,
  agreement_pct   numeric(5,1) NOT NULL,
  decided_cases   integer NOT NULL,
  proposed_by     text NOT NULL REFERENCES engine.staff_users (staff_id),
  status          text NOT NULL DEFAULT 'PENDING_SIGN_OFF' CHECK (status IN ('PENDING_SIGN_OFF', 'SIGNED_OFF', 'DECLINED')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  signed_off_by   text REFERENCES engine.staff_users (staff_id),
  signed_off_at   timestamptz
);

-- ===========================================================================
-- Audit: enforced in the database so the application cannot forget
-- ===========================================================================

-- The application runs, inside every write transaction:
--   SELECT set_config('app.actor_type', 'STAFF', true), set_config('app.actor_id', 'STF-01', true);
CREATE FUNCTION engine.current_actor_type() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.actor_type', true), ''), 'SYSTEM');
$$;

CREATE FUNCTION engine.current_actor_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.actor_id', true), '');
$$;

CREATE FUNCTION engine.audit_case_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO engine.audit_events (occurred_at, actor_type, actor_id, event_type, call_id, case_number, detail)
    VALUES (
      NEW.created_at, engine.current_actor_type(), engine.current_actor_id(), 'CASE_CREATED', NEW.call_id, NEW.case_number,
      jsonb_build_object(
        'action_code', NEW.action_code, 'tier', NEW.tier, 'status', NEW.status,
        'recommendation', NEW.recommendation, 'matched_rule_id', NEW.matched_rule_id,
        'policy_id', NEW.policy_id, 'policy_version', NEW.policy_version,
        'model', NEW.model, 'prompt_version', NEW.prompt_version,
        'assigned_staff_id', NEW.assigned_staff_id
      )
    );
    -- Historical rows are seeded already decided; the decision is still audited.
    IF NEW.decision IS NOT NULL THEN
      INSERT INTO engine.audit_events (occurred_at, actor_type, actor_id, event_type, call_id, case_number, detail)
      VALUES (
        COALESCE(NEW.decided_at, NEW.created_at), 'STAFF', NEW.decided_by, 'CASE_DECIDED', NEW.call_id, NEW.case_number,
        jsonb_build_object('decision', NEW.decision, 'reason_code', NEW.decision_reason_code, 'recommendation', NEW.recommendation, 'status', NEW.status)
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.decision IS DISTINCT FROM OLD.decision AND NEW.decision IS NOT NULL THEN
    INSERT INTO engine.audit_events (actor_type, actor_id, event_type, call_id, case_number, detail)
    VALUES (
      engine.current_actor_type(), engine.current_actor_id(), 'CASE_DECIDED', NEW.call_id, NEW.case_number,
      jsonb_build_object(
        'decision', NEW.decision, 'reason_code', NEW.decision_reason_code, 'recommendation', NEW.recommendation,
        'decided_by', NEW.decided_by, 'params_before', OLD.params, 'params_after', NEW.params
      )
    );
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO engine.audit_events (actor_type, actor_id, event_type, call_id, case_number, detail)
    VALUES (
      engine.current_actor_type(), engine.current_actor_id(), 'CASE_STATUS_CHANGED', NEW.call_id, NEW.case_number,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;

  IF NEW.assigned_staff_id IS DISTINCT FROM OLD.assigned_staff_id
     OR NEW.tier IS DISTINCT FROM OLD.tier THEN
    INSERT INTO engine.audit_events (actor_type, actor_id, event_type, call_id, case_number, detail)
    VALUES (
      engine.current_actor_type(), engine.current_actor_id(), 'CASE_ROUTED', NEW.call_id, NEW.case_number,
      jsonb_build_object('assigned_staff_id', NEW.assigned_staff_id, 'tier', NEW.tier, 'route_reason', NEW.route_reason)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cases_audit AFTER INSERT OR UPDATE ON engine.cases
FOR EACH ROW EXECUTE FUNCTION engine.audit_case_change();

CREATE FUNCTION engine.audit_call_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO engine.audit_events (occurred_at, actor_type, actor_id, event_type, call_id, detail)
    VALUES (
      NEW.started_at, engine.current_actor_type(), engine.current_actor_id(), 'CALL_STARTED', NEW.call_id,
      jsonb_build_object('channel', NEW.channel, 'caller_number', NEW.caller_number, 'customer_id', NEW.customer_id, 'handled_by_agent_id', NEW.handled_by_agent_id, 'status', NEW.status)
    );
    IF NEW.status = 'ENDED' THEN
      INSERT INTO engine.audit_events (occurred_at, actor_type, actor_id, event_type, call_id, detail)
      VALUES (COALESCE(NEW.ended_at, NEW.started_at), 'SYSTEM', NULL, 'CALL_STATUS_CHANGED', NEW.call_id, jsonb_build_object('from', 'AI_ACTIVE', 'to', 'ENDED'));
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO engine.audit_events (actor_type, actor_id, event_type, call_id, detail)
    VALUES (
      engine.current_actor_type(), engine.current_actor_id(), 'CALL_STATUS_CHANGED', NEW.call_id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'attention_reason', NEW.attention_reason, 'assigned_staff_id', NEW.assigned_staff_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER calls_audit AFTER INSERT OR UPDATE ON engine.calls
FOR EACH ROW EXECUTE FUNCTION engine.audit_call_change();

CREATE FUNCTION engine.audit_intervention() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO engine.audit_events (occurred_at, actor_type, actor_id, event_type, call_id, detail)
  VALUES (
    NEW.created_at, 'STAFF', NEW.staff_id, 'INTERVENTION_RECORDED', NEW.call_id,
    jsonb_build_object('intervention_id', NEW.intervention_id, 'type', NEW.type, 'text', NEW.text)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER interventions_audit AFTER INSERT ON engine.interventions
FOR EACH ROW EXECUTE FUNCTION engine.audit_intervention();

CREATE FUNCTION engine.audit_notification_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO engine.audit_events (occurred_at, actor_type, actor_id, event_type, call_id, case_number, detail)
    VALUES (
      NEW.created_at, engine.current_actor_type(), engine.current_actor_id(), 'NOTIFICATION_SENT', NEW.call_id, NEW.case_number,
      jsonb_build_object('notification_id', NEW.notification_id, 'channel', NEW.channel, 'kind', NEW.kind, 'customer_id', NEW.customer_id, 'body', NEW.body)
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO engine.audit_events (actor_type, actor_id, event_type, call_id, case_number, detail)
    VALUES (
      engine.current_actor_type(), engine.current_actor_id(), 'NOTIFICATION_RESPONDED', NEW.call_id, NEW.case_number,
      jsonb_build_object('notification_id', NEW.notification_id, 'kind', NEW.kind, 'from', OLD.status, 'to', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notifications_audit AFTER INSERT OR UPDATE ON engine.notifications
FOR EACH ROW EXECUTE FUNCTION engine.audit_notification_change();

-- Append-only ledger: UPDATE, DELETE and TRUNCATE are rejected for everyone.
CREATE FUNCTION engine.reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'engine.audit_events is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER audit_events_no_update_delete BEFORE UPDATE OR DELETE ON engine.audit_events
FOR EACH ROW EXECUTE FUNCTION engine.reject_audit_mutation();

CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON engine.audit_events
FOR EACH STATEMENT EXECUTE FUNCTION engine.reject_audit_mutation();
