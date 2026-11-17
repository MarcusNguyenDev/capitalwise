import { ChevronRight, Wrench } from "lucide-react";

import { formatCodeLabel, formatMilliseconds } from "@/shared/format/format_values.util";
import type { CallTurn } from "@/shared/types/call.type";
import { Badge } from "@/shared/ui/badge.component";
import { JsonView } from "@/shared/ui/json_view.component";

function isFailedResult(tool_result: Record<string, unknown> | null): boolean {
  return tool_result?.ok === false || tool_result?.error !== undefined;
}

/** A system check the AI ran, inline in the transcript. Arguments and result are one click away. */
export function TranscriptToolCall({ turn }: { turn: CallTurn }) {
  const is_failed = isFailedResult(turn.tool_result);
  return (
    <details className="group animate-slide-in self-stretch rounded-md border border-line bg-canvas text-sm">
      <summary className="flex list-none items-center gap-2 px-3 py-1.5">
        <Wrench className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
        <span className="min-w-0 truncate text-ink-soft">
          {formatCodeLabel(turn.tool_name)} <code className="ml-1 font-mono text-xs text-ink-faint">{turn.tool_name}</code>
        </span>
        <Badge tone={is_failed ? "danger" : "positive"} className="ml-auto">
          {is_failed ? "Refused" : "Done"}
        </Badge>
        <span className="w-14 shrink-0 text-right text-xs tabular-nums text-ink-faint">{formatMilliseconds(turn.latency_ms)}</span>
        <ChevronRight className="size-3.5 shrink-0 text-ink-faint transition-transform group-open:rotate-90" aria-hidden />
      </summary>
      <div className="grid gap-2 border-t border-line px-3 py-2 @xl:grid-cols-2">
        <JsonView label="Asked for" value={turn.tool_args} />
        <JsonView label="Got back" value={turn.tool_result} />
      </div>
    </details>
  );
}
