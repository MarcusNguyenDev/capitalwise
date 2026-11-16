import { CallRow } from '../../calls/types/call_row.type';

// The customer always comes from here (the call), never from tool arguments.
export interface ToolContext {
  call: CallRow;
}

export type ToolHandler<Args = any> = (
  tool_context: ToolContext,
  tool_args: Args,
) => Promise<Record<string, unknown>>;
