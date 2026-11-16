export interface ToolSuccess {
  ok: true;
  result: Record<string, unknown>;
}

export interface ToolFailure {
  ok: false;
  error: { code: string; message: string };
}

export type ToolOutcome = ToolSuccess | ToolFailure;
