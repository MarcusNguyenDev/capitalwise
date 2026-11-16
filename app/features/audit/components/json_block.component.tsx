export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface px-3 py-2 font-mono text-sm text-ink-soft">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
