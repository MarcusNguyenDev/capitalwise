import { CallScript, ScriptStep } from '../call_scripts/types/call_script.type';
import { CallEndedError } from '../calls/errors/call_ended.error';
import { calculateSpeakingDelayMs } from './calculate_speaking_delay.util';
import { SimulatedCallRunner } from './simulated_call.runner';
import { SimulatedCallRunnerDependencies } from './types/simulated_call_runner_dependencies.type';

const CALL_ID = '0b0f7c0e-5d3a-4f6e-9a55-3a3f3a3f3a3f';

function buildScript(steps: ScriptStep[]): CallScript {
  return {
    script_id: 'test_script',
    title: 'Test script',
    customer_id: 'CUS-3003',
    caller_number: '+61491575254',
    steps,
  };
}

function buildHarness(steps: ScriptStep[], speed = 1) {
  const dependencies: jest.Mocked<SimulatedCallRunnerDependencies> = {
    script: buildScript(steps),
    bank_name: 'Demo Bank',
    getSpeed: jest.fn().mockReturnValue(speed),
    createCall: jest.fn().mockResolvedValue({ call_id: CALL_ID }),
    addTurn: jest.fn().mockResolvedValue({}),
    dispatchTool: jest.fn().mockResolvedValue({ ok: true, result: {} }),
    markInstructionApplied: jest.fn().mockResolvedValue(null),
    approveIdentityPush: jest.fn().mockResolvedValue({}),
    endCall: jest.fn().mockResolvedValue({}),
  };
  const runner = new SimulatedCallRunner(dependencies);
  const listSpokenLines = () =>
    dependencies.addTurn.mock.calls.map(
      ([, new_turn]) => `${new_turn.speaker}: ${new_turn.text}`,
    );
  return { runner, dependencies, listSpokenLines };
}

describe('calculateSpeakingDelayMs', () => {
  it('paces at 60 ms per character, clamped to 1.2 s and 5 s, divided by the speed', () => {
    expect(calculateSpeakingDelayMs('Hi.', 1)).toBe(1200);
    expect(calculateSpeakingDelayMs('x'.repeat(50), 1)).toBe(3000);
    expect(calculateSpeakingDelayMs('x'.repeat(500), 1)).toBe(5000);
    expect(calculateSpeakingDelayMs('x'.repeat(50), 2)).toBe(1500);
  });
});

describe('SimulatedCallRunner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('plays turns, tools and insights in order, resolves placeholders and ends the call itself', async () => {
    const { runner, dependencies, listSpokenLines } = buildHarness([
      { type: 'ai', text: "You've reached {{bank_name}}." },
      { type: 'customer', text: 'I want a person.' },
      { type: 'insight', intent: 'Wants a person', sentiment: 'NEGATIVE' },
      { type: 'tool', tool_name: 'request_human', args: { reason: 'Asked' } },
      {
        type: 'ai',
        text: '{{request_human.specialist_name}} will join. Ref {{request_human.case_number|pending}}.',
      },
      { type: 'pause', seconds: 2 },
    ]);
    dependencies.dispatchTool.mockImplementation(async (_call_id, tool_name) =>
      tool_name === 'request_human'
        ? {
            ok: true,
            result: {
              specialist_name: 'Jordan Lee',
              case_number: 'CASE-001102',
            },
          }
        : { ok: true, result: { updated: true } },
    );

    const run_promise = runner.run();
    await jest.advanceTimersByTimeAsync(60_000);
    await run_promise;

    expect(dependencies.createCall).toHaveBeenCalledWith({
      caller_number: '+61491575254',
      channel: 'SIMULATED',
      mode: 'SCRIPTED',
    });
    expect(listSpokenLines()).toEqual([
      "AI: You've reached Demo Bank.",
      'CUSTOMER: I want a person.',
      'AI: Jordan Lee will join. Ref CASE-001102.',
    ]);
    expect(dependencies.dispatchTool.mock.calls).toEqual([
      [
        CALL_ID,
        'update_call_insight',
        { intent: 'Wants a person', sentiment: 'NEGATIVE', summary: undefined },
      ],
      [CALL_ID, 'request_human', { reason: 'Asked' }],
    ]);
    // AI turns carry a simulated response time; customer turns do not.
    expect(dependencies.addTurn.mock.calls[0][1].latency_ms).toEqual(
      expect.any(Number),
    );
    expect(dependencies.addTurn.mock.calls[1][1].latency_ms).toBeUndefined();
    expect(dependencies.endCall).toHaveBeenCalledWith(CALL_ID, {
      ended_by: 'CUSTOMER',
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps going with the fallback text when a tool answers ok:false', async () => {
    const { runner, dependencies, listSpokenLines } = buildHarness([
      { type: 'tool', tool_name: 'request_human', args: { reason: 'Asked' } },
      {
        type: 'ai',
        text: '{{request_human.specialist_name|A specialist}} will join.',
      },
    ]);
    dependencies.dispatchTool.mockResolvedValue({
      ok: false,
      error: { code: 'ENGINE_API_UNAVAILABLE', message: 'down' },
    });

    const run_promise = runner.run();
    await jest.advanceTimersByTimeAsync(30_000);
    await run_promise;

    expect(listSpokenLines()).toEqual(['AI: A specialist will join.']);
    expect(dependencies.endCall).toHaveBeenCalledTimes(1);
  });

  it('answers identity questions with ids from the challenge it started, then uses the first name', async () => {
    const { runner, dependencies, listSpokenLines } = buildHarness([
      { type: 'tool', tool_name: 'start_identity_check', args: { level: 1 } },
      { type: 'customer', text: '14th of September 1992.' },
      {
        type: 'tool',
        tool_name: 'submit_identity_answers',
        args: {
          challenge_id: '{{start_identity_check.challenge_id}}',
          answers: [
            {
              question_id: '{{start_identity_check.questions.1.question_id}}',
              answer: '14th of September 1992',
            },
          ],
        },
      },
      {
        type: 'ai',
        text: 'Thanks, {{submit_identity_answers.first_name|there}}.',
      },
    ]);
    dependencies.dispatchTool.mockImplementation(async (_call_id, tool_name) =>
      tool_name === 'start_identity_check'
        ? {
            ok: true,
            result: {
              challenge_id: 'IDC-000042',
              questions: [
                { question_id: 'Q1', kind: 'FULL_NAME' },
                { question_id: 'Q2', kind: 'DATE_OF_BIRTH' },
              ],
            },
          }
        : {
            ok: true,
            result: { is_passed: true, identity_level: 1, first_name: 'Sarah' },
          },
    );

    const run_promise = runner.run();
    await jest.advanceTimersByTimeAsync(30_000);
    await run_promise;

    expect(dependencies.dispatchTool.mock.calls[1]).toEqual([
      CALL_ID,
      'submit_identity_answers',
      {
        challenge_id: 'IDC-000042',
        answers: [{ question_id: 'Q2', answer: '14th of September 1992' }],
      },
    ]);
    expect(listSpokenLines()).toEqual([
      'CUSTOMER: 14th of September 1992.',
      'AI: Thanks, Sarah.',
    ]);
  });

  describe('await_instruction', () => {
    const steps: ScriptStep[] = [
      { type: 'customer', text: 'It has been a rough month.' },
      {
        type: 'await_instruction',
        timeout_seconds: 60,
        ai_with_instruction: 'That sounds really hard. I am sorry.',
        ai_without_instruction: 'Thanks for explaining.',
      },
      { type: 'ai', text: 'One moment.' },
    ];

    it('waits, marks the instruction applied, then says the instructed line', async () => {
      const { runner, dependencies, listSpokenLines } = buildHarness(steps);

      const run_promise = runner.run();
      await jest.advanceTimersByTimeAsync(20_000);
      // Still waiting for the supervisor: nothing after the customer line yet.
      expect(listSpokenLines()).toEqual([
        'CUSTOMER: It has been a rough month.',
      ]);

      runner.handleIntervention({
        intervention_id: 'INT-00007',
        type: 'INSTRUCTION',
      });
      await jest.advanceTimersByTimeAsync(20_000);
      await run_promise;

      expect(dependencies.markInstructionApplied).toHaveBeenCalledWith(
        CALL_ID,
        'INT-00007',
      );
      expect(listSpokenLines()).toEqual([
        'CUSTOMER: It has been a rough month.',
        'AI: That sounds really hard. I am sorry.',
        'AI: One moment.',
      ]);
      const applied_order =
        dependencies.markInstructionApplied.mock.invocationCallOrder[0];
      const instructed_line_order =
        dependencies.addTurn.mock.invocationCallOrder[1];
      expect(applied_order).toBeLessThan(instructed_line_order);
    });

    it('uses an instruction that arrived before the waiting point', async () => {
      const { runner, dependencies, listSpokenLines } = buildHarness(steps);

      const run_promise = runner.run();
      await jest.advanceTimersByTimeAsync(100);
      runner.handleIntervention({
        intervention_id: 'INT-00008',
        type: 'INSTRUCTION',
      });
      await jest.advanceTimersByTimeAsync(15_000);
      await run_promise;

      expect(dependencies.markInstructionApplied).toHaveBeenCalledWith(
        CALL_ID,
        'INT-00008',
      );
      expect(listSpokenLines()[1]).toBe(
        'AI: That sounds really hard. I am sorry.',
      );
    });

    it('says the plain line after the timeout when no instruction arrives', async () => {
      const { runner, dependencies, listSpokenLines } = buildHarness(steps);

      const run_promise = runner.run();
      await jest.advanceTimersByTimeAsync(59_000);
      expect(listSpokenLines()).toHaveLength(1);

      await jest.advanceTimersByTimeAsync(30_000);
      await run_promise;

      expect(dependencies.markInstructionApplied).not.toHaveBeenCalled();
      expect(listSpokenLines()).toEqual([
        'CUSTOMER: It has been a rough month.',
        'AI: Thanks for explaining.',
        'AI: One moment.',
      ]);
      expect(dependencies.endCall).toHaveBeenCalledTimes(1);
    });

    it('does not shorten the wait for a human when the speed is 2x', async () => {
      const { runner, listSpokenLines } = buildHarness(steps, 2);

      const run_promise = runner.run();
      await jest.advanceTimersByTimeAsync(45_000);
      expect(listSpokenLines()).toHaveLength(1);

      await jest.advanceTimersByTimeAsync(30_000);
      await run_promise;
      expect(listSpokenLines()).toHaveLength(3);
    });
  });

  describe('await_takeover', () => {
    const steps: ScriptStep[] = [
      { type: 'ai', text: 'A specialist will join shortly.' },
      {
        type: 'await_takeover',
        timeout_seconds: 120,
        ai_if_timeout: 'Sorry, they will call you back.',
      },
      { type: 'ai', text: 'Take care.' },
    ];

    it('apologises and carries on to the end when nobody takes over in time', async () => {
      const { runner, dependencies, listSpokenLines } = buildHarness(steps);

      const run_promise = runner.run();
      await jest.advanceTimersByTimeAsync(119_000);
      expect(listSpokenLines()).toEqual([
        'AI: A specialist will join shortly.',
      ]);

      await jest.advanceTimersByTimeAsync(30_000);
      await run_promise;

      expect(listSpokenLines()).toEqual([
        'AI: A specialist will join shortly.',
        'AI: Sorry, they will call you back.',
        'AI: Take care.',
      ]);
      expect(dependencies.endCall).toHaveBeenCalledWith(CALL_ID, {
        ended_by: 'CUSTOMER',
      });
      expect(jest.getTimerCount()).toBe(0);
    });

    it('stays silent while a human has the call and resumes after the handback', async () => {
      const { runner, dependencies, listSpokenLines } = buildHarness(steps);

      const run_promise = runner.run();
      await jest.advanceTimersByTimeAsync(10_000);
      runner.handleIntervention({
        intervention_id: 'INT-00001',
        type: 'TAKEOVER',
      });

      // Far beyond the timeout: the script must stay paused, and not end the call.
      await jest.advanceTimersByTimeAsync(600_000);
      expect(listSpokenLines()).toEqual([
        'AI: A specialist will join shortly.',
      ]);
      expect(dependencies.endCall).not.toHaveBeenCalled();

      runner.handleIntervention({
        intervention_id: 'INT-00002',
        type: 'HANDBACK',
      });
      await jest.advanceTimersByTimeAsync(30_000);
      await run_promise;

      expect(dependencies.markInstructionApplied).toHaveBeenCalledWith(
        CALL_ID,
        'INT-00002',
      );
      expect(listSpokenLines()).toEqual([
        'AI: A specialist will join shortly.',
        'AI: Take care.',
      ]);
      expect(dependencies.endCall).toHaveBeenCalledTimes(1);
    });

    it('pauses on a takeover that happens at any other point of the script', async () => {
      const { runner, listSpokenLines } = buildHarness([
        { type: 'ai', text: 'First line.' },
        { type: 'ai', text: 'Second line.' },
      ]);

      const run_promise = runner.run();
      await jest.advanceTimersByTimeAsync(1_300);
      runner.handleIntervention({
        intervention_id: 'INT-00001',
        type: 'TAKEOVER',
      });
      await jest.advanceTimersByTimeAsync(60_000);
      expect(listSpokenLines()).toEqual(['AI: First line.']);

      runner.handleIntervention({
        intervention_id: 'INT-00002',
        type: 'HANDBACK',
      });
      await jest.advanceTimersByTimeAsync(10_000);
      await run_promise;
      expect(listSpokenLines()).toEqual([
        'AI: First line.',
        'AI: Second line.',
      ]);
    });
  });

  describe('stopping and failures', () => {
    it('abort clears every timer and stops speaking without ending the call itself', async () => {
      const { runner, dependencies, listSpokenLines } = buildHarness([
        { type: 'ai', text: 'First line.' },
        {
          type: 'await_instruction',
          timeout_seconds: 60,
          ai_with_instruction: 'With.',
          ai_without_instruction: 'Without.',
        },
        { type: 'ai', text: 'Never said.' },
      ]);

      const run_promise = runner.run();
      await jest.advanceTimersByTimeAsync(5_000);
      runner.abort();
      await run_promise;
      await jest.advanceTimersByTimeAsync(120_000);

      expect(listSpokenLines()).toEqual(['AI: First line.']);
      expect(dependencies.endCall).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('stops quietly when the call was ended from outside', async () => {
      const { runner, dependencies } = buildHarness([
        { type: 'ai', text: 'First line.' },
        { type: 'ai', text: 'Second line.' },
      ]);
      dependencies.addTurn.mockRejectedValueOnce(new CallEndedError(CALL_ID));

      const run_promise = runner.run();
      await jest.advanceTimersByTimeAsync(30_000);
      await expect(run_promise).resolves.toBeUndefined();

      expect(dependencies.addTurn).toHaveBeenCalledTimes(1);
      expect(dependencies.endCall).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('ends the call and never rejects when a step fails unexpectedly', async () => {
      const { runner, dependencies } = buildHarness([
        { type: 'ai', text: 'First line.' },
      ]);
      dependencies.addTurn.mockRejectedValueOnce(new Error('database is down'));

      const run_promise = runner.run();
      await jest.advanceTimersByTimeAsync(30_000);
      await expect(run_promise).resolves.toBeUndefined();

      expect(dependencies.endCall).toHaveBeenCalledWith(CALL_ID, {
        ended_by: 'SYSTEM',
      });
    });

    it('approves the optional app check about two seconds after it was sent, faster at 2x', async () => {
      const { runner, dependencies } = buildHarness(
        [{ type: 'pause', seconds: 30 }],
        2,
      );

      const run_promise = runner.run();
      await jest.advanceTimersByTimeAsync(10);
      runner.handleIdentityPushSent('NTF-00009');
      await jest.advanceTimersByTimeAsync(900);
      expect(dependencies.approveIdentityPush).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(200);
      expect(dependencies.approveIdentityPush).toHaveBeenCalledWith(
        'NTF-00009',
      );

      await jest.advanceTimersByTimeAsync(60_000);
      await run_promise;
    });
  });
});
