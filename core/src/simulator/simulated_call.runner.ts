import { Logger } from '@nestjs/common';

import { resolveScriptPlaceholders } from '../call_scripts/resolve_script_placeholders.util';
import {
  AwaitInstructionStep,
  AwaitTakeoverStep,
  ScriptStep,
} from '../call_scripts/types/call_script.type';
import { CallEndedError } from '../calls/errors/call_ended.error';
import { CallNotFoundError } from '../calls/errors/call_not_found.error';
import { calculateSpeakingDelayMs } from './calculate_speaking_delay.util';
import {
  END_OF_CALL_PAUSE_MS,
  IDENTITY_PUSH_APPROVAL_DELAY_MS,
  MAX_SIMULATED_LATENCY_MS,
  MIN_SIMULATED_LATENCY_MS,
  TOOL_THINKING_DELAY_MS,
} from './constants/simulator_pacing.constant';
import { SimulatedCallRunnerDependencies } from './types/simulated_call_runner_dependencies.type';

const MILLISECONDS_PER_SECOND = 1000;

interface SupervisorIntervention {
  intervention_id: string;
  type: string;
}

// Plays one script as one simulated call. Every wait is abortable, so stopping
// the simulator or resetting the demo leaves no timer behind.
export class SimulatedCallRunner {
  private readonly logger = new Logger(SimulatedCallRunner.name);
  private readonly timers = new Set<NodeJS.Timeout>();
  private readonly state_change_listeners = new Set<() => void>();
  private readonly pending_instructions: SupervisorIntervention[] = [];
  private readonly tool_results: Record<string, unknown> = {};
  private current_call_id: string | null = null;
  private is_aborted = false;
  private is_human_active = false;

  constructor(private readonly dependencies: SimulatedCallRunnerDependencies) {}

  get call_id(): string | null {
    return this.current_call_id;
  }

  get script_id(): string {
    return this.dependencies.script.script_id;
  }

  // Never rejects: a failed simulated call is logged and ended.
  async run(): Promise<void> {
    try {
      const call = await this.dependencies.createCall({
        caller_number: this.dependencies.script.caller_number,
        channel: 'SIMULATED',
        mode: 'SCRIPTED',
      });
      this.current_call_id = call.call_id;
      await this.playSteps(call.call_id);
    } catch (error) {
      await this.handleRunFailure(error);
    } finally {
      this.abort();
    }
  }

  // Stops the script where it is. The caller decides whether to end the call.
  abort(): void {
    this.is_aborted = true;
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.notifyStateChanged();
  }

  handleIntervention(intervention: SupervisorIntervention): void {
    if (this.is_aborted) {
      return;
    }
    if (intervention.type === 'INSTRUCTION') {
      this.pending_instructions.push(intervention);
    } else if (intervention.type === 'TAKEOVER') {
      this.is_human_active = true;
    } else if (intervention.type === 'HANDBACK') {
      this.is_human_active = false;
      // The handback note counts as an instruction the AI resumes with.
      this.confirmInstructionApplied(intervention.intervention_id);
    }
    this.notifyStateChanged();
  }

  // The simulated customer taps "Approve" on the identity push.
  handleIdentityPushSent(notification_id: string): void {
    this.schedule(
      IDENTITY_PUSH_APPROVAL_DELAY_MS / this.dependencies.getSpeed(),
      () => {
        this.dependencies
          .approveIdentityPush(notification_id)
          .catch((error: Error) =>
            this.logger.warn(
              `${this.script_id}: could not approve the identity push: ${error.message}`,
            ),
          );
      },
    );
  }

  private async playSteps(call_id: string): Promise<void> {
    for (const script_step of this.dependencies.script.steps) {
      await this.waitWhileHumanActive();
      if (this.is_aborted) {
        return;
      }
      await this.playStep(call_id, script_step);
    }
    await this.sleep(END_OF_CALL_PAUSE_MS / this.dependencies.getSpeed());
    await this.waitWhileHumanActive();
    if (!this.is_aborted) {
      await this.dependencies.endCall(call_id, { ended_by: 'CUSTOMER' });
    }
  }

  private async playStep(
    call_id: string,
    script_step: ScriptStep,
  ): Promise<void> {
    switch (script_step.type) {
      case 'ai':
        return this.speak(call_id, 'AI', script_step.text);
      case 'customer':
        return this.speak(call_id, 'CUSTOMER', script_step.text);
      case 'tool':
        return this.callTool(call_id, script_step.tool_name, script_step.args);
      case 'insight':
        return this.callTool(call_id, 'update_call_insight', {
          intent: script_step.intent,
          sentiment: script_step.sentiment,
          summary: script_step.summary,
        });
      case 'await_instruction':
        return this.awaitInstruction(call_id, script_step);
      case 'await_takeover':
        return this.awaitTakeover(call_id, script_step);
      case 'pause':
        return this.sleep(
          (script_step.seconds * MILLISECONDS_PER_SECOND) /
            this.dependencies.getSpeed(),
        );
    }
  }

  private async speak(
    call_id: string,
    speaker: 'AI' | 'CUSTOMER',
    script_text: string,
  ): Promise<void> {
    const spoken_text = resolveScriptPlaceholders(script_text, {
      bank_name: this.dependencies.bank_name,
      tool_results: this.tool_results,
    });
    await this.sleep(
      calculateSpeakingDelayMs(spoken_text, this.dependencies.getSpeed()),
    );
    // A supervisor who took over mid-sentence silences the script until handback.
    await this.waitWhileHumanActive();
    if (this.is_aborted) {
      return;
    }
    await this.dependencies.addTurn(call_id, {
      speaker,
      text: spoken_text,
      ...(speaker === 'AI'
        ? { latency_ms: this.pickSimulatedLatencyMs() }
        : {}),
    });
  }

  private async callTool(
    call_id: string,
    tool_name: string,
    tool_args: Record<string, unknown>,
  ): Promise<void> {
    await this.sleep(TOOL_THINKING_DELAY_MS / this.dependencies.getSpeed());
    if (this.is_aborted) {
      return;
    }
    const tool_outcome = await this.dependencies.dispatchTool(
      call_id,
      tool_name,
      tool_args,
    );
    if (tool_outcome.ok) {
      this.tool_results[tool_name] = tool_outcome.result;
    } else {
      this.logger.warn(
        `${this.script_id}: tool ${tool_name} answered ${tool_outcome.error.code}: ${tool_outcome.error.message}`,
      );
    }
  }

  private async awaitInstruction(
    call_id: string,
    script_step: AwaitInstructionStep,
  ): Promise<void> {
    const has_instruction = await this.waitUntil(
      () => this.pending_instructions.length > 0,
      script_step.timeout_seconds * MILLISECONDS_PER_SECOND,
    );
    if (this.is_aborted) {
      return;
    }
    if (!has_instruction) {
      return this.speak(call_id, 'AI', script_step.ai_without_instruction);
    }
    const applied_instructions = this.pending_instructions.splice(0);
    for (const instruction of applied_instructions) {
      await this.dependencies.markInstructionApplied(
        call_id,
        instruction.intervention_id,
      );
    }
    return this.speak(call_id, 'AI', script_step.ai_with_instruction);
  }

  private async awaitTakeover(
    call_id: string,
    script_step: AwaitTakeoverStep,
  ): Promise<void> {
    const is_taken_over = await this.waitUntil(
      () => this.is_human_active,
      script_step.timeout_seconds * MILLISECONDS_PER_SECOND,
    );
    if (this.is_aborted || is_taken_over) {
      // After a takeover the step loop waits for the handback before going on.
      return;
    }
    return this.speak(call_id, 'AI', script_step.ai_if_timeout);
  }

  private confirmInstructionApplied(intervention_id: string): void {
    if (!this.current_call_id) {
      return;
    }
    this.dependencies
      .markInstructionApplied(this.current_call_id, intervention_id)
      .catch((error: Error) =>
        this.logger.warn(
          `${this.script_id}: could not mark ${intervention_id} applied: ${error.message}`,
        ),
      );
  }

  private async waitWhileHumanActive(): Promise<void> {
    await this.waitUntil(() => !this.is_human_active, null);
  }

  // Resolves true once the condition holds, false on timeout or abort.
  private waitUntil(
    isConditionMet: () => boolean,
    timeout_ms: number | null,
  ): Promise<boolean> {
    if (this.is_aborted) {
      return Promise.resolve(false);
    }
    if (isConditionMet()) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      let timeout_timer: NodeJS.Timeout | null = null;
      const finish = (is_condition_met: boolean) => {
        this.state_change_listeners.delete(onStateChanged);
        if (timeout_timer) {
          clearTimeout(timeout_timer);
          this.timers.delete(timeout_timer);
        }
        resolve(is_condition_met);
      };
      const onStateChanged = () => {
        if (this.is_aborted) {
          finish(false);
        } else if (isConditionMet()) {
          finish(true);
        }
      };
      this.state_change_listeners.add(onStateChanged);
      if (timeout_ms !== null) {
        timeout_timer = this.schedule(timeout_ms, () => finish(false));
      }
    });
  }

  private sleep(duration_ms: number): Promise<void> {
    if (this.is_aborted) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const wakeUp = () => {
        this.state_change_listeners.delete(wakeUpIfAborted);
        resolve();
      };
      const wakeUpIfAborted = () => {
        if (this.is_aborted) {
          wakeUp();
        }
      };
      this.state_change_listeners.add(wakeUpIfAborted);
      this.schedule(duration_ms, wakeUp);
    });
  }

  private schedule(delay_ms: number, onElapsed: () => void): NodeJS.Timeout {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      onElapsed();
    }, delay_ms);
    this.timers.add(timer);
    return timer;
  }

  private notifyStateChanged(): void {
    [...this.state_change_listeners].forEach((onStateChanged) =>
      onStateChanged(),
    );
  }

  private pickSimulatedLatencyMs(): number {
    return Math.round(
      MIN_SIMULATED_LATENCY_MS +
        Math.random() * (MAX_SIMULATED_LATENCY_MS - MIN_SIMULATED_LATENCY_MS),
    );
  }

  private async handleRunFailure(error: unknown): Promise<void> {
    // The call was ended from outside (supervisor, simulator stop, demo reset).
    if (error instanceof CallEndedError || error instanceof CallNotFoundError) {
      return;
    }
    this.logger.error(
      `${this.script_id}: simulated call failed: ${(error as Error)?.message}`,
      (error as Error)?.stack,
    );
    if (!this.current_call_id) {
      return;
    }
    try {
      await this.dependencies.endCall(this.current_call_id, {
        ended_by: 'SYSTEM',
      });
    } catch (end_error) {
      this.logger.warn(
        `${this.script_id}: could not end the failed call: ${(end_error as Error).message}`,
      );
    }
  }
}
