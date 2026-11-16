import { formatCodeLabel, formatFactValue } from "@/shared/format/format_values.util";

const COMPACT_ENTRY_LIMIT = 3;

/** What the executor did in the bank's systems, as returned by the decision. */
export function ExecutionResultList({ execution_result, is_compact = false }: { execution_result: Record<string, unknown>; is_compact?: boolean }) {
  const result_entries = Object.entries(execution_result).filter(([, value]) => value !== null && typeof value !== "object");
  const visible_entries = is_compact ? result_entries.slice(0, COMPACT_ENTRY_LIMIT) : result_entries;
  if (visible_entries.length === 0) {
    return null;
  }
  return (
    <dl className={`mt-2 flex flex-wrap gap-x-5 gap-y-1 ${is_compact ? "text-sm" : ""}`}>
      {visible_entries.map(([key, value]) => (
        <div key={key} className="flex gap-1.5">
          <dt className="text-ink-soft">{formatCodeLabel(key)}:</dt>
          <dd className="font-mono font-semibold">{formatFactValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
