// Acceptance test from the build prompt, section 12, in scripted form.
// It drives the same REST endpoints the phone page and the supervisor console
// use, against the running `api` and `core` services and the real database.
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

const API_URL = process.env.API_URL ?? "http://localhost:3002";
const CORE_URL = process.env.CORE_URL ?? "http://localhost:3001";

const STAFF = { ALEX: "STF-01", JORDAN: "STF-02", SAM: "STF-03", MORGAN: "STF-04" };
const EMPATHY_INSTRUCTION = "Show extra empathy and mention the National Debt Helpline";
const POLL_INTERVAL_MS = 250;

class AcceptanceRequestError extends Error {
  constructor(method, url, status, body) {
    super(`${method} ${url} -> ${status}: ${JSON.stringify(body)}`);
    this.name = "AcceptanceRequestError";
  }
}

class PollTimeoutError extends Error {
  constructor(description) {
    super(`Timed out waiting for: ${description}`);
    this.name = "PollTimeoutError";
  }
}

async function request(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response_body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AcceptanceRequestError(method, url, response.status, response_body);
  }
  return response_body;
}

const api = {
  get: (path) => request("GET", `${API_URL}/api${path}`),
  post: (path, body = {}) => request("POST", `${API_URL}/api${path}`, body),
};
const core = {
  get: (path) => request("GET", `${CORE_URL}/core${path}`),
  post: (path, body = {}) => request("POST", `${CORE_URL}/core${path}`, body),
};

async function pollUntil(description, readValue, timeout_ms = 30000) {
  const deadline = Date.now() + timeout_ms;
  while (Date.now() < deadline) {
    const value = await readValue();
    if (value) {
      return value;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new PollTimeoutError(description);
}

function resolvePlaceholders(text, tool_results) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (placeholder, path) => {
    if (path === "bank_name") {
      return "Demo Bank";
    }
    const [tool_name, ...keys] = path.split(".");
    const value = keys.reduce((current, key) => current?.[key], tool_results[tool_name]);
    return value === undefined || value === null ? placeholder : String(value);
  });
}

// The simulated customer taps Approve on the identity push.
async function approveIdentityPush(call_id) {
  const notification = await pollUntil("identity push to be sent", async () => {
    const notifications = await api.get(`/notifications?call_id=${call_id}`);
    return notifications.find((each) => each.kind === "IDENTITY_CHECK" && each.status === "SENT");
  });
  await api.post(`/notifications/${notification.notification_id}/response`, { response: "APPROVED" });
}

async function sayLine(call_id, speaker, text, tool_results) {
  return core.post(`/calls/${call_id}/turns`, {
    speaker,
    text: resolvePlaceholders(text, tool_results),
    ...(speaker === "AI" ? { latency_ms: 620 } : {}),
  });
}

async function runToolStep(call_id, tool_name, args, tool_results) {
  const pending_approval = tool_name === "send_identity_push" ? approveIdentityPush(call_id) : Promise.resolve();
  const [tool_response] = await Promise.all([core.post(`/calls/${call_id}/tools/${tool_name}`, { args }), pending_approval]);
  assert.equal(tool_response.ok, true, `${tool_name} failed: ${JSON.stringify(tool_response.error)}`);
  tool_results[tool_name] = tool_response.result;
  return tool_response.result;
}

/**
 * Replays a hero script the way the phone page does in Scripted mode.
 * `supervisor` says what the staff member does at the script's wait points.
 */
async function runScriptedCall(customer_id, supervisor = {}) {
  const script = await core.get(`/scripted_calls/${customer_id}`);
  const call = await core.post("/calls", { caller_number: script.caller_number, channel: "BROWSER", mode: "SCRIPTED" });
  const tool_results = {};
  const spoken_ai_lines = [];
  const observations = {};

  for (const step of script.steps) {
    if (step.type === "ai" || step.type === "customer") {
      const turn = await sayLine(call.call_id, step.type === "ai" ? "AI" : "CUSTOMER", step.text, tool_results);
      if (step.type === "ai") {
        spoken_ai_lines.push(turn.text);
      }
    } else if (step.type === "tool") {
      await runToolStep(call.call_id, step.tool_name, step.args ?? {}, tool_results);
      if (step.tool_name === "flag_concern") {
        observations.call_after_concern = (await core.get(`/calls/${call.call_id}`)).call;
      }
    } else if (step.type === "insight") {
      const { type: _step_type, ...insight } = step;
      await runToolStep(call.call_id, "update_call_insight", insight, tool_results);
    } else if (step.type === "await_instruction") {
      if (supervisor.instruction) {
        const intervention = await core.post(`/calls/${call.call_id}/interventions`, {
          staff_id: supervisor.staff_id,
          type: "INSTRUCTION",
          text: supervisor.instruction,
        });
        await core.post(`/calls/${call.call_id}/interventions/${intervention.intervention_id}/applied`);
        const turn = await sayLine(call.call_id, "AI", step.ai_with_instruction, tool_results);
        observations.line_after_instruction = turn.text;
      } else {
        await sayLine(call.call_id, "AI", step.ai_without_instruction, tool_results);
      }
    } else if (step.type === "await_takeover" && supervisor.should_take_over) {
      await core.post(`/calls/${call.call_id}/interventions`, { staff_id: supervisor.staff_id, type: "TAKEOVER" });
      observations.call_during_takeover = (await core.get(`/calls/${call.call_id}`)).call;
      await core.post(`/calls/${call.call_id}/staff_messages`, {
        staff_id: supervisor.staff_id,
        text: "Hello Margaret, this is the bank's fraud team. Your money is safe and has not left your account.",
      });
      await core.post(`/calls/${call.call_id}/interventions`, {
        staff_id: supervisor.staff_id,
        type: "HANDBACK",
        text: "Customer understands it was a scam. Confirm next steps and close warmly.",
      });
      observations.call_after_handback = (await core.get(`/calls/${call.call_id}`)).call;
    }
  }

  const ended_call = await core.post(`/calls/${call.call_id}/end`, { ended_by: "CUSTOMER" });
  return { call_id: call.call_id, ended_call, tool_results, spoken_ai_lines, observations };
}

async function fetchAuditEvents(filter) {
  const query = new URLSearchParams({ limit: "500", ...filter }).toString();
  return (await api.get(`/audit/events?${query}`)).events;
}

async function fetchCallCases(call_id) {
  return api.get(`/cases?call_id=${call_id}`);
}

function daysFromToday(calendar_date) {
  const today = new Date(new Date().toISOString().slice(0, 10));
  return Math.round((new Date(String(calendar_date).slice(0, 10)) - today) / 86400000);
}

describe("Acceptance test (build prompt section 12)", { concurrency: false }, () => {
  let priya_case_number;

  before(async () => {
    await api.post("/demo/reset");
    await pollUntil("the reseeded inbox", async () => (await api.get("/approvals/inbox")).length === 11);
    // Give core a moment to react to the demo.reset event.
    await sleep(500);
  });

  test("1. simulator: five calls stream and one is routed to Jordan", async () => {
    await core.post("/simulator/start", { call_count: 5, speed: 2 });

    const live_calls = await pollUntil("five simulated tiles", async () => {
      const calls = await core.get("/calls");
      return calls.length >= 5 ? calls : null;
    });
    assert.ok(live_calls.every((call) => call.channel === "SIMULATED"));

    const first_call_id = live_calls[0].call_id;
    await pollUntil("transcript turns to stream", async () => (await core.get(`/calls/${first_call_id}`)).turns.length >= 3);

    const attention_call = await pollUntil(
      "a call needing attention routed to Jordan Lee",
      async () => (await core.get("/calls")).find((call) => call.status === "NEEDS_ATTENTION" && call.assigned_staff_name === "Jordan Lee"),
      90000,
    );
    assert.ok(attention_call.attention_reason);

    await core.post("/simulator/stop");
    await pollUntil("simulated calls to end", async () => (await core.get("/calls")).length === 0);
  });

  test("2. Sarah: identity by app push, card locked instantly, SMS, audit shows AI and LC-1", async () => {
    const sarah = await runScriptedCall("CUS-1001");

    const [lock_case] = await fetchCallCases(sarah.call_id);
    assert.equal(lock_case.action_code, "LOCK_CARD");
    assert.equal(lock_case.tier, 1);
    assert.equal(lock_case.status, "AUTO_EXECUTED");
    assert.equal(lock_case.matched_rule_id, "LC-1");

    const overview = await api.get("/banking/customers/CUS-1001/overview");
    assert.equal(overview.cards.find((card) => card.card_id === "CRD-10011").status, "TEMP_LOCKED");

    const notifications = await api.get(`/notifications?customer_id=CUS-1001`);
    assert.ok(notifications.some((each) => each.kind === "IDENTITY_CHECK" && each.status === "APPROVED"), "identity push approved");
    assert.ok(notifications.some((each) => each.channel === "SMS" && /locked/i.test(each.body)), "card lock SMS");

    const audit_events = await fetchAuditEvents({ call_id: sarah.call_id });
    const case_created = audit_events.find((event) => event.event_type === "CASE_CREATED");
    assert.equal(case_created.actor_type, "AI");
    const policy_evaluated = audit_events.find((event) => event.event_type === "POLICY_EVALUATED");
    assert.equal(policy_evaluated.detail.matched_rule_id, "LC-1");
    assert.ok(audit_events.some((event) => event.event_type === "IDENTITY_VERIFIED"));
    assert.ok(audit_events.some((event) => event.event_type === "TOOL_CALL" && event.detail.tool_name === "lock_card"));

    assert.equal(sarah.ended_call.status, "ENDED");
    assert.ok(sarah.ended_call.identity_verified);
    assert.ok(!/press \d|account number|passkey/i.test(sarah.spoken_ai_lines.join(" ")), "no menu, account number or passkey");
  });

  test("3. Priya: whisper changes the next AI turn, HR-3 case to Sam, approval records the arrangement and sends an SMS", async () => {
    const priya = await runScriptedCall("CUS-1003", { staff_id: STAFF.ALEX, instruction: EMPATHY_INSTRUCTION });

    assert.match(priya.observations.line_after_instruction, /Debt Helpline|1800 007 007/i);

    const audit_events = await fetchAuditEvents({ call_id: priya.call_id });
    const instruction_recorded = audit_events.find((event) => event.event_type === "INTERVENTION_RECORDED" && event.detail.type === "INSTRUCTION");
    assert.equal(instruction_recorded.detail.text, EMPATHY_INSTRUCTION);
    assert.equal(instruction_recorded.actor_id, STAFF.ALEX);
    assert.ok(audit_events.some((event) => event.event_type === "INSTRUCTION_APPLIED"));

    const hardship_case = (await fetchCallCases(priya.call_id)).find((each) => each.action_code === "HARDSHIP_REQUEST");
    assert.equal(hardship_case.tier, 2);
    assert.equal(hardship_case.status, "PENDING_APPROVAL");
    assert.equal(hardship_case.matched_rule_id, "HR-3");
    assert.equal(hardship_case.assigned_staff_name, "Sam Patel");
    assert.ok([20, 21, 22].includes(daysFromToday(hardship_case.response_due_on)), "21-day hardship deadline");
    priya_case_number = hardship_case.case_number;

    const decision = await api.post(`/cases/${priya_case_number}/decision`, {
      staff_id: STAFF.SAM,
      decision: "APPROVED",
      reason_code: "MEETS_POLICY",
    });
    assert.equal(decision.is_executed, true);
    assert.equal(decision.case.status, "EXECUTED");

    const loan = await api.get("/banking/customers/CUS-1003/loans/ACC-10031");
    assert.ok(loan.arrangements.some((arrangement) => arrangement.case_number === priya_case_number), "arrangement recorded");

    const notifications = await api.get(`/notifications?customer_id=CUS-1003`);
    assert.ok(notifications.some((each) => each.channel === "SMS" && /approved/i.test(each.body)), "approval SMS");
  });

  test("4. Margaret: scam flagged, high risk, Tier 3 to Morgan, takeover and handback, money stays held", async () => {
    const margaret = await runScriptedCall("CUS-1004", { staff_id: STAFF.MORGAN, should_take_over: true });

    assert.equal(margaret.observations.call_after_concern.risk_level, "HIGH");
    assert.equal(margaret.observations.call_after_concern.status, "NEEDS_ATTENTION");
    assert.equal(margaret.observations.call_during_takeover.status, "HUMAN_ACTIVE");
    assert.equal(margaret.observations.call_after_handback.status, "AI_ACTIVE");

    const held_case = (await fetchCallCases(margaret.call_id)).find((each) => each.action_code === "RELEASE_HELD_PAYMENT");
    assert.equal(held_case.tier, 3);
    assert.equal(held_case.status, "ESCALATED");
    assert.equal(held_case.assigned_staff_name, "Morgan Taylor");
    assert.ok(["SC-1", "SC-2"].includes(held_case.matched_rule_id));
    assert.equal(held_case.recommendation, "DECLINE");

    const { held_payments } = await api.get("/banking/customers/CUS-1004/held_payments");
    const held_payment = held_payments.find((payment) => payment.txn_id === "TXN-H1004");
    assert.equal(held_payment.status, "HELD");
    assert.equal(Math.abs(held_payment.amount), 18500);

    const audit_events = await fetchAuditEvents({ call_id: margaret.call_id });
    assert.ok(audit_events.some((event) => event.event_type === "TAKEOVER" && event.actor_id === STAFF.MORGAN));
    assert.ok(audit_events.some((event) => event.event_type === "HANDBACK"));
  });

  test("5. batch approve the 8 recommended fee refunds: reversing ledger rows exist", async () => {
    const batch_groups = await api.get("/approvals/batch_groups");
    const refund_group = batch_groups.find((group) => group.action_code === "REFUND_FEE" && group.matched_rule_id === "RF-3");
    assert.equal(refund_group.case_count, 8);

    const batch_result = await api.post("/approvals/batch_approve", {
      staff_id: STAFF.JORDAN,
      case_numbers: refund_group.cases.map((each) => each.case_number),
      reason_code: "MEETS_POLICY",
    });
    assert.equal(batch_result.approved.length, 8);
    assert.equal(batch_result.failed.length, 0);

    for (let customer_number = 2001; customer_number <= 2008; customer_number += 1) {
      const fee_history = await api.get(`/banking/customers/CUS-${customer_number}/fee_history`);
      const refunded_fee = fee_history.fees.find((fee) => fee.txn_id === `TXN-F${customer_number}`);
      assert.equal(refunded_fee.is_refunded, true, `TXN-F${customer_number} has a FEE_REFUND row with reverses_txn_id set`);
    }

    const remaining_inbox = await api.get("/approvals/inbox");
    assert.equal(remaining_inbox.filter((each) => each.action_code === "REFUND_FEE" && each.matched_rule_id === "RF-3").length, 0);
  });

  test("6. decision explainer for Priya: every condition with its values, the versions and the approver", async () => {
    const explanation = await api.get(`/explanations/cases/${priya_case_number}`);

    const matched_rule = explanation.rules.find((rule) => rule.is_matched);
    assert.equal(matched_rule.rule_id, "HR-3");
    assert.equal(matched_rule.conditions.length, 2);
    for (const condition of matched_rule.conditions) {
      assert.equal(condition.passed, true);
      assert.notEqual(condition.actual, undefined);
    }
    const income_condition = matched_rule.conditions.find((condition) => condition.fact === "income_drop_pct");
    assert.ok(Number(income_condition.actual) >= 50);

    const failed_care_rule = explanation.rules.find((rule) => rule.rule_id === "HR-1");
    assert.equal(failed_care_rule.conditions[0].passed, false);

    assert.equal(explanation.versions.policy_id, "POL-HARDSHIP_REQUEST-1");
    assert.equal(explanation.versions.policy_version, 1);
    const active_prompt = (await api.get("/resources/prompt_versions")).find((prompt_version) => prompt_version.is_active);
    assert.equal(explanation.versions.prompt_version, active_prompt.version);
    assert.ok(explanation.versions.model);
    assert.equal(explanation.human_decision.decided_by_name, "Sam Patel");
    assert.equal(explanation.human_decision.decision, "APPROVED");
    assert.ok(explanation.interventions.some((intervention) => intervention.type === "INSTRUCTION"));
    assert.ok(explanation.tool_calls.some((tool_call) => tool_call.tool_name === "propose_action"));
    assert.ok(explanation.customer_explanation.length > 40);
  });

  test("7. the audit ledger rejects UPDATE", async () => {
    const tamper_result = await api.post("/audit/tamper_test");
    assert.equal(tamper_result.is_rejected, true);
    assert.match(tamper_result.database_error, /append-only/i);
  });
});
