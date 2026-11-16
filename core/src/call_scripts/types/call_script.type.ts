import { CallSentiment } from '../../calls/types/call_row.type';

export interface SpokenStep {
  type: 'ai' | 'customer';
  text: string;
}

export interface ToolStep {
  type: 'tool';
  tool_name: string;
  args: Record<string, unknown>;
}

export interface InsightStep {
  type: 'insight';
  intent?: string;
  sentiment?: CallSentiment;
  summary?: string;
}

export interface AwaitInstructionStep {
  type: 'await_instruction';
  timeout_seconds: number;
  ai_with_instruction: string;
  ai_without_instruction: string;
}

export interface AwaitTakeoverStep {
  type: 'await_takeover';
  timeout_seconds: number;
  ai_if_timeout: string;
}

export interface PauseStep {
  type: 'pause';
  seconds: number;
}

export type ScriptStep =
  | SpokenStep
  | ToolStep
  | InsightStep
  | AwaitInstructionStep
  | AwaitTakeoverStep
  | PauseStep;

// Shared by the simulator (run by core) and Scripted mode (run by the phone).
export interface CallScript {
  script_id: string;
  title: string;
  customer_id: string;
  caller_number: string;
  steps: ScriptStep[];
}

export interface CallScriptSummary {
  script_id: string;
  title: string;
  customer_id: string;
  caller_number: string;
}
