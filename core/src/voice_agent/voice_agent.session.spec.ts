import { AiProviderRequestFailedError } from '../ai/errors/ai_provider_request_failed.error';
import { AiRequestAbortedError } from '../ai/errors/ai_request_aborted.error';
import { ChatRequest } from '../ai/types/chat_request.type';
import { ChatStreamEvent } from '../ai/types/chat_stream_event.type';
import { HOLD_PHRASES } from '../hold_buffer/constants/hold_phrases.constant';
import { HoldPolicy } from '../hold_buffer/hold.policy';
import { EnergyVoiceActivityDetector } from '../turn_detection/energy_voice_activity.detector';
import { AGENT_PHRASES, buildGreeting } from './constants/agent_phrases.constant';
import { AgentRoom, AgentRoomListeners } from './types/agent_room.type';
import { VoiceAgentSession } from './voice_agent.session';

const CALL_ID = '0b0f7c0e-5d3a-4f6e-9a55-3a3f3a3f3a3f';
const SYSTEM_PROMPT = 'You are the AI phone specialist for Demo Bank.';
const AI_VOICE = 'bf_emma';
const STAFF_VOICE = 'bm_george';

// A model reply: events to stream, optionally hanging until aborted.
interface ScriptedReply {
  events: ChatStreamEvent[];
  should_hang?: boolean;
  error?: Error;
}

class FakeAgentRoom implements AgentRoom {
  listeners: AgentRoomListeners | null = null;
  captured_frame_count = 0;
  clear_count = 0;
  has_left = false;

  async join(listeners: AgentRoomListeners): Promise<void> {
    this.listeners = listeners;
  }

  // Asynchronous like a real audio source, so playback spans several ticks.
  async captureFrame(): Promise<void> {
    this.captured_frame_count += 1;
    await new Promise((resolve) => setImmediate(resolve));
  }

  clearQueue(): void {
    this.clear_count += 1;
  }

  readQueuedDurationMs(): number {
    return 0;
  }

  async leave(): Promise<void> {
    this.has_left = true;
  }
}

function renderFrames(kind: 'speech' | 'silence', duration_ms: number): Int16Array[] {
  const frames: Int16Array[] = [];
  for (let frame_index = 0; frame_index < duration_ms / 10; frame_index++) {
    const frame = new Int16Array(160);
    if (kind === 'speech') {
      for (let sample_index = 0; sample_index < 160; sample_index++) {
        frame[sample_index] = Math.round(
          Math.sin((2 * Math.PI * 200 * (frame_index * 160 + sample_index)) / 16_000) *
            6_000,
        );
      }
    }
    frames.push(frame);
  }
  return frames;
}

async function waitFor(isConditionMet: () => boolean, label: string): Promise<void> {
  const deadline_ms = Date.now() + 3_000;
  while (!isConditionMet()) {
    if (Date.now() > deadline_ms) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function textReply(reply_text: string): ScriptedReply {
  return {
    events: [
      { type: 'text_delta', text: reply_text },
      {
        type: 'done',
        finish_reason: 'stop',
        usage: { input_tokens: 100, output_tokens: 10, cached_input_tokens: 0 },
      },
    ],
  };
}

function toolReply(tool_name: string, tool_args: Record<string, unknown> = {}): ScriptedReply {
  return {
    events: [
      {
        type: 'tool_call',
        tool_call_id: `call_${tool_name}`,
        name: tool_name,
        arguments: tool_args,
      },
      {
        type: 'done',
        finish_reason: 'tool_calls',
        usage: { input_tokens: 100, output_tokens: 5, cached_input_tokens: 0 },
      },
    ],
  };
}

function buildHarness(harness_options: { tool_delay_ms?: number; is_hold_tone_enabled?: boolean } = {}) {
  const scripted_replies: ScriptedReply[] = [];
  const transcripts: string[] = [];
  const chat_requests: ChatRequest[] = [];
  const recorded_turns: { speaker: string; text: string; latency_ms?: number }[] = [];
  const played_phrases: string[] = [];
  const synthesized: { text: string; voice?: string }[] = [];
  const hold_events: string[] = [];
  const agent_room = new FakeAgentRoom();
  let is_stopped_callback_called = false;

  const chat = jest.fn((chat_request: ChatRequest) => {
    chat_requests.push(chat_request);
    const scripted_reply = scripted_replies.shift() ?? textReply('Okay.');
    return (async function* (): AsyncGenerator<ChatStreamEvent> {
      if (scripted_reply.error) {
        throw scripted_reply.error;
      }
      for (const chat_event of scripted_reply.events) {
        yield chat_event;
      }
      if (scripted_reply.should_hang) {
        await new Promise((_resolve, reject) => {
          chat_request.abort_signal?.addEventListener('abort', () =>
            reject(new AiRequestAbortedError('ollama')),
          );
        });
      }
    })();
  });
  const dispatchTool = jest.fn(async (_call_id: string, tool_name: string) => {
    if (harness_options.tool_delay_ms && tool_name !== 'get_caller_context') {
      await new Promise((resolve) => setTimeout(resolve, harness_options.tool_delay_ms));
    }
    if (tool_name === 'get_caller_context') {
      return { ok: true as const, result: { matched: true, first_name: 'Sarah' } };
    }
    return { ok: true as const, result: { tool_name } };
  });
  const markInstructionApplied = jest.fn().mockResolvedValue(undefined);
  const endCall = jest.fn().mockResolvedValue(undefined);
  const synthesize = jest.fn(async (speech_request: { text: string; voice?: string }) => {
    synthesized.push({ text: speech_request.text, voice: speech_request.voice });
    return {
      pcm: new Int16Array(2_400),
      sample_rate: 24_000,
      provider: 'speaches' as const,
      model: 'kokoro',
      voice: speech_request.voice ?? AI_VOICE,
    };
  });

  const session = new VoiceAgentSession({
    call_id: CALL_ID,
    settings: {
      bank_name: 'Demo Bank',
      system_prompt: SYSTEM_PROMPT,
      tools: [
        {
          type: 'function',
          function: { name: 'lock_card', description: 'Lock a card', parameters: {} },
        },
      ],
      ai_voice: AI_VOICE,
      staff_voice: STAFF_VOICE,
      is_hold_tone_enabled: harness_options.is_hold_tone_enabled ?? false,
      is_human_active_at_start: false,
    },
    agent_room,
    hold_policy: new HoldPolicy({ reminder_interval_ms: 60, return_threshold_ms: 40 }),
    voice_activity_detector: new EnergyVoiceActivityDetector({
      sample_rate: 16_000,
      speech_start_ms: 200,
      end_of_turn_silence_ms: 700,
      energy_threshold_ratio: 3,
      min_utterance_ms: 300,
      max_utterance_ms: 30_000,
      pre_roll_ms: 300,
    }),
    ai: {
      chat,
      transcribe: jest.fn(async () => ({
        text: transcripts.shift() ?? '',
        duration_seconds: 1.5,
        provider: 'speaches' as const,
        model: 'whisper',
      })),
      synthesize,
    },
    getPhraseAudio: jest.fn(async (phrase_text: string) => {
      played_phrases.push(phrase_text);
      return new Int16Array(2_400);
    }),
    calls: {
      addTurn: jest.fn(async (_call_id, new_turn) => {
        recorded_turns.push(new_turn);
      }),
      recordUsage: jest.fn().mockResolvedValue(undefined),
      endCall,
    },
    dispatchTool,
    hold: {
      startHold: jest.fn(async (_call_id, hold_start) => {
        hold_events.push(`start:${hold_start.reason}:${hold_start.tool_name}`);
      }),
      endHold: jest.fn(async () => {
        hold_events.push('end');
        return 0;
      }),
    },
    markInstructionApplied,
    emitTranscriptDelta: jest.fn(),
    onStopped: () => {
      is_stopped_callback_called = true;
    },
  });

  // The caller says something: speech, then enough silence to end the turn.
  const sayToAgent = (transcript_text: string, speech_ms = 600) => {
    transcripts.push(transcript_text);
    const listeners = agent_room.listeners as AgentRoomListeners;
    [...renderFrames('speech', speech_ms), ...renderFrames('silence', 800)].forEach(
      (frame) => listeners.onCustomerAudioFrame(frame),
    );
  };

  const joinAndWaitForGreeting = async () => {
    await session.start();
    (agent_room.listeners as AgentRoomListeners).onCustomerPresenceChanged(true);
    await waitFor(() => recorded_turns.length >= 2, 'the greeting and opening reply');
    await session.waitUntilSettled();
  };

  return {
    session,
    agent_room,
    scripted_replies,
    chat,
    chat_requests,
    recorded_turns,
    played_phrases,
    synthesized,
    hold_events,
    dispatchTool,
    markInstructionApplied,
    endCall,
    sayToAgent,
    joinAndWaitForGreeting,
    readIsStoppedCallbackCalled: () => is_stopped_callback_called,
  };
}

describe('VoiceAgentSession', () => {
  let harness: ReturnType<typeof buildHarness>;

  afterEach(async () => {
    await harness?.session.stop('test finished');
  });

  it('opens with the fixed greeting, runs get_caller_context and lets the model greet by name', async () => {
    harness = buildHarness();
    harness.scripted_replies.push(textReply('Hi Sarah, how can I help today?'));

    await harness.joinAndWaitForGreeting();

    expect(harness.played_phrases[0]).toBe(buildGreeting('Demo Bank'));
    expect(harness.dispatchTool).toHaveBeenCalledWith(CALL_ID, 'get_caller_context', {});
    expect(harness.recorded_turns).toEqual([
      { speaker: 'AI', text: buildGreeting('Demo Bank'), latency_ms: undefined },
      { speaker: 'AI', text: 'Hi Sarah, how can I help today?', latency_ms: undefined },
    ]);
    const opening_messages = harness.chat_requests[0].messages;
    expect(opening_messages[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT });
    expect(opening_messages[1]).toMatchObject({
      role: 'assistant',
      tool_calls: [{ name: 'get_caller_context' }],
    });
    expect(opening_messages[2]).toMatchObject({ role: 'tool', name: 'get_caller_context' });
    expect(harness.chat_requests[0].tools).toHaveLength(1);
  });

  it('answers a customer turn: transcript, model reply spoken, latency recorded', async () => {
    harness = buildHarness();
    harness.scripted_replies.push(textReply('Hi Sarah.'), textReply('I can help with that. Let me see.'));
    await harness.joinAndWaitForGreeting();

    harness.sayToAgent('I think I lost my debit card.');
    await waitFor(() => harness.recorded_turns.length >= 4, 'the reply');
    await harness.session.waitUntilSettled();

    expect(harness.recorded_turns[2]).toEqual({
      speaker: 'CUSTOMER',
      text: 'I think I lost my debit card.',
    });
    expect(harness.recorded_turns[3]).toMatchObject({
      speaker: 'AI',
      text: 'I can help with that. Let me see.',
      latency_ms: expect.any(Number),
    });
    expect(harness.chat_requests[1].messages.at(-1)).toEqual({
      role: 'user',
      content: 'I think I lost my debit card.',
    });
    // Both sentences were synthesised in the AI voice.
    expect(harness.synthesized.slice(-2)).toEqual([
      { text: 'I can help with that.', voice: AI_VOICE },
      { text: 'Let me see.', voice: AI_VOICE },
    ]);
  });

  it('runs a tool round on hold: acknowledgement, reminders, thanks, then the answer', async () => {
    harness = buildHarness({ tool_delay_ms: 150 });
    harness.scripted_replies.push(
      textReply('Hi Sarah.'),
      toolReply('get_customer_overview'),
      textReply('I can see your debit card ending in four eight two one.'),
    );
    await harness.joinAndWaitForGreeting();

    harness.sayToAgent('Can you check my cards?');
    await waitFor(
      () => harness.recorded_turns.some((turn) => turn.text.includes('four eight two one')),
      'the answer after the tool',
    );
    await harness.session.waitUntilSettled();

    expect(harness.hold_events).toEqual(['start:CHECKING_SYSTEM:get_customer_overview', 'end']);
    const ai_texts = harness.recorded_turns.filter((turn) => turn.speaker === 'AI').map((turn) => turn.text);
    expect(ai_texts).toEqual([
      buildGreeting('Demo Bank'),
      'Hi Sarah.',
      HOLD_PHRASES.CHECKING_SYSTEM_ACKNOWLEDGEMENT,
      HOLD_PHRASES.RETURN_FROM_HOLD,
      'I can see your debit card ending in four eight two one.',
    ]);
    // The acknowledgement was the first audio after the customer spoke.
    const acknowledgement_turn = harness.recorded_turns.find(
      (turn) => turn.text === HOLD_PHRASES.CHECKING_SYSTEM_ACKNOWLEDGEMENT,
    );
    expect(acknowledgement_turn?.latency_ms).toEqual(expect.any(Number));
    // Reminders are played (never recorded) while the tool runs.
    expect(harness.played_phrases).toContain(HOLD_PHRASES.CHECKING_SYSTEM_REMINDER);
    const follow_up_messages = harness.chat_requests[2].messages;
    expect(follow_up_messages.at(-1)).toMatchObject({
      role: 'tool',
      name: 'get_customer_overview',
      content: JSON.stringify({ ok: true, result: { tool_name: 'get_customer_overview' } }),
    });
  });

  it('uses the app-approval line for the identity push and skips the thanks after a short hold', async () => {
    harness = buildHarness();
    harness.scripted_replies.push(textReply('Hi Sarah.'), toolReply('send_identity_push'), textReply('Thanks, you are verified.'));
    await harness.joinAndWaitForGreeting();

    harness.sayToAgent('I lost my card.');
    await waitFor(
      () => harness.recorded_turns.some((turn) => turn.text === 'Thanks, you are verified.'),
      'the verified reply',
    );

    expect(harness.hold_events[0]).toBe('start:WAITING_FOR_APP_APPROVAL:send_identity_push');
    const ai_texts = harness.recorded_turns.map((turn) => turn.text);
    expect(ai_texts).toContain(HOLD_PHRASES.APP_APPROVAL_ACKNOWLEDGEMENT);
    expect(ai_texts).not.toContain(HOLD_PHRASES.RETURN_FROM_HOLD);
  });

  it('stops talking and aborts the model when the caller barges in', async () => {
    harness = buildHarness();
    harness.scripted_replies.push(
      textReply('Hi Sarah.'),
      {
        events: [{ type: 'text_delta', text: 'There are a few things we can do here. ' }],
        should_hang: true,
      },
      textReply('Of course, your credit card.'),
    );
    await harness.joinAndWaitForGreeting();

    harness.sayToAgent('I need help with a card.');
    await waitFor(() => harness.synthesized.length >= 2, 'the first sentence to be spoken');
    harness.sayToAgent('Sorry, it is my credit card.');
    await waitFor(
      () => harness.recorded_turns.some((turn) => turn.text === 'Of course, your credit card.'),
      'the reply after the barge-in',
    );

    const aborted_request = harness.chat_requests[1];
    expect(aborted_request.abort_signal?.aborted).toBe(true);
    expect(harness.recorded_turns.map((turn) => turn.text)).toEqual([
      buildGreeting('Demo Bank'),
      'Hi Sarah.',
      'I need help with a card.',
      'There are a few things we can do here. …',
      'Sorry, it is my credit card.',
      'Of course, your credit card.',
    ]);
    expect(harness.chat_requests[2].messages.slice(-2)).toEqual([
      { role: 'assistant', content: 'There are a few things we can do here. …' },
      { role: 'user', content: 'Sorry, it is my credit card.' },
    ]);
  });

  it('goes silent on TAKEOVER, speaks staff messages in the staff voice and resumes on HANDBACK', async () => {
    harness = buildHarness();
    harness.scripted_replies.push(textReply('Hi Sarah.'));
    await harness.joinAndWaitForGreeting();

    harness.session.handleCommand({
      command: 'TAKEOVER',
      text: "You're now speaking with Alex from our team",
      intervention_id: 'INT-1',
      staff_name: 'Alex Chen',
    });
    await waitFor(
      () => harness.recorded_turns.some((turn) => turn.text.startsWith("You're now speaking")),
      'the handover line',
    );
    expect(harness.played_phrases.at(-1)).toBe("You're now speaking with Alex from our team.");

    harness.sayToAgent('Hello Alex.');
    await waitFor(
      () => harness.recorded_turns.some((turn) => turn.text === 'Hello Alex.'),
      'the transcript during the takeover',
    );
    await harness.session.waitUntilSettled();
    const chat_count_during_takeover = harness.chat.mock.calls.length;

    harness.session.handleCommand({
      command: 'STAFF_MESSAGE',
      text: 'Your money is safe.',
      intervention_id: null,
      staff_name: 'Alex Chen',
    });
    await waitFor(
      () => harness.synthesized.some((each) => each.text === 'Your money is safe.'),
      'the staff message',
    );
    expect(harness.synthesized.find((each) => each.text === 'Your money is safe.')?.voice).toBe(STAFF_VOICE);
    expect(harness.recorded_turns.some((turn) => turn.text === 'Your money is safe.')).toBe(false);
    expect(harness.chat.mock.calls.length).toBe(chat_count_during_takeover);

    harness.scripted_replies.push(textReply('Thanks Sarah, I am back with you.'));
    harness.session.handleCommand({
      command: 'HANDBACK',
      text: 'Customer is reassured. Close warmly.',
      intervention_id: 'INT-2',
      staff_name: 'Alex Chen',
    });
    await waitFor(
      () => harness.recorded_turns.some((turn) => turn.text === 'Thanks Sarah, I am back with you.'),
      'the reply after the handback',
    );
    expect(harness.markInstructionApplied).toHaveBeenCalledWith(CALL_ID, 'INT-2');
    const handback_messages = harness.chat_requests.at(-1)?.messages ?? [];
    expect(handback_messages).toEqual(
      expect.arrayContaining([
        { role: 'user', content: 'Hello Alex.' },
        { role: 'system', content: 'Supervisor instruction: Customer is reassured. Close warmly.' },
      ]),
    );
  });

  it('applies a supervisor instruction at once when idle and marks it applied', async () => {
    harness = buildHarness();
    harness.scripted_replies.push(textReply('Hi Sarah.'), textReply('The National Debt Helpline is on 1800 007 007.'));
    await harness.joinAndWaitForGreeting();

    harness.session.handleCommand({
      command: 'INSTRUCTION',
      text: 'Mention the National Debt Helpline',
      intervention_id: 'INT-3',
      staff_name: 'Alex Chen',
    });
    await waitFor(
      () => harness.recorded_turns.some((turn) => turn.text.includes('1800 007 007')),
      'the instructed reply',
    );

    expect(harness.markInstructionApplied).toHaveBeenCalledWith(CALL_ID, 'INT-3');
    expect(harness.chat_requests[1].messages.at(-1)).toEqual({
      role: 'system',
      content: 'Supervisor instruction: Mention the National Debt Helpline',
    });
  });

  it('apologises and asks for a person once when a provider fails', async () => {
    harness = buildHarness();
    harness.scripted_replies.push(textReply('Hi Sarah.'), {
      events: [],
      error: new AiProviderRequestFailedError('ollama', 'HTTP 500'),
    });
    await harness.joinAndWaitForGreeting();

    harness.sayToAgent('Hello?');
    await waitFor(
      () => harness.dispatchTool.mock.calls.some((call) => call[1] === 'request_human'),
      'the request for a person',
    );

    expect(harness.recorded_turns.map((turn) => turn.text)).toContain(AGENT_PHRASES.TROUBLE_APOLOGY);
    expect(harness.dispatchTool).toHaveBeenCalledWith(CALL_ID, 'request_human', {
      reason: expect.stringContaining('system problem'),
    });
  });

  it('gives a fallback line after four tool rounds in one turn', async () => {
    harness = buildHarness();
    harness.scripted_replies.push(
      textReply('Hi Sarah.'),
      toolReply('update_call_insight'),
      toolReply('update_call_insight'),
      toolReply('update_call_insight'),
      toolReply('update_call_insight'),
      toolReply('update_call_insight'),
    );
    await harness.joinAndWaitForGreeting();

    harness.sayToAgent('What is going on?');
    await waitFor(
      () => harness.recorded_turns.some((turn) => turn.text === AGENT_PHRASES.TOOL_ROUNDS_FALLBACK),
      'the fallback line',
    );

    const insight_calls = harness.dispatchTool.mock.calls.filter(
      (call) => call[1] === 'update_call_insight',
    );
    expect(insight_calls).toHaveLength(4);
  });

  it('stops everything on END_CALL and ignores the caller afterwards', async () => {
    harness = buildHarness();
    harness.scripted_replies.push(textReply('Hi Sarah.'));
    await harness.joinAndWaitForGreeting();

    harness.session.handleCommand({
      command: 'END_CALL',
      text: null,
      intervention_id: 'INT-4',
      staff_name: 'Alex Chen',
    });
    await waitFor(() => harness.readIsStoppedCallbackCalled(), 'the session to stop');
    const chat_count_at_end = harness.chat.mock.calls.length;
    harness.sayToAgent('Are you still there?');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(harness.agent_room.has_left).toBe(true);
    expect(harness.session.is_running).toBe(false);
    expect(harness.chat.mock.calls.length).toBe(chat_count_at_end);
    expect(harness.recorded_turns.some((turn) => turn.text === 'Are you still there?')).toBe(false);
  });

  it('ends the call when no customer joins in time', async () => {
    jest.useFakeTimers();
    try {
      harness = buildHarness();
      await harness.session.start();

      jest.advanceTimersByTime(30_000);
      await Promise.resolve();

      expect(harness.endCall).toHaveBeenCalledWith(CALL_ID, { ended_by: 'SYSTEM' });
    } finally {
      jest.useRealTimers();
    }
  });
});
