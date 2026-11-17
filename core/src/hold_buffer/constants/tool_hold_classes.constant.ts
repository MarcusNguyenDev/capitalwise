import { findToolDefinition } from '../../call_tools/constants/tool_definitions.constant';
import { CallHoldReason } from '../../calls/types/call_metrics.type';

export enum ToolHoldClass {
  // Instant and invisible to the caller: no hold.
  SILENT = 'SILENT',
  // Waits for the caller to tap Approve in their banking app.
  APP_APPROVAL = 'APP_APPROVAL',
  // Calls the bank system.
  CHECKING_SYSTEM = 'CHECKING_SYSTEM',
}

const TOOL_HOLD_CLASSES: Record<string, ToolHoldClass> = {
  get_caller_context: ToolHoldClass.SILENT,
  update_call_insight: ToolHoldClass.SILENT,
  // Identity questions are part of the conversation, never a hold.
  start_identity_check: ToolHoldClass.SILENT,
  submit_identity_answers: ToolHoldClass.SILENT,
  send_app_identity_check: ToolHoldClass.APP_APPROVAL,
};

// Every registered tool not listed above checks the system. A tool the model
// made up fails at once, so it needs no hold either.
export function classifyToolHold(tool_name: string): ToolHoldClass {
  if (!findToolDefinition(tool_name)) {
    return ToolHoldClass.SILENT;
  }
  return TOOL_HOLD_CLASSES[tool_name] ?? ToolHoldClass.CHECKING_SYSTEM;
}

// The hold reason for a batch of tool calls run together, or null when the
// whole batch is silent. Waiting for the app wins: it is what the caller must act on.
export function findHoldReason(tool_names: string[]): CallHoldReason | null {
  const hold_classes = tool_names.map(classifyToolHold);
  if (hold_classes.includes(ToolHoldClass.APP_APPROVAL)) {
    return 'WAITING_FOR_APP_APPROVAL';
  }
  return hold_classes.includes(ToolHoldClass.CHECKING_SYSTEM)
    ? 'CHECKING_SYSTEM'
    : null;
}
