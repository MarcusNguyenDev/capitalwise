import { requestMicrophone, stopMediaStream } from "@/features/voice/audio/request_microphone.util";
import { mapTokenUsage } from "@/features/voice/realtime/map_token_usage.util";
import type { RealtimeOutputItem, RealtimeServerEvent } from "@/features/voice/realtime/realtime_event.type";
import { RealtimeVoiceConnection } from "@/features/voice/realtime/realtime_voice.client";
import {
  CUSTOMER_TRANSCRIPT_WAIT_MS,
  DEFAULT_TURN_DETECTION,
  LIVE_TAKEOVER_ANNOUNCEMENT,
  SUPERVISOR_INSTRUCTION_PREFIX,
} from "@/features/voice/realtime/realtime_voice.constant";
import { SpeechOutput } from "@/features/voice/speech/speech_output.client";
import type { StaffAudioSignal } from "@/features/voice/webrtc/staff_audio_signal.type";
import {
  callTool,
  confirmInstructionApplied,
  createVoiceSession,
  recordCallMetrics,
  recordTurn,
} from "@/shared/api_client/core_api.client";
import { describeError } from "@/shared/http/service_request.error";
import type { CallCommand, ToolCallResponse, TranscriptDelta } from "@/shared/types/call.type";

import type { PhoneCallSession, PhoneCallSessionOptions } from "../session/phone_call_session.type";
import { StaffHandover } from "../session/staff_handover.client";

interface LiveVoiceSessionOptions extends PhoneCallSessionOptions {
  sendTranscriptDelta: (transcript_delta: TranscriptDelta) => void;
}

function parseToolArguments(raw_arguments: string | undefined): Record<string, unknown> {
  try {
    const parsed_arguments: unknown = JSON.parse(raw_arguments || "{}");
    return parsed_arguments !== null && typeof parsed_arguments === "object" ? (parsed_arguments as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function waitFor(wait_ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, wait_ms));
}

/**
 * A live call with the realtime voice model. The model's audio flows over
 * WebRTC; this class relays transcripts, turns, tool calls and usage to
 * `core`, and applies the supervisor's commands to the model session.
 */
export class LiveVoiceSession implements PhoneCallSession {
  private readonly options: LiveVoiceSessionOptions;
  private readonly speech_output: SpeechOutput;
  private readonly staff_handover: StaffHandover;
  private readonly handled_function_call_ids = new Set<string>();
  private readonly pending_customer_transcripts = new Map<string, { promise: Promise<void>; resolve: () => void }>();
  private connection: RealtimeVoiceConnection | null = null;
  private microphone_stream: MediaStream | null = null;
  private turn_detection: Record<string, unknown> = DEFAULT_TURN_DETECTION;
  private relay_queue: Promise<unknown> = Promise.resolve();
  private is_stopped = false;
  private is_human_active = false;
  private is_response_active = false;
  private is_customer_speaking = false;
  private notifyModelIdle: (() => void) | null = null;
  private customer_speech_stopped_at: number | null = null;
  private pending_latency_ms: number | undefined;

  constructor(options: LiveVoiceSessionOptions) {
    this.options = options;
    this.speech_output = new SpeechOutput({ is_customer_male: options.is_customer_male });
    this.staff_handover = new StaffHandover({
      speech_output: this.speech_output,
      sendStaffAudioSignal: options.sendStaffAudioSignal,
      getCustomerMicrophone: () => this.microphone_stream,
    });
  }

  async start(): Promise<void> {
    try {
      // The microphone prompt comes first, while the click on Call still counts as a user gesture.
      this.microphone_stream = await requestMicrophone();
      const voice_session = await createVoiceSession(this.options.call_id);
      if (this.is_stopped) {
        return this.stop();
      }
      this.connection = new RealtimeVoiceConnection({
        client_secret: voice_session.client_secret,
        microphone_stream: this.microphone_stream,
        // The AI answers straight away, with no menus: it speaks first.
        onReady: () => this.requestResponse(),
        onServerEvent: (server_event) => this.handleServerEvent(server_event),
        onConnectionLost: (error) => this.fail(error),
      });
      await this.connection.connect();
    } catch (error) {
      this.fail(error);
    }
  }

  handleCommand(command: CallCommand): void {
    switch (command.command) {
      case "INSTRUCTION":
        return this.applyInstruction(command);
      case "TAKEOVER":
        return this.yieldToStaff(command);
      case "STAFF_MESSAGE":
        return this.voiceStaffMessage(command.text ?? "");
      case "HANDBACK":
        return this.resumeAfterHandback(command);
      case "END_CALL":
        this.stop();
        return this.options.listeners.onEnded();
    }
  }

  handleStaffAudioSignal(signal: StaffAudioSignal): void {
    this.staff_handover.handleStaffAudioSignal(signal);
  }

  stop(): void {
    this.is_stopped = true;
    this.connection?.close();
    this.connection = null;
    stopMediaStream(this.microphone_stream);
    this.microphone_stream = null;
    this.speech_output.cancelAll();
    this.staff_handover.closeStaffAudio();
    for (const pending_transcript of this.pending_customer_transcripts.values()) {
      pending_transcript.resolve();
    }
    this.notifyModelIdle?.();
  }

  private fail(error: unknown): void {
    if (this.is_stopped) {
      return;
    }
    this.stop();
    this.options.listeners.onFailed(error);
  }

  // Server events

  private handleServerEvent(server_event: RealtimeServerEvent): void {
    switch (server_event.type) {
      case "session.created":
      case "session.updated":
        return this.rememberTurnDetection(server_event);
      case "input_audio_buffer.speech_started":
        this.is_customer_speaking = true;
        this.customer_speech_stopped_at = null;
        return;
      case "input_audio_buffer.speech_stopped":
        this.is_customer_speaking = false;
        this.customer_speech_stopped_at = this.is_human_active ? null : performance.now();
        return;
      case "input_audio_buffer.committed":
        return this.expectCustomerTranscript(server_event.item_id);
      case "conversation.item.input_audio_transcription.delta":
        return this.relayTranscriptDelta("CUSTOMER", server_event);
      case "conversation.item.input_audio_transcription.completed":
        return this.completeCustomerTurn(server_event);
      case "conversation.item.input_audio_transcription.failed":
        return this.settleCustomerTranscript(server_event.item_id);
      case "response.created":
        this.is_response_active = true;
        return;
      case "output_audio_buffer.started":
        return this.markFirstAiAudio();
      // The second name of each pair is the pre-GA spelling, kept so an older model snapshot still works.
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        this.markFirstAiAudio();
        return this.relayTranscriptDelta("AI", server_event);
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done":
        return void this.completeAiTurn(server_event);
      case "response.done":
        this.is_response_active = false;
        this.notifyModelIdle?.();
        return void this.handleResponseDone(server_event);
      case "error":
        return this.logModelError(server_event);
    }
  }

  private rememberTurnDetection(server_event: RealtimeServerEvent): void {
    const reported_turn_detection = server_event.session?.audio?.input?.turn_detection;
    if (reported_turn_detection) {
      this.turn_detection = reported_turn_detection;
    }
  }

  /** Response time = end of the customer's speech to the first AI audio. */
  private markFirstAiAudio(): void {
    if (this.customer_speech_stopped_at === null) {
      return;
    }
    this.pending_latency_ms = Math.round(performance.now() - this.customer_speech_stopped_at);
    this.customer_speech_stopped_at = null;
  }

  private relayTranscriptDelta(speaker: "CUSTOMER" | "AI", server_event: RealtimeServerEvent): void {
    if (!server_event.item_id || !server_event.delta) {
      return;
    }
    this.options.sendTranscriptDelta({
      call_id: this.options.call_id,
      speaker,
      delta: server_event.delta,
      item_id: server_event.item_id,
    });
    this.options.listeners.onCaption({
      caption_id: server_event.item_id,
      speaker,
      text: server_event.delta,
      is_final: false,
    });
  }

  private expectCustomerTranscript(item_id: string | undefined): void {
    if (!item_id || this.pending_customer_transcripts.has(item_id)) {
      return;
    }
    let resolveTranscript: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => {
      resolveTranscript = resolve;
    });
    this.pending_customer_transcripts.set(item_id, { promise, resolve: resolveTranscript });
  }

  private settleCustomerTranscript(item_id: string | undefined): void {
    if (!item_id) {
      return;
    }
    this.pending_customer_transcripts.get(item_id)?.resolve();
    this.pending_customer_transcripts.delete(item_id);
  }

  private completeCustomerTurn(server_event: RealtimeServerEvent): void {
    const text = server_event.transcript?.trim();
    if (text && server_event.item_id) {
      this.options.listeners.onCaption({ caption_id: server_event.item_id, speaker: "CUSTOMER", text, is_final: true });
      this.enqueueRelay(() => recordTurn(this.options.call_id, { speaker: "CUSTOMER", text }));
    }
    this.settleCustomerTranscript(server_event.item_id);
  }

  private async completeAiTurn(server_event: RealtimeServerEvent): Promise<void> {
    const text = server_event.transcript?.trim();
    const latency_ms = this.pending_latency_ms;
    this.pending_latency_ms = undefined;
    if (!text) {
      return;
    }
    if (server_event.item_id) {
      this.options.listeners.onCaption({ caption_id: server_event.item_id, speaker: "AI", text, is_final: true });
    }
    await this.waitForCustomerTranscripts();
    this.enqueueRelay(() => recordTurn(this.options.call_id, { speaker: "AI", text, latency_ms }));
  }

  private async handleResponseDone(server_event: RealtimeServerEvent): Promise<void> {
    const usage = server_event.response?.usage;
    if (usage) {
      this.enqueueRelay(() => recordCallMetrics(this.options.call_id, { usage: mapTokenUsage(usage) }));
    }
    const function_calls = (server_event.response?.output ?? []).filter(
      (output_item) => output_item.type === "function_call" && output_item.call_id && !this.handled_function_call_ids.has(output_item.call_id),
    );
    if (function_calls.length === 0) {
      return;
    }
    function_calls.forEach((function_call) => this.handled_function_call_ids.add(function_call.call_id as string));
    await this.waitForCustomerTranscripts();
    // Tools start after the turns before them are stored, but must not hold up later turns:
    // the identity push alone can wait 45 seconds for the customer to tap Approve.
    this.enqueueRelay(() => void this.runFunctionCalls(function_calls));
  }

  private async runFunctionCalls(function_calls: RealtimeOutputItem[]): Promise<void> {
    const tool_outputs: { function_call_id: string | undefined; output: string }[] = [];
    for (const function_call of function_calls) {
      tool_outputs.push({ function_call_id: function_call.call_id, output: JSON.stringify(await this.runTool(function_call)) });
    }
    // If the caller spoke while a slow tool ran, the model is already answering them.
    // Outputs and the follow-up response must wait until that response is done.
    await this.waitUntilModelIdle();
    for (const tool_output of tool_outputs) {
      this.connection?.sendEvent({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: tool_output.function_call_id, output: tool_output.output },
      });
    }
    if (!this.is_human_active) {
      this.requestResponse();
    }
  }

  private waitUntilModelIdle(): Promise<void> {
    if (!this.is_response_active || this.is_stopped) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const previous_notify = this.notifyModelIdle;
      this.notifyModelIdle = () => {
        this.notifyModelIdle = null;
        previous_notify?.();
        resolve();
      };
    });
  }

  private async runTool(function_call: RealtimeOutputItem): Promise<ToolCallResponse> {
    try {
      return await callTool(this.options.call_id, function_call.name ?? "", parseToolArguments(function_call.arguments));
    } catch (error) {
      // The model still needs an answer to its function call, otherwise the conversation stalls.
      return { ok: false, error: { code: "TOOL_UNAVAILABLE", message: describeError(error) } };
    }
  }

  private logModelError(server_event: RealtimeServerEvent): void {
    console.warn("Realtime voice model reported an error", {
      call_id: this.options.call_id,
      error_code: server_event.error?.code,
      message: server_event.error?.message,
    });
  }

  // Supervisor commands

  private applyInstruction(command: CallCommand): void {
    this.injectSupervisorInstruction(command.text ?? "");
    // While the AI or the caller is speaking, the instruction simply shapes the next response.
    if (!this.is_response_active && !this.is_customer_speaking && !this.is_human_active) {
      this.requestResponse();
    }
    this.confirmApplied(command);
  }

  private confirmApplied(command: CallCommand): void {
    if (command.intervention_id) {
      confirmInstructionApplied(this.options.call_id, command.intervention_id).catch(() => undefined);
    }
  }

  private yieldToStaff(command: CallCommand): void {
    const announcement = command.text ?? LIVE_TAKEOVER_ANNOUNCEMENT;
    this.is_human_active = true;
    this.customer_speech_stopped_at = null;
    if (this.is_response_active) {
      this.connection?.sendEvent({ type: "response.cancel" });
    }
    this.connection?.sendEvent({ type: "output_audio_buffer.clear" });
    // Transcription stays on so the customer's words still reach the transcript.
    this.setAutomaticResponses(false);
    this.connection?.setModelAudioMuted(true);
    this.options.listeners.onCaption({ caption_id: `takeover-${command.intervention_id}`, speaker: "SYSTEM", text: announcement, is_final: true });
    void this.staff_handover.announceTakeover(announcement);
  }

  private voiceStaffMessage(text: string): void {
    this.options.listeners.onCaption({ caption_id: `staff-${performance.now()}`, speaker: "STAFF", text, is_final: true });
    void this.staff_handover.speakStaffMessage(text);
  }

  private resumeAfterHandback(command: CallCommand): void {
    this.is_human_active = false;
    this.staff_handover.closeStaffAudio();
    this.speech_output.cancelAll();
    if (command.text) {
      this.injectSupervisorInstruction(command.text);
    }
    this.setAutomaticResponses(true);
    this.connection?.setModelAudioMuted(false);
    this.requestResponse();
    this.confirmApplied(command);
  }

  private injectSupervisorInstruction(instruction: string): void {
    this.connection?.sendEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [{ type: "input_text", text: `${SUPERVISOR_INSTRUCTION_PREFIX}${instruction}` }],
      },
    });
  }

  private setAutomaticResponses(is_enabled: boolean): void {
    this.connection?.sendEvent({
      type: "session.update",
      session: {
        type: "realtime",
        audio: { input: { turn_detection: { ...this.turn_detection, create_response: is_enabled, interrupt_response: is_enabled } } },
      },
    });
  }

  private requestResponse(): void {
    this.connection?.sendEvent({ type: "response.create" });
  }

  // Relay ordering

  private enqueueRelay(relay: () => unknown): void {
    this.relay_queue = this.relay_queue.then(relay).catch((error) => {
      console.warn("Could not relay a live call event to core", { call_id: this.options.call_id, message: describeError(error) });
    });
  }

  private async waitForCustomerTranscripts(): Promise<void> {
    const awaited_item_ids = [...this.pending_customer_transcripts.keys()];
    if (awaited_item_ids.length === 0) {
      return;
    }
    const pending_promises = awaited_item_ids.map((item_id) => this.pending_customer_transcripts.get(item_id)?.promise);
    await Promise.race([Promise.all(pending_promises), waitFor(CUSTOMER_TRANSCRIPT_WAIT_MS)]);
    // A transcript that never arrives must not delay every later turn as well.
    awaited_item_ids.forEach((item_id) => this.settleCustomerTranscript(item_id));
  }
}
