-- 03_views.sql
-- Read models. bank.* views are read only through the CoreBankingAdapter;
-- engine.* views back the supervisor console.

-- ===========================================================================
-- bank
-- ===========================================================================

CREATE VIEW bank.v_customer_overview AS
SELECT
  customer.customer_id,
  customer.first_name,
  customer.last_name,
  customer.first_name || ' ' || customer.last_name AS full_name,
  customer.mobile_phone,
  customer.email,
  customer.suburb,
  customer.state,
  customer.customer_since,
  EXTRACT(YEAR FROM age(current_date, customer.date_of_birth))::int AS age,
  EXTRACT(YEAR FROM age(current_date, customer.customer_since))::int AS tenure_years,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('flag_id', flag.flag_id, 'flag_type', flag.flag_type, 'note', flag.note, 'created_at', flag.created_at) ORDER BY flag.created_at)
    FROM bank.customer_flags AS flag
    WHERE flag.customer_id = customer.customer_id
  ), '[]'::jsonb) AS flags,
  EXISTS (
    SELECT 1 FROM bank.customer_flags AS flag
    WHERE flag.customer_id = customer.customer_id AND flag.flag_type IN ('VULNERABILITY', 'POWER_OF_ATTORNEY')
  ) AS has_care_flag,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'account_id', account.account_id,
             'product_code', account.product_code,
             'product_name', product.name,
             'category', product.category,
             'nickname', account.nickname,
             'status', account.status,
             'role', holder.role,
             'current_balance', account.current_balance,
             'available_balance', account.available_balance,
             'daily_transfer_limit', account.daily_transfer_limit
           ) ORDER BY account.account_id)
    FROM bank.account_holders AS holder
    JOIN bank.accounts AS account ON account.account_id = holder.account_id
    JOIN bank.products AS product ON product.product_code = account.product_code
    WHERE holder.customer_id = customer.customer_id
  ), '[]'::jsonb) AS accounts,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'card_id', card.card_id,
             'account_id', card.account_id,
             'card_type', card.card_type,
             'last4', card.last4,
             'status', card.status
           ) ORDER BY card.card_id)
    FROM bank.cards AS card
    WHERE card.customer_id = customer.customer_id
  ), '[]'::jsonb) AS cards,
  -- Deliberately no date of birth, street address or postcode: they are
  -- identity answers, and this view is read by the AI's lookup tools.
  COALESCE((
    SELECT jsonb_build_object(
             'paper_statements', preference.paper_statements,
             'sms_alerts', preference.sms_alerts,
             'large_print_letters', preference.large_print_letters
           )
    FROM bank.customer_preferences AS preference
    WHERE preference.customer_id = customer.customer_id
  ), '{"paper_statements": false, "sms_alerts": true, "large_print_letters": false}'::jsonb) AS preferences
FROM bank.customers AS customer;

CREATE VIEW bank.v_statement AS
SELECT
  txn.txn_id,
  txn.account_id,
  txn.posted_at,
  txn.txn_type,
  txn.channel,
  txn.amount,
  txn.description,
  txn.merchant,
  txn.reverses_txn_id,
  SUM(txn.amount) OVER (PARTITION BY txn.account_id ORDER BY txn.posted_at, txn.txn_id) AS running_balance
FROM bank.transactions AS txn
WHERE txn.status = 'POSTED';

-- One row per fee per account holder.
CREATE VIEW bank.v_fee_history AS
SELECT
  fee.txn_id,
  fee.account_id,
  holder.customer_id,
  fee.created_at AS charged_at,
  -fee.amount AS fee_amount,
  fee.description,
  CASE
    WHEN fee.description ILIKE '%overdrawn%' THEN 'OVERDRAWN'
    WHEN fee.description ILIKE '%late%' THEN 'LATE_PAYMENT'
    WHEN fee.description ILIKE '%dishonour%' THEN 'DISHONOUR'
    ELSE 'OTHER'
  END AS fee_cause,
  refund.txn_id IS NOT NULL AS is_refunded,
  refund.txn_id AS refund_txn_id,
  refund.created_at AS refunded_at,
  (
    SELECT COUNT(*)::int
    FROM bank.transactions AS earlier_refund
    JOIN bank.account_holders AS refund_holder ON refund_holder.account_id = earlier_refund.account_id
    WHERE refund_holder.customer_id = holder.customer_id
      AND earlier_refund.txn_type = 'FEE_REFUND'
      AND earlier_refund.status = 'POSTED'
      AND earlier_refund.created_at > now() - interval '12 months'
  ) AS refunds_last_12m
FROM bank.transactions AS fee
JOIN bank.account_holders AS holder ON holder.account_id = fee.account_id
LEFT JOIN bank.transactions AS refund ON refund.reverses_txn_id = fee.txn_id AND refund.txn_type = 'FEE_REFUND'
WHERE fee.txn_type = 'FEE';

CREATE VIEW bank.v_income_monthly AS
SELECT
  holder.customer_id,
  date_trunc('month', txn.posted_at)::date AS income_month,
  COALESCE(SUM(txn.amount) FILTER (WHERE txn.txn_type = 'SALARY'), 0) AS salary_income,
  COALESCE(SUM(txn.amount) FILTER (WHERE txn.txn_type = 'GOVT_BENEFIT'), 0) AS government_income,
  SUM(txn.amount) AS total_income
FROM bank.transactions AS txn
JOIN bank.account_holders AS holder ON holder.account_id = txn.account_id AND holder.role = 'PRIMARY'
WHERE txn.status = 'POSTED' AND txn.txn_type IN ('SALARY', 'GOVT_BENEFIT')
GROUP BY holder.customer_id, date_trunc('month', txn.posted_at);

-- Calendar months move under a demo that reseeds relative to now(), so the
-- hardship income test uses rolling windows: the last 30 days against the
-- average 30 days across the 90 days before that.
CREATE VIEW bank.v_income_rolling AS
SELECT
  customer.customer_id,
  windows.recent_30d_income,
  windows.baseline_30d_income,
  CASE
    WHEN windows.baseline_30d_income > 0
      THEN GREATEST(round((1 - windows.recent_30d_income / windows.baseline_30d_income) * 100, 1), 0)
    ELSE 0
  END AS income_drop_pct,
  windows.last_salary_at
FROM bank.customers AS customer
CROSS JOIN LATERAL (
  SELECT
    COALESCE(SUM(txn.amount) FILTER (WHERE txn.posted_at > now() - interval '30 days'), 0) AS recent_30d_income,
    round(COALESCE(SUM(txn.amount) FILTER (WHERE txn.posted_at <= now() - interval '30 days' AND txn.posted_at > now() - interval '120 days'), 0) / 3, 2) AS baseline_30d_income,
    MAX(txn.posted_at) FILTER (WHERE txn.txn_type = 'SALARY') AS last_salary_at
  FROM bank.transactions AS txn
  JOIN bank.account_holders AS holder ON holder.account_id = txn.account_id AND holder.role = 'PRIMARY'
  WHERE holder.customer_id = customer.customer_id
    AND txn.status = 'POSTED'
    AND txn.txn_type IN ('SALARY', 'GOVT_BENEFIT')
) AS windows;

-- ===========================================================================
-- engine
-- ===========================================================================

CREATE VIEW engine.v_live_calls AS
SELECT
  call.call_id,
  call.caller_number,
  call.customer_id,
  call.customer_name,
  call.channel,
  call.status,
  call.handled_by_agent_id,
  agent.display_name AS agent_name,
  call.assigned_staff_id,
  staff.name AS assigned_staff_name,
  call.identity_verified,
  call.identity_level,
  call.identity_method,
  call.is_identity_locked,
  identity.failed_attempts AS identity_failed_attempts,
  call.verified_at,
  call.intent,
  call.sentiment,
  call.risk_level,
  call.attention_reason,
  call.started_at,
  call.ended_at,
  call.ai_summary,
  call.metrics,
  last_turn.text AS last_line,
  last_turn.speaker AS last_speaker,
  EXTRACT(EPOCH FROM (COALESCE(call.ended_at, now()) - call.started_at))::int AS duration_seconds
FROM engine.calls AS call
LEFT JOIN engine.ai_agents AS agent ON agent.agent_id = call.handled_by_agent_id
LEFT JOIN engine.staff_users AS staff ON staff.staff_id = call.assigned_staff_id
LEFT JOIN LATERAL (
  SELECT turn.text, turn.speaker
  FROM engine.call_turns AS turn
  WHERE turn.call_id = call.call_id AND turn.text IS NOT NULL AND turn.speaker <> 'SYSTEM'
  ORDER BY turn.seq DESC
  LIMIT 1
) AS last_turn ON true
CROSS JOIN LATERAL (
  SELECT COUNT(*)::int AS failed_attempts
  FROM engine.identity_attempts AS attempt
  WHERE attempt.call_id = call.call_id AND NOT attempt.is_passed
) AS identity
WHERE call.status <> 'ENDED';

CREATE VIEW engine.v_approval_inbox AS
SELECT
  each_case.case_number,
  each_case.call_id,
  each_case.customer_id,
  each_case.customer_name,
  each_case.action_code,
  action.description AS action_description,
  action.risk_class,
  each_case.params,
  each_case.tier,
  each_case.status,
  each_case.priority,
  each_case.summary,
  each_case.customer_statement,
  each_case.facts,
  each_case.soft_signals,
  each_case.recommendation,
  each_case.confidence,
  each_case.policy_id,
  each_case.policy_version,
  each_case.matched_rule_id,
  each_case.route_reason,
  each_case.required_skill,
  each_case.routing_rule,
  each_case.model,
  each_case.prompt_version,
  each_case.assigned_staff_id,
  staff.name AS assigned_staff_name,
  each_case.sla_due_at,
  each_case.response_due_on,
  each_case.created_at,
  COALESCE((each_case.facts ->> 'has_care_flag')::boolean, false) AS has_care_flag,
  EXTRACT(EPOCH FROM (now() - each_case.created_at))::int AS waiting_seconds
FROM engine.cases AS each_case
JOIN engine.action_types AS action ON action.action_code = each_case.action_code
LEFT JOIN engine.staff_users AS staff ON staff.staff_id = each_case.assigned_staff_id
WHERE each_case.status IN ('PENDING_APPROVAL', 'ESCALATED')
ORDER BY each_case.priority, each_case.sla_due_at NULLS LAST, each_case.created_at;

CREATE VIEW engine.v_autonomy_stats AS
SELECT
  each_case.action_code,
  COUNT(*)::int AS decided_cases,
  COUNT(*) FILTER (
    WHERE (each_case.recommendation = 'APPROVE' AND each_case.decision = 'APPROVED')
       OR (each_case.recommendation = 'DECLINE' AND each_case.decision = 'REJECTED')
  )::int AS agreement_count,
  COUNT(*) FILTER (WHERE each_case.decision = 'EDITED_AND_APPROVED')::int AS edited_count,
  round(
    100.0 * COUNT(*) FILTER (
      WHERE (each_case.recommendation = 'APPROVE' AND each_case.decision = 'APPROVED')
         OR (each_case.recommendation = 'DECLINE' AND each_case.decision = 'REJECTED')
    ) / COUNT(*), 1
  ) AS agreement_pct,
  round((AVG(EXTRACT(EPOCH FROM (each_case.decided_at - each_case.created_at))) / 60)::numeric, 1) AS avg_minutes_to_decision
FROM engine.cases AS each_case
WHERE each_case.decision IS NOT NULL
GROUP BY each_case.action_code;

CREATE VIEW engine.v_workforce AS
SELECT
  staff.staff_id,
  staff.name,
  staff.role,
  staff.skills,
  staff.status,
  staff.max_concurrent_supervision,
  (
    SELECT COUNT(*)::int FROM engine.calls AS call
    WHERE call.assigned_staff_id = staff.staff_id AND call.status <> 'ENDED'
  ) AS supervised_call_count,
  (
    SELECT COUNT(*)::int FROM engine.cases AS each_case
    WHERE each_case.assigned_staff_id = staff.staff_id AND each_case.status IN ('PENDING_APPROVAL', 'ESCALATED')
  ) AS assigned_case_count
FROM engine.staff_users AS staff
ORDER BY staff.staff_id;

CREATE VIEW engine.v_decision_explanations AS
SELECT
  each_case.case_number,
  each_case.call_id,
  each_case.customer_id,
  each_case.customer_name,
  each_case.action_code,
  action.description AS action_description,
  action.risk_class,
  action.reversible,
  action.required_evidence,
  each_case.params,
  each_case.tier,
  each_case.status,
  each_case.summary,
  each_case.customer_statement,
  each_case.facts,
  each_case.soft_signals,
  each_case.recommendation,
  each_case.confidence,
  each_case.policy_id,
  each_case.policy_version,
  policy.definition AS policy_definition,
  policy.approved_by AS policy_approved_by,
  each_case.matched_rule_id,
  each_case.route_reason,
  each_case.required_skill,
  each_case.routing_rule,
  each_case.model,
  each_case.prompt_version,
  each_case.assigned_staff_id,
  assigned.name AS assigned_staff_name,
  each_case.sla_due_at,
  each_case.response_due_on,
  each_case.decision,
  each_case.decision_reason_code,
  each_case.decided_by,
  decider.name AS decided_by_name,
  decider.role AS decided_by_role,
  each_case.decided_at,
  each_case.created_at
FROM engine.cases AS each_case
JOIN engine.action_types AS action ON action.action_code = each_case.action_code
JOIN engine.policies AS policy ON policy.policy_id = each_case.policy_id
LEFT JOIN engine.staff_users AS assigned ON assigned.staff_id = each_case.assigned_staff_id
LEFT JOIN engine.staff_users AS decider ON decider.staff_id = each_case.decided_by;
