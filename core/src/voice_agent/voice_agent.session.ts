import { Logger } from '@nestjs/common';

import { AiRequestAbortedError } from '../ai/errors/ai_request_aborted.error';
import { ChatToolCall } from '../ai/types/chat_request.type';
import { ChatUsage } from '../ai/types/chat_stream_event.type';
import {
  AGENT_OUTPUT_SAMPLE_RATE,
  CALLER_INPUT_SAMPLE_RATE,
} from '../audio/constants/call_audio_format.constant';
import { encodeWav } from '../audio/encode_wav.util';
import { ToolOutcome } from '../call_tools/types/tool_outcome.type';
import { CallEndedError } from '../calls/errors/call_ended.error';
import { CallNotFoundError } from '../calls/errors/call_not_found.error';
import { CallHoldReason } from '../calls/types/call_metrics.type';
import { HOLD_PHRASES } from '../hold_buffer/constants/hold_phrases.constant';
import {
  classifyToolHold,
  ToolHoldClass,
} from '../hold_buffer/constants/tool_hold_classes.constant';
import {
  generateHandoverTone,
  generateHoldTone,
} from '../hold_buffer/generate_call_tones.util';
import {
  UtteranceEndedEvent,
  VoiceActivityEvent,
} from '../turn_detection/types/voice_activity_event.type';
import { AgentAudioOutput } from './agent_audio.output';
import {
  AGENT_PHRASES,
  buildGreeting,
  buildHandoverLine,
} from './constants/agent_phrases.constant';
import {
  CALLER_AUDIO_STALL_MS,
  CUSTOMER_JOIN_TIMEOUT_MS,
  CUSTOMER_RECONNECT_GRACE_MS,
  HOLD_TONE_INTERVAL_MS,
  MAX_TOOL_ROUNDS,
} from './constants/voice_agent_timing.constant';
import { ConversationHistory } from './conversation.history';
import { isNoiseTranscript } from './is_noise_transcript.util';
import { ResponseSpeaker } from './response.speaker';
import { createTurnTiming, TurnTiming } from './types/turn_timing.type';
import {
  VoiceAgentCommand,
  VoiceAgentSessionDependencies,
} from './types/voice_agent_session_dependencies.type';

const OPENING_CONTEXT_TOOL_CALL_ID = 'call_opening_caller_context';
const STALL_CHECK_INTERVAL_MS = 250;
const SILENCE_FRAME = new Int16Array(CALLER_INPUT_SAMPLE_RATE / 100);
const MAX_STALL_SILENCE_FRAMES = 300;
const ERROR_HELP_REASON =
  'The AI specialist hit a system problem and could not continue the conversation.';

interface ActiveResponse {
  abort_controller: AbortController;
  speaker: ResponseSpeaker;
  is_interrupted: boolean;
  // Resolves once the reply (or what was heard of it) is recorded.
  recorded: Promise<void>;
  markRecorded: () => void;
}

interface PendingCustomerMessage {
  text: string;
  turn_timing: TurnTiming;
}

interface HoldFiller {
  started_at_ms: number;
  acknowledgement_done: Promise<unknown>;
  stopFiller: () => void;
}

interface FixedLineOptions {
  turn_timing: TurnTiming | null;
  should_record?: boolean;
  voice?: string;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// The control loop of one LIVE call: listen (turn detection) -> transcribe
// -> think (language model with tools) -> speak (text-to-speech), with
// barge-in, hold lines around system checks, and the supervisor's commands.
// It talks to the AI only through the `ai` dependency (AiService).
export class VoiceAgentSession {
  private readonly logger = new Logger(VoiceAgentSession.name);
  private readonly audio_output: AgentAudioOutput;
  private readonly history = new ConversationHistory();
  private readonly timers = new Set<NodeJS.Timeout>();
  private readonly hold_tone_pcm = generateHoldTone(AGENT_OUTPUT_SAMPLE_RATE);
  private readonly handover_tone_pcm = generateHandoverTone(
    AGENT_OUTPUT_SAMPLE_RATE,
  );
  private work_chain: Promise<void> = Promise.resolve();
  private transcription_chain: Promise<void> = Promise.resolve();
  private pending_customer_messages: PendingCustomerMessage[] = [];
  private active_response: ActiveResponse | null = null;
  private interrupted_reply_recorded: Promise<void> = Promise.resolve();
  private join_timer: NodeJS.Timeout | null = null;
  private reconnect_timer: NodeJS.Timeout | null = null;
  private last_caller_frame_at_ms = 0;
  private response_count = 0;
  private has_customer_joined = false;
  private is_human_active: boolean;
  private is_on_hold = false;
  private is_working = false;
  private is_stopped = false;
  private has_requested_help_after_error = false;
  private is_reply_owed_after_interruption = false;

  constructor(private readonly dependencies: VoiceAgentSessionDependencies) {
    this.audio_output = new AgentAudioOutput(dependencies.agent_room);
    this.is_human_active = dependencies.settings.is_human_active_at_start;
  }

  get call_id(): string {
    return this.dependencies.call_id;
  }

  get is_running(): boolean {
    return !this.is_stopped;
  }

  // Joins the room and waits (in the background) for the customer.
  async start(): Promise<void> {
    await this.dependencies.agent_room.join({
      onCustomerAudioFrame: (frame) => this.handleCallerFrame(frame),
      onCustomerPresenceChanged: (is_present) =>
        this.handleCustomerPresence(is_present),
      onDisconnected: () =>
        void this.endCallFromAgent('SYSTEM', 'the agent lost the call room'),
    });
    this.join_timer = this.schedule(CUSTOMER_JOIN_TIMEOUT_MS, () =>
      this.endCallFromAgent('SYSTEM', 'no customer joined within 30 s'),
    );
    this.repeat(STALL_CHECK_INTERVAL_MS, () => this.closeStalledUtterance());
  }

  handleCommand(voice_agent_command: VoiceAgentCommand): void {
    if (this.is_stopped) {
      return;
    }
    switch (voice_agent_command.command) {
      case 'INSTRUCTION':
        void this.applyInstruction(voice_agent_command);
        return;
      case 'TAKEOVER':
        void this.handOverToStaff(voice_agent_command);
        return;
      case 'STAFF_MESSAGE':
        void this.speakStaffMessage(voice_agent_command.text);
        return;
      case 'HANDBACK':
        void this.resumeAfterHandback(voice_agent_command);
        return;
      case 'END_CALL':
        void this.stop('staff ended the call');
        return;
    }
  }

  // Idempotent. Releases every timer, request, stream and the room.
  async stop(stop_reason: string): Promise<void> {
    if (this.is_stopped) {
      return;
    }
    this.is_stopped = true;
    this.logger.log(
      `Voice agent stopping on call ${this.call_id}: ${stop_reason}`,
    );
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.interruptActiveResponse();
    this.audio_output.clear();
    try {
      await this.dependencies.agent_room.leave();
    } catch (error) {
      this.logger.warn(
        `Leaving the room of call ${this.call_id} failed: ${describeError(error)}`,
      );
    }
    this.dependencies.onStopped();
  }

  // ── Customer presence and audio ──────────────────────────────────────────

  private handleCustomerPresence(is_present: boolean): void {
    if (this.is_stopped) {
      return;
    }
    if (is_present) {
      this.cancelTimer(this.reconnect_timer);
      this.reconnect_timer = null;
      if (!this.has_customer_joined) {
        this.has_customer_joined = true;
        this.cancelTimer(this.join_timer);
        this.enqueueWork(() => this.runOpening());
      }
      return;
    }
    if (this.has_customer_joined && !this.reconnect_timer) {
      this.reconnect_timer = this.schedule(CUSTOMER_RECONNECT_GRACE_MS, () =>
        this.endCallFromAgent('CUSTOMER', 'the customer left the call'),
      );
    }
  }

  private handleCallerFrame(frame: Int16Array): void {
    if (this.is_stopped) {
      return;
    }
    this.last_caller_frame_at_ms = Date.now();
    const voice_activity_events =
      this.dependencies.voice_activity_detector.pushFrame(frame);
    voice_activity_events.forEach((voice_activity_event) =>
      this.handleVoiceActivity(voice_activity_event),
    );
  }

  private handleVoiceActivity(voice_activity_event: VoiceActivityEvent): void {
    if (voice_activity_event.type === 'speech_started') {
      this.handleSpeechStarted();
    } else if (voice_activity_event.type === 'utterance_ended') {
      this.handleUtterance(voice_activity_event, Date.now());
    } else {
      this.resumeAfterFalseInterruption();
    }
  }

  // The caller's track went quiet mid-sentence (muted, dropped): close the
  // utterance as if they had stopped talking.
  private closeStalledUtterance(): void {
    const voice_activity_detector = this.dependencies.voice_activity_detector;
    if (
      !voice_activity_detector.is_in_speech ||
      Date.now() - this.last_caller_frame_at_ms < CALLER_AUDIO_STALL_MS
    ) {
      return;
    }
    for (
      let frame_index = 0;
      frame_index < MAX_STALL_SILENCE_FRAMES &&
      voice_activity_detector.is_in_speech;
      frame_index++
    ) {
      voice_activity_detector
        .pushFrame(SILENCE_FRAME)
        .forEach((voice_activity_event) =>
          this.handleVoiceActivity(voice_activity_event),
        );
    }
  }

  // Barge-in: the caller talks over the AI's reply. Hold lines, the greeting
  // and staff speech are never cut.
  private handleSpeechStarted(): void {
    if (this.is_human_active || this.is_on_hold) {
      return;
    }
    if (this.active_response) {
      this.logger.log(`Barge-in on call ${this.call_id}`);
      this.is_reply_owed_after_interruption = true;
      this.interrupted_reply_recorded = this.active_response.recorded;
      this.interruptActiveResponse();
    }
    this.audio_output.clearInterruptible();
  }

  private handleUtterance(
    utterance: UtteranceEndedEvent,
    end_of_speech_at_ms: number,
  ): void {
    const transcription_promise = this.transcribeUtterance(utterance);
    this.transcription_chain = this.transcription_chain
      .then(() =>
        this.recordCustomerUtterance(
          transcription_promise,
          utterance,
          end_of_speech_at_ms,
        ),
      )
      .catch((error) =>
        this.logger.error(
          `Recording a customer turn on call ${this.call_id} failed: ${describeError(error)}`,
        ),
      );
  }

  private async transcribeUtterance(
    utterance: UtteranceEndedEvent,
  ): Promise<{ text: string; stt_ms: number } | null> {
    const started_at_ms = Date.now();
    try {
      const transcription_result = await this.dependencies.ai.transcribe({
        audio: encodeWav(utterance.pcm, CALLER_INPUT_SAMPLE_RATE),
      });
      this.recordUsageQuietly({
        stt_audio_seconds: transcription_result.duration_seconds,
      });
      return {
        text: transcription_result.text,
        stt_ms: Date.now() - started_at_ms,
      };
    } catch (error) {
      if (!this.is_stopped) {
        this.enqueueWork(() => this.recoverFromFailure('transcribe', error));
      }
      return null;
    }
  }

  private async recordCustomerUtterance(
    transcription_promise: Promise<{ text: string; stt_ms: number } | null>,
    utterance: UtteranceEndedEvent,
    end_of_speech_at_ms: number,
  ): Promise<void> {
    const transcription = await transcription_promise;
    if (this.is_stopped || !transcription) {
      return;
    }
    if (isNoiseTranscript(transcription.text, utterance.speech_ms)) {
      this.logger.debug(
        `Dropped noise transcript "${transcription.text}" on call ${this.call_id}`,
      );
      this.resumeAfterFalseInterruption();
      return;
    }
    // What the AI said before being cut off comes first in the transcript.
    await this.interrupted_reply_recorded;
    await this.addTurnQuietly({
      speaker: 'CUSTOMER',
      text: transcription.text,
    });
    this.is_reply_owed_after_interruption = false;
    this.pending_customer_messages.push({
      text: transcription.text,
      turn_timing: createTurnTiming(end_of_speech_at_ms, transcription.stt_ms),
    });
    if (this.is_human_active) {
      this.movePendingCustomerMessagesToHistory();
      return;
    }
    this.enqueueWork(() => this.answerPendingCustomer());
  }

  // A barge-in that turned out to be noise must not leave the caller in
  // silence: the AI picks its reply up again.
  private resumeAfterFalseInterruption(): void {
    if (!this.is_reply_owed_after_interruption) {
      return;
    }
    this.is_reply_owed_after_interruption = false;
    this.enqueueWork(() => this.respond(createTurnTiming()));
  }

  private movePendingCustomerMessagesToHistory(): TurnTiming | null {
    const pending_messages = this.pending_customer_messages;
    this.pending_customer_messages = [];
    pending_messages.forEach((pending_message) =>
      this.history.add({ role: 'user', content: pending_message.text }),
    );
    return pending_messages[pending_messages.length - 1]?.turn_timing ?? null;
  }

  // ── Responding ───────────────────────────────────────────────────────────

  private async runOpening(): Promise<void> {
    if (this.is_human_active) {
      return;
    }
    const greeting = buildGreeting(this.dependencies.settings.bank_name);
    const greeting_done = this.playFixedLine(greeting, { turn_timing: null });
    const context_call: ChatToolCall = {
      tool_call_id: OPENING_CONTEXT_TOOL_CALL_ID,
      name: 'get_caller_context',
      arguments: {},
    };
    const context_outcome = await this.dispatchToolQuietly(context_call);
    this.history.add({
      role: 'assistant',
      content: greeting,
      tool_calls: [context_call],
    });
    this.addToolResult(context_call, context_outcome);
    await greeting_done;
    await this.respond(createTurnTiming());
  }

  private async answerPendingCustomer(): Promise<void> {
    // An earlier reply may already have taken these messages in.
    const turn_timing = this.movePendingCustomerMessagesToHistory();
    if (turn_timing) {
      await this.respond(turn_timing);
    }
  }

  private async respond(turn_timing: TurnTiming): Promise<void> {
    let tool_round_count = 0;
    while (this.canSpeak()) {
      const tool_calls = await this.runModelRound(turn_timing);
      if (!tool_calls || tool_calls.length === 0) {
        return;
      }
      if (tool_round_count >= MAX_TOOL_ROUNDS) {
        this.refuseToolCalls(tool_calls);
        await this.playFixedLine(AGENT_PHRASES.TOOL_ROUNDS_FALLBACK, {
          turn_timing,
        });
        return;
      }
      tool_round_count += 1;
      await this.runToolCallsOnHold(tool_calls, turn_timing);
      const late_turn_timing = this.movePendingCustomerMessagesToHistory();
      if (late_turn_timing && turn_timing.is_latency_recorded) {
        Object.assign(turn_timing, late_turn_timing);
      }
    }
  }

  // One streamed model call, spoken while it streams. Returns the tool calls
  // to run next, or null when the reply was interrupted or failed.
  private async runModelRound(
    turn_timing: TurnTiming,
  ): Promise<ChatToolCall[] | null> {
    const active_response = this.beginResponse(turn_timing);
    try {
      return await this.streamModelReply(active_response, turn_timing);
    } finally {
      active_response.markRecorded();
    }
  }

  private async streamModelReply(
    active_response: ActiveResponse,
    turn_timing: TurnTiming,
  ): Promise<ChatToolCall[] | null> {
    const item_id = `${this.call_id}_ai_${this.response_count}`;
    const tool_calls: ChatToolCall[] = [];
    let usage: ChatUsage | null = null;
    const started_at_ms = Date.now();
    try {
      const chat_stream = this.dependencies.ai.chat({
        messages: this.history.buildChatMessages(
          this.dependencies.settings.system_prompt,
        ),
        tools: this.dependencies.settings.tools,
        abort_signal: active_response.abort_controller.signal,
      });
      for await (const chat_event of chat_stream) {
        if (chat_event.type !== 'done') {
          turn_timing.llm_first_token_ms ??= Date.now() - started_at_ms;
        }
        if (chat_event.type === 'text_delta') {
          active_response.speaker.pushText(chat_event.text);
          this.dependencies.emitTranscriptDelta(chat_event.text, item_id);
        } else if (chat_event.type === 'tool_call') {
          tool_calls.push(chat_event);
        } else {
          usage = chat_event.usage;
        }
      }
      await active_response.speaker.finish();
    } catch (error) {
      return await this.handleRoundFailure(active_response, turn_timing, error);
    } finally {
      this.endResponse(active_response, usage);
    }
    if (active_response.is_interrupted) {
      await this.recordInterruptedReply(active_response, turn_timing);
      return null;
    }
    await this.recordReply(active_response, tool_calls, turn_timing);
    return tool_calls;
  }

  private beginResponse(turn_timing: TurnTiming): ActiveResponse {
    const abort_controller = new AbortController();
    this.response_count += 1;
    let markRecorded: () => void = () => undefined;
    const recorded = new Promise<void>((resolve) => {
      markRecorded = resolve;
    });
    const active_response: ActiveResponse = {
      abort_controller,
      is_interrupted: false,
      recorded,
      markRecorded,
      speaker: new ResponseSpeaker({
        audio_output: this.audio_output,
        synthesizeSpeech: (spoken_text) =>
          this.synthesizeReplyChunk(
            spoken_text,
            abort_controller.signal,
            turn_timing,
          ),
      }),
    };
    this.active_response = active_response;
    return active_response;
  }

  private endResponse(
    active_response: ActiveResponse,
    usage: ChatUsage | null,
  ): void {
    if (this.active_response === active_response) {
      this.active_response = null;
    }
    this.recordUsageQuietly({
      llm_input_tokens: usage?.input_tokens ?? 0,
      llm_output_tokens: usage?.output_tokens ?? 0,
      tts_characters: active_response.speaker.character_count,
    });
  }

  private async synthesizeReplyChunk(
    spoken_text: string,
    abort_signal: AbortSignal,
    turn_timing: TurnTiming,
  ): Promise<Int16Array> {
    const started_at_ms = Date.now();
    const speech_result = await this.dependencies.ai.synthesize({
      text: spoken_text,
      voice: this.dependencies.settings.ai_voice,
      sample_rate: AGENT_OUTPUT_SAMPLE_RATE,
      abort_signal,
    });
    turn_timing.tts_first_chunk_ms ??= Date.now() - started_at_ms;
    return speech_result.pcm;
  }

  private async handleRoundFailure(
    active_response: ActiveResponse,
    turn_timing: TurnTiming,
    error: unknown,
  ): Promise<null> {
    if (
      active_response.is_interrupted ||
      this.is_stopped ||
      error instanceof AiRequestAbortedError
    ) {
      await this.recordInterruptedReply(active_response, turn_timing);
      return null;
    }
    await this.recoverFromFailure('chat', error);
    return null;
  }

  private async recordReply(
    active_response: ActiveResponse,
    tool_calls: ChatToolCall[],
    turn_timing: TurnTiming,
  ): Promise<void> {
    const reply_text = active_response.speaker.readFullText();
    this.history.add({
      role: 'assistant',
      content: reply_text,
      ...(tool_calls.length > 0 ? { tool_calls } : {}),
    });
    if (reply_text.length > 0) {
      await this.recordAiTurn(
        reply_text,
        turn_timing,
        await active_response.speaker.waitForFirstAudio(),
      );
    }
  }

  // Only what the caller heard is kept, marked as cut off.
  private async recordInterruptedReply(
    active_response: ActiveResponse,
    turn_timing: TurnTiming,
  ): Promise<void> {
    const spoken_text = active_response.speaker.readSpokenText();
    if (spoken_text.length === 0) {
      return;
    }
    const interrupted_text = `${spoken_text} …`;
    this.history.add({ role: 'assistant', content: interrupted_text });
    await this.recordAiTurn(
      interrupted_text,
      turn_timing,
      await active_response.speaker.waitForFirstAudio(),
    );
  }

  private interruptActiveResponse(): void {
    if (!this.active_response) {
      return;
    }
    this.active_response.is_interrupted = true;
    this.active_response.speaker.cancel();
    this.active_response.abort_controller.abort();
  }

  // ── Tools and the hold buffer ────────────────────────────────────────────

  private async runToolCallsOnHold(
    tool_calls: ChatToolCall[],
    turn_timing: TurnTiming,
  ): Promise<void> {
    const hold_reason = this.dependencies.hold_policy.findHoldReason(
      tool_calls.map((tool_call) => tool_call.name),
    );
    const hold_filler = hold_reason
      ? await this.beginHold(hold_reason, tool_calls, turn_timing)
      : null;
    try {
      for (const tool_call of tool_calls) {
        const tool_outcome = await this.dispatchToolQuietly(tool_call);
        this.addToolResult(tool_call, tool_outcome);
      }
    } finally {
      if (hold_filler) {
        await this.finishHold(hold_filler, turn_timing);
      }
    }
  }

  private async beginHold(
    hold_reason: CallHoldReason,
    tool_calls: ChatToolCall[],
    turn_timing: TurnTiming,
  ): Promise<HoldFiller> {
    this.is_on_hold = true;
    const held_tool = tool_calls.find(
      (tool_call) => classifyToolHold(tool_call.name) !== ToolHoldClass.SILENT,
    ) as ChatToolCall;
    await this.dependencies.hold.startHold(this.call_id, {
      reason: hold_reason,
      tool_name: held_tool.name,
    });
    const acknowledgement =
      this.dependencies.hold_policy.chooseAcknowledgement(hold_reason);
    return {
      started_at_ms: Date.now(),
      acknowledgement_done: this.playFixedLine(acknowledgement, {
        turn_timing,
      }),
      stopFiller: this.startHoldFiller(hold_reason),
    };
  }

  // Reminders every HOLD_REMINDER_INTERVAL_MS (at most three) and, if
  // enabled, a soft tone whenever nothing else is playing.
  private startHoldFiller(hold_reason: CallHoldReason): () => void {
    let reminders_played = 0;
    const reminder_timer = this.repeat(
      this.dependencies.hold_policy.reminder_interval_ms,
      () => {
        const reminder = this.dependencies.hold_policy.chooseReminder(
          hold_reason,
          reminders_played,
        );
        if (!reminder || !this.canSpeak()) {
          return;
        }
        reminders_played += 1;
        this.audio_output.clearTones();
        void this.playFixedLine(reminder, {
          turn_timing: null,
          should_record: false,
        });
      },
    );
    const tone_timer = this.dependencies.settings.is_hold_tone_enabled
      ? this.repeat(HOLD_TONE_INTERVAL_MS, () => this.playHoldTone())
      : null;
    return () => {
      this.cancelTimer(reminder_timer);
      this.cancelTimer(tone_timer);
    };
  }

  private playHoldTone(): void {
    if (!this.canSpeak() || this.audio_output.is_playing) {
      return;
    }
    void this.audio_output.enqueue({
      pcm: this.hold_tone_pcm,
      is_interruptible: false,
      is_tone: true,
    });
  }

  private async finishHold(
    hold_filler: HoldFiller,
    turn_timing: TurnTiming,
  ): Promise<void> {
    hold_filler.stopFiller();
    this.audio_output.clearTones();
    const hold_duration_ms = Date.now() - hold_filler.started_at_ms;
    await this.dependencies.hold.endHold(this.call_id);
    this.is_on_hold = false;
    await hold_filler.acknowledgement_done;
    if (
      this.canSpeak() &&
      this.dependencies.hold_policy.shouldThankOnReturn(hold_duration_ms)
    ) {
      await this.playFixedLine(HOLD_PHRASES.RETURN_FROM_HOLD, { turn_timing });
    }
  }

  private async dispatchToolQuietly(
    tool_call: ChatToolCall,
  ): Promise<ToolOutcome> {
    try {
      return await this.dependencies.dispatchTool(
        this.call_id,
        tool_call.name,
        tool_call.arguments,
      );
    } catch (error) {
      if (
        error instanceof CallEndedError ||
        error instanceof CallNotFoundError
      ) {
        void this.stop('the call ended');
      } else {
        this.logger.error(
          `Tool ${tool_call.name} on call ${this.call_id} failed: ${describeError(error)}`,
        );
      }
      return {
        ok: false,
        error: { code: 'TOOL_FAILED', message: 'That tool did not run.' },
      };
    }
  }

  private addToolResult(
    tool_call: ChatToolCall,
    tool_outcome: ToolOutcome,
  ): void {
    this.history.add({
      role: 'tool',
      tool_call_id: tool_call.tool_call_id,
      name: tool_call.name,
      content: JSON.stringify(tool_outcome),
    });
  }

  // The model asked for a fifth tool round: answer each call so the history
  // stays valid, without running anything.
  private refuseToolCalls(tool_calls: ChatToolCall[]): void {
    for (const tool_call of tool_calls) {
      this.addToolResult(tool_call, {
        ok: false,
        error: {
          code: 'TOO_MANY_TOOL_CALLS',
          message: 'Not run. Answer the caller with what you already have.',
        },
      });
    }
  }

  // ── Supervisor commands ──────────────────────────────────────────────────

  private async applyInstruction(
    voice_agent_command: VoiceAgentCommand,
  ): Promise<void> {
    if (!voice_agent_command.text) {
      return;
    }
    this.history.addSupervisorInstruction(voice_agent_command.text);
    const should_respond_now = this.isIdle();
    await this.markInstructionAppliedQuietly(voice_agent_command);
    if (should_respond_now) {
      this.enqueueWork(() => this.respond(createTurnTiming()));
    }
  }

  private async handOverToStaff(
    voice_agent_command: VoiceAgentCommand,
  ): Promise<void> {
    this.is_human_active = true;
    this.interruptActiveResponse();
    this.audio_output.clear();
    void this.audio_output.enqueue({
      pcm: this.handover_tone_pcm,
      is_interruptible: false,
    });
    await this.playFixedLine(buildHandoverLine(voice_agent_command.text), {
      turn_timing: null,
    });
  }

  // Typed takeover replies, spoken in the staff voice on the agent's track.
  private async speakStaffMessage(staff_text: string | null): Promise<void> {
    if (!staff_text) {
      return;
    }
    try {
      const speech_result = await this.dependencies.ai.synthesize({
        text: staff_text,
        voice: this.dependencies.settings.staff_voice,
        sample_rate: AGENT_OUTPUT_SAMPLE_RATE,
      });
      this.recordUsageQuietly({ tts_characters: staff_text.length });
      if (!this.is_stopped) {
        await this.audio_output.enqueue({
          pcm: speech_result.pcm,
          is_interruptible: false,
        });
      }
    } catch (error) {
      this.logger.error(
        `Speaking a staff message on call ${this.call_id} failed: ${describeError(error)}`,
      );
    }
  }

  private async resumeAfterHandback(
    voice_agent_command: VoiceAgentCommand,
  ): Promise<void> {
    this.is_human_active = false;
    this.movePendingCustomerMessagesToHistory();
    if (voice_agent_command.text) {
      this.history.addSupervisorInstruction(voice_agent_command.text);
    }
    await this.markInstructionAppliedQuietly(voice_agent_command);
    this.enqueueWork(() => this.respond(createTurnTiming()));
  }

  private async markInstructionAppliedQuietly(
    voice_agent_command: VoiceAgentCommand,
  ): Promise<void> {
    if (!voice_agent_command.intervention_id) {
      return;
    }
    try {
      await this.dependencies.markInstructionApplied(
        this.call_id,
        voice_agent_command.intervention_id,
      );
    } catch (error) {
      this.logger.warn(
        `Could not mark ${voice_agent_command.intervention_id} applied on call ${this.call_id}: ${describeError(error)}`,
      );
    }
  }

  // ── Failure handling ─────────────────────────────────────────────────────

  // Any provider failure during a turn: apologise, and ask for a person once.
  private async recoverFromFailure(
    stage: string,
    error: unknown,
  ): Promise<void> {
    this.logger.error(
      `Voice agent ${stage} failed on call ${this.call_id}: ${describeError(error)}`,
    );
    if (!this.canSpeak()) {
      return;
    }
    await this.playFixedLine(AGENT_PHRASES.TROUBLE_APOLOGY, {
      turn_timing: null,
    });
    if (this.has_requested_help_after_error) {
      return;
    }
    this.has_requested_help_after_error = true;
    const help_call: ChatToolCall = {
      tool_call_id: `call_error_help_${this.response_count}`,
      name: 'request_human',
      arguments: { reason: ERROR_HELP_REASON },
    };
    this.history.add({
      role: 'assistant',
      content: '',
      tool_calls: [help_call],
    });
    this.addToolResult(help_call, await this.dispatchToolQuietly(help_call));
  }

  private async endCallFromAgent(
    ended_by: 'CUSTOMER' | 'SYSTEM',
    end_reason: string,
  ): Promise<void> {
    if (this.is_stopped) {
      return;
    }
    this.logger.log(`Ending call ${this.call_id}: ${end_reason}`);
    try {
      await this.dependencies.calls.endCall(this.call_id, { ended_by });
    } catch (error) {
      this.logger.warn(
        `Could not end call ${this.call_id}: ${describeError(error)}`,
      );
    }
    await this.stop(end_reason);
  }

  // ── Speaking fixed lines and recording ───────────────────────────────────

  // Plays a pre-rendered line and records it as an AI turn once it starts.
  private async playFixedLine(
    line_text: string,
    fixed_line_options: FixedLineOptions,
  ): Promise<void> {
    let phrase_pcm: Int16Array;
    try {
      phrase_pcm = await this.dependencies.getPhraseAudio(
        line_text,
        fixed_line_options.voice ?? this.dependencies.settings.ai_voice,
      );
    } catch (error) {
      this.logger.warn(
        `No audio for "${line_text}" on call ${this.call_id}: ${describeError(error)}`,
      );
      return;
    }
    if (this.is_stopped) {
      return;
    }
    const started_at_ms = await this.audio_output.enqueue({
      pcm: phrase_pcm,
      is_interruptible: false,
    });
    if (started_at_ms !== null && fixed_line_options.should_record !== false) {
      await this.recordAiTurn(
        line_text,
        fixed_line_options.turn_timing,
        started_at_ms,
      );
    }
  }

  private async recordAiTurn(
    ai_text: string,
    turn_timing: TurnTiming | null,
    first_audio_at_ms: number | null,
  ): Promise<void> {
    let latency_ms: number | undefined;
    if (
      turn_timing &&
      !turn_timing.is_latency_recorded &&
      turn_timing.end_of_speech_at_ms !== null &&
      first_audio_at_ms !== null
    ) {
      latency_ms = Math.max(
        0,
        first_audio_at_ms - turn_timing.end_of_speech_at_ms,
      );
      turn_timing.is_latency_recorded = true;
      this.logger.log(
        `Turn timing call=${this.call_id} end_of_speech_to_first_audio_ms=${latency_ms} stt_ms=${turn_timing.stt_ms} llm_first_token_ms=${turn_timing.llm_first_token_ms} tts_first_chunk_ms=${turn_timing.tts_first_chunk_ms}`,
      );
    }
    await this.addTurnQuietly({ speaker: 'AI', text: ai_text, latency_ms });
  }

  private async addTurnQuietly(new_turn: {
    speaker: 'AI' | 'CUSTOMER';
    text: string;
    latency_ms?: number;
  }): Promise<void> {
    try {
      await this.dependencies.calls.addTurn(this.call_id, new_turn);
    } catch (error) {
      if (
        error instanceof CallEndedError ||
        error instanceof CallNotFoundError
      ) {
        void this.stop('the call ended');
        return;
      }
      this.logger.error(
        `Recording a ${new_turn.speaker} turn on call ${this.call_id} failed: ${describeError(error)}`,
      );
    }
  }

  private recordUsageQuietly(usage: {
    llm_input_tokens?: number;
    llm_output_tokens?: number;
    stt_audio_seconds?: number;
    tts_characters?: number;
  }): void {
    this.dependencies.calls
      .recordUsage(this.call_id, usage)
      .catch((error) =>
        this.logger.debug(
          `Usage not recorded on call ${this.call_id}: ${describeError(error)}`,
        ),
      );
  }

  // ── Scheduling ───────────────────────────────────────────────────────────

  private canSpeak(): boolean {
    return !this.is_stopped && !this.is_human_active;
  }

  private isIdle(): boolean {
    return (
      !this.is_working &&
      !this.active_response &&
      !this.is_on_hold &&
      !this.is_human_active &&
      !this.audio_output.is_playing
    );
  }

  // Responses run one at a time, in order.
  private enqueueWork(work: () => Promise<void>): void {
    this.work_chain = this.work_chain.then(async () => {
      if (this.is_stopped) {
        return;
      }
      this.is_working = true;
      try {
        await work();
      } catch (error) {
        this.logger.error(
          `Voice agent work on call ${this.call_id} failed: ${describeError(error)}`,
        );
      } finally {
        this.is_working = false;
      }
    });
  }

  // Exposed for tests: resolves once every queued piece of work is done.
  async waitUntilSettled(): Promise<void> {
    await this.transcription_chain;
    await this.work_chain;
  }

  private schedule(delay_ms: number, onElapsed: () => void): NodeJS.Timeout {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      onElapsed();
    }, delay_ms);
    this.timers.add(timer);
    return timer;
  }

  private repeat(interval_ms: number, onElapsed: () => void): NodeJS.Timeout {
    const timer = setInterval(onElapsed, interval_ms);
    this.timers.add(timer);
    return timer;
  }

  private cancelTimer(timer: NodeJS.Timeout | null): void {
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(timer);
    }
  }
}
