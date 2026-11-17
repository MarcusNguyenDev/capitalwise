import { formatCodeLabel, formatFactValue } from "@/shared/format/format_values.util";

/** What the bank's systems did once the case was approved. */
export function ExecutionResultList({ execution_result }: { execution_result: Record<string, unknown> }) {
  const result_entries = Object.entries(execution_result).filter(([, value]) => value !== null && typeof value !== "object");
  if (result_entries.length === 0) {
    return null;
  }
  return (
    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {result_entries.map(([key, value]) => (
        <div key={key} className="flex gap-1.5">
          <dt className="text-ink-soft">{formatCodeLabel(key)}:</dt>
          <dd className="font-medium">{formatFactValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
