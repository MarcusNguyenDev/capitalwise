import { formatFactValue, formatMilliseconds } from "@/shared/format/format_values.util";
import type { CallTurn } from "@/shared/types/call.type";

function isFailedResult(tool_result: Record<string, unknown> | null): boolean {
  return tool_result?.ok === false || tool_result?.error !== undefined;
}

function summariseArguments(tool_args: Record<string, unknown> | null): string {
  const argument_pairs = Object.entries(tool_args ?? {}).filter(([, value]) => value !== undefined && value !== null);
  return argument_pairs.map(([name, value]) => `${name}: ${formatFactValue(value)}`).join(", ");
}

/** A tool the AI called, shown inline in the transcript: what it asked for, what came back and how long it took. */
export function ToolCallCard({ turn }: { turn: CallTurn }) {
  const is_failed = isFailedResult(turn.tool_result);
  const arguments_summary = summariseArguments(turn.tool_args);

  return (
    <details className="group animate-slide-in self-stretch rounded-xl border border-line bg-surface px-3 py-2 text-sm">
      <summary className="flex list-none items-center gap-2">
        <span className="rounded bg-ink px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">Tool</span>
        <code className="font-mono font-semibold">{turn.tool_name}</code>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${is_failed ? "bg-accent-soft text-accent" : "bg-positive-soft text-positive"}`}>
          {is_failed ? "Rejected" : "OK"}
        </span>
        <span className="ml-auto tabular-nums text-ink-faint">{formatMilliseconds(turn.latency_ms)}</span>
        <span className="text-ink-faint transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      {arguments_summary ? <p className="mt-1 truncate text-ink-soft">{arguments_summary}</p> : null}
      <p className="mt-1 truncate font-mono text-xs text-ink-soft group-open:hidden">→ {JSON.stringify(turn.tool_result ?? {})}</p>
      <div className="mt-2 hidden gap-2 group-open:grid">
        <ToolPayload label="Arguments" payload={turn.tool_args} />
        <ToolPayload label="Result" payload={turn.tool_result} />
      </div>
    </details>
  );
}

function ToolPayload({ label, payload }: { label: string; payload: Record<string, unknown> | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <pre className="mt-0.5 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-2 font-mono text-xs">
        {JSON.stringify(payload ?? {}, null, 2)}
      </pre>
    </div>
  );
}
