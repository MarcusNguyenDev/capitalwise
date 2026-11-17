import { Wrench } from "lucide-react";

import { formatCodeLabel, formatMilliseconds } from "@/shared/format/format_values.util";
import { describeToolResult } from "@/shared/status/describe_tool_result.util";
import { Badge } from "@/shared/ui/badge.component";
import { Disclosure } from "@/shared/ui/disclosure.component";
import { JsonView } from "@/shared/ui/json_view.component";

interface TraceToolCallProps {
  tool_name: string | null | undefined;
  tool_args: Record<string, unknown> | null | undefined;
  tool_result: Record<string, unknown> | null | undefined;
  latency_ms?: number | null;
}

/** One system check the AI made: a plain name first, what it asked and what came back on expand. */
export function TraceToolCall({ tool_name, tool_args, tool_result, latency_ms }: TraceToolCallProps) {
  const is_refused = tool_result?.ok === false;
  const result_status = describeToolResult(tool_result) ?? (is_refused ? { label: "Refused by the server", tone: "danger" as const } : { label: "Done", tone: "positive" as const });
  return (
    <Disclosure
      summary={
        <span className="flex items-center gap-2">
          <Wrench className="size-4 text-ink-faint" aria-hidden />
          {formatCodeLabel(tool_name)}
          <code className="font-mono text-xs font-normal text-ink-faint">{tool_name}</code>
        </span>
      }
      meta={
        <span className="flex items-center gap-2">
          <Badge tone={result_status.tone}>{result_status.label}</Badge>
          {latency_ms ? <span className="text-xs tabular-nums">{formatMilliseconds(latency_ms)}</span> : null}
        </span>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <JsonView label="Asked for" value={tool_args} />
        <JsonView label="Got back" value={tool_result} />
      </div>
    </Disclosure>
  );
}
