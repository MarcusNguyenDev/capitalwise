/** Raw data for people who need the technical detail. Scrolls rather than stretching the page. */
export function JsonView({ value, label }: { value: unknown; label?: string }) {
  return (
    <div>
      {label ? <p className="mb-1 text-xs font-semibold text-ink-faint">{label}</p> : null}
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-canvas px-3 py-2 font-mono text-xs leading-relaxed text-ink-soft">
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </div>
  );
}
