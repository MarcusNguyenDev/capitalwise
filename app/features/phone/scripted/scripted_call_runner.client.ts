import { SpeechOutput } from "@/features/voice/speech/speech_output.client";
import { callTool, confirmInstructionApplied, endCall, recordTurn } from "@/shared/api_client/core_api.client";
import type { CallCommand, CallScript, ScriptStep } from "@/shared/types/call.type";

import { DEFAULT_TAKEOVER_ANNOUNCEMENT } from "../constants/phone_call.constant";
import type { PhoneCallSession, PhoneCallSessionOptions } from "../session/phone_call_session.type";
import { StaffHandover } from "../session/staff_handover.client";
import { resolveScriptArguments, resolveScriptPlaceholders } from "./resolve_script_placeholders.util";
import {
  AI_THINKING_PAUSE_MAX_MS,
  AI_THINKING_PAUSE_MIN_MS,
  CALL_INSIGHT_TOOL_NAME,
  IDENTITY_PUSH_TOOL_NAME,
  UNVERIFIED_CALLER_LINE,
} from "./scripted_call.constant";

interface ScriptedCallRunnerOptions extends PhoneCallSessionOptions {
  script: CallScript;
  bank_name: string;
}

/**
 * Replays a hero call on the phone: lines are spoken with speech synthesis
 * and every turn, tool call and supervisor command goes through the same
 * `core` endpoints as a live voice call. The phone acts on supervisor
 * commands itself; staff speech arrives over the call's LiveKit room.
 */
export class ScriptedCallRunner implements PhoneCallSession {
  private readonly options: ScriptedCallRunnerOptions;
  private readonly speech_output: SpeechOutput;
  private readonly staff_handover: StaffHandover;
  private readonly placeholder_values: Record<string, unknown>;
  private readonly state_change_listeners = new Set<() => void>();
  private is_stopped = false;
  private is_human_active = false;
  private is_ending_early = false;
  private has_pending_instruction = false;
  private instruction_acknowledgement: Promise<unknown> = Promise.resolve();
  private customer_speech_ended_at: number | null = null;
  private current_step_index = 0;
  // Set when staff take over before the script's handover point: the AI's holding lines are skipped on handback.
  private resume_step_index: number | null = null;
  private caption_count = 0;

  constructor(options: ScriptedCallRunnerOptions) {
    this.options = options;
    this.placeholder_values = { bank_name: options.bank_name };
    this.speech_output = new SpeechOutput({ is_customer_male: options.is_customer_male });
    this.staff_handover = new StaffHandover({
      call_id: options.call_id,
      speech_output: this.speech_output,
      onAudioChanged: options.listeners.onAudioChanged,
    });
  }

  async start(): Promise<void> {
    void this.staff_handover.joinCallAudio();
    try {
      const steps = this.options.script.steps;
      while (this.current_step_index < steps.length) {
        await this.waitForCondition(() => !this.is_human_active, null);
        if (this.is_stopped || this.is_ending_early) {
          break;
        }
        if (this.resume_step_index !== null) {
          this.current_step_index = this.resume_step_index;
          this.resume_step_index = null;
          continue;
        }
        await this.runStep(steps[this.current_step_index]);
        if (this.resume_step_index === null) {
          this.current_step_index += 1;
        }
      }
      await this.finishCall();
    } catch (error) {
      if (!this.is_stopped) {
        this.stop();
        this.options.listeners.onFailed(error);
      }
    }
  }

  handleCommand(command: CallCommand): void {
    switch (command.command) {
      case "INSTRUCTION":
        return this.acknowledgeInstruction(command);
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

  unlockAudio(): void {
    this.staff_handover.unlockAudio();
  }

  setMicrophoneMuted(is_muted: boolean): void {
    this.staff_handover.setMicrophoneMuted(is_muted);
  }

  stop(): void {
    this.is_stopped = true;
    this.speech_output.cancelAll();
    this.staff_handover.close();
    this.notifyStateChanged();
  }

  private runStep(step: ScriptStep): Promise<void> {
    switch (step.type) {
      case "ai":
        return this.speakAsAi(step.text);
      case "customer":
        return this.speakAsCustomer(step.text);
      case "tool":
        return this.runTool(step.tool_name, step.args ?? {});
      case "insight":
        return this.runTool(CALL_INSIGHT_TOOL_NAME, { intent: step.intent, sentiment: step.sentiment, summary: step.summary });
      case "await_instruction":
        return this.awaitInstruction(step);
      case "await_takeover":
        return this.awaitTakeover(step);
      case "pause":
        return this.pause(step.seconds * 1000);
    }
  }

  private async speakAsAi(text_template: string): Promise<void> {
    const text = resolveScriptPlaceholders(text_template, this.placeholder_values);
    const latency_ms = await this.measureResponseLatency();
    if (this.is_stopped || this.is_human_active) {
      return;
    }
    this.showCaption("AI", text);
    await Promise.all([
      recordTurn(this.options.call_id, { speaker: "AI", text, latency_ms }),
      this.speech_output.speak(text, "AI"),
    ]);
  }

  private async speakAsCustomer(text_template: string): Promise<void> {
    const text = resolveScriptPlaceholders(text_template, this.placeholder_values);
    this.showCaption("CUSTOMER", text);
    await Promise.all([
      recordTurn(this.options.call_id, { speaker: "CUSTOMER", text }),
      this.speech_output.speak(text, "CUSTOMER"),
    ]);
    this.customer_speech_ended_at = performance.now();
  }

  /** End of the customer's speech to the start of the AI's, for the first AI line after the customer spoke. */
  private async measureResponseLatency(): Promise<number | undefined> {
    if (this.customer_speech_ended_at === null) {
      return undefined;
    }
    await this.pause(AI_THINKING_PAUSE_MIN_MS + Math.random() * (AI_THINKING_PAUSE_MAX_MS - AI_THINKING_PAUSE_MIN_MS));
    if (this.customer_speech_ended_at === null) {
      return undefined;
    }
    const latency_ms = Math.round(performance.now() - this.customer_speech_ended_at);
    this.customer_speech_ended_at = null;
    return latency_ms;
  }

  private async runTool(tool_name: string, args_template: Record<string, unknown>): Promise<void> {
    const tool_response = await callTool(this.options.call_id, tool_name, resolveScriptArguments(args_template, this.placeholder_values));
    if (tool_response.ok) {
      this.placeholder_values[tool_name] = tool_response.result;
    }
    if (tool_name === IDENTITY_PUSH_TOOL_NAME) {
      // The wait for the customer to tap Approve is not AI response time.
      this.customer_speech_ended_at = null;
      const is_verified = tool_response.ok && tool_response.result.verified === true;
      if (!is_verified && !this.is_stopped) {
        this.is_ending_early = true;
        await this.speakAsAi(UNVERIFIED_CALLER_LINE);
      }
    }
  }

  private async awaitInstruction(step: Extract<ScriptStep, { type: "await_instruction" }>): Promise<void> {
    // An instruction whispered earlier in the call still shapes this line.
    const has_instruction = await this.waitForCondition(() => this.has_pending_instruction, step.timeout_seconds * 1000);
    if (this.is_stopped) {
      return;
    }
    this.has_pending_instruction = false;
    this.customer_speech_ended_at = null;
    await this.instruction_acknowledgement;
    await this.speakAsAi(has_instruction ? step.ai_with_instruction : step.ai_without_instruction);
  }

  private async awaitTakeover(step: Extract<ScriptStep, { type: "await_takeover" }>): Promise<void> {
    const has_staff_joined = await this.waitForCondition(() => this.is_human_active, step.timeout_seconds * 1000);
    this.customer_speech_ended_at = null;
    if (!has_staff_joined && !this.is_stopped && step.ai_if_timeout) {
      await this.speakAsAi(step.ai_if_timeout);
    }
  }

  private acknowledgeInstruction(command: CallCommand): void {
    if (command.intervention_id) {
      this.instruction_acknowledgement = confirmInstructionApplied(this.options.call_id, command.intervention_id).catch(() => undefined);
    }
    this.has_pending_instruction = true;
    this.notifyStateChanged();
  }

  private yieldToStaff(command: CallCommand): void {
    const announcement = command.text ?? DEFAULT_TAKEOVER_ANNOUNCEMENT;
    this.is_human_active = true;
    this.resume_step_index = this.findStepAfterHandoverPoint();
    this.speech_output.cancelAll();
    this.showCaption("SYSTEM", announcement);
    void this.staff_handover.announceTakeover(announcement);
    this.notifyStateChanged();
  }

  /**
   * The script marks where staff are expected to join with an `await_takeover`
   * step. Whenever they actually join, the call resumes after that point, so
   * the AI never promises a specialist who has already spoken to the customer.
   */
  private findStepAfterHandoverPoint(): number | null {
    const handover_step_index = this.options.script.steps.findIndex(
      (step, step_index) => step_index >= this.current_step_index && step.type === "await_takeover",
    );
    return handover_step_index === -1 ? null : handover_step_index + 1;
  }

  private voiceStaffMessage(text: string): void {
    this.showCaption("STAFF", text);
    void this.staff_handover.speakStaffMessage(text);
  }

  private resumeAfterHandback(command: CallCommand): void {
    if (command.intervention_id) {
      confirmInstructionApplied(this.options.call_id, command.intervention_id).catch(() => undefined);
    }
    this.is_human_active = false;
    this.staff_handover.endTakeover();
    this.notifyStateChanged();
  }

  private async finishCall(): Promise<void> {
    if (this.is_stopped) {
      return;
    }
    this.stop();
    await endCall(this.options.call_id, "AI").catch(() => undefined);
    this.options.listeners.onEnded();
  }

  private showCaption(speaker: "AI" | "CUSTOMER" | "STAFF" | "SYSTEM", text: string): void {
    this.caption_count += 1;
    this.options.listeners.onCaption({ caption_id: `scripted-${this.caption_count}`, speaker, text, is_final: true });
  }

  private pause(pause_ms: number): Promise<void> {
    return this.waitForCondition(() => false, pause_ms).then(() => undefined);
  }

  /**
   * Resolves true once the condition holds, or false on timeout or when the
   * call stops. Conditions are re-checked whenever a supervisor command or a
   * stop changes the runner's state. A null timeout waits indefinitely.
   */
  private waitForCondition(isConditionMet: () => boolean, timeout_ms: number | null): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.is_stopped || isConditionMet()) {
        resolve(!this.is_stopped);
        return;
      }
      const finishWaiting = (is_met: boolean) => {
        clearTimeout(timeout_timer);
        this.state_change_listeners.delete(checkCondition);
        resolve(is_met);
      };
      const checkCondition = () => {
        if (this.is_stopped) {
          finishWaiting(false);
        } else if (isConditionMet()) {
          finishWaiting(true);
        }
      };
      const timeout_timer = timeout_ms === null ? undefined : setTimeout(() => finishWaiting(false), timeout_ms);
      this.state_change_listeners.add(checkCondition);
    });
  }

  private notifyStateChanged(): void {
    for (const checkCondition of [...this.state_change_listeners]) {
      checkCondition();
    }
  }
}
