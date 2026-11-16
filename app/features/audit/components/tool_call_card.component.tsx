import { formatMilliseconds } from "@/shared/format/format_values.util";

import { JsonBlock } from "./json_block.component";

interface ToolCallCardProps {
  tool_name: string | null | undefined;
  tool_args: Record<string, unknown> | null | undefined;
  tool_result: Record<string, unknown> | null | undefined;
  latency_ms?: number | null;
}

function hasFailed(tool_result: ToolCallCardProps["tool_result"]): boolean {
  return tool_result?.ok === false;
}

/** One function call the AI made: what it asked for and what the server returned. */
export function ToolCallCard({ tool_name, tool_args, tool_result, latency_ms }: ToolCallCardProps) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono font-semibold">
          <span className="text-ink-faint">tool · </span>
          {tool_name}
          {hasFailed(tool_result) ? <span className="ml-2 text-accent">refused by the server</span> : null}
        </p>
        {latency_ms ? <span className="font-mono text-sm text-ink-faint">{formatMilliseconds(latency_ms)}</span> : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-faint">Arguments</p>
          <JsonBlock value={tool_args ?? {}} />
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-faint">Result</p>
          <JsonBlock value={tool_result ?? {}} />
        </div>
      </div>
    </div>
  );
}
