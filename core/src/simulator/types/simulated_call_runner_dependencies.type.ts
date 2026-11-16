import { ToolOutcome } from '../../call_tools/types/tool_outcome.type';
import { CallScript } from '../../call_scripts/types/call_script.type';

// Everything a simulated call needs from the rest of core. The runner goes
// through the same call, turn and tool code paths as a real call.
export interface SimulatedCallRunnerDependencies {
  script: CallScript;
  bank_name: string;
  getSpeed: () => number;
  createCall: (new_call: {
    caller_number: string;
    channel: 'SIMULATED';
    mode: 'SCRIPTED';
  }) => Promise<{ call_id: string }>;
  addTurn: (
    call_id: string,
    new_turn: { speaker: 'AI' | 'CUSTOMER'; text: string; latency_ms?: number },
  ) => Promise<unknown>;
  dispatchTool: (
    call_id: string,
    tool_name: string,
    tool_args: Record<string, unknown>,
  ) => Promise<ToolOutcome>;
  markInstructionApplied: (
    call_id: string,
    intervention_id: string,
  ) => Promise<unknown>;
  approveIdentityPush: (notification_id: string) => Promise<unknown>;
  endCall: (
    call_id: string,
    end_call: { ended_by: 'CUSTOMER' | 'SYSTEM' },
  ) => Promise<unknown>;
}
