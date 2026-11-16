// Same syntax as the simulator in `core`: `{{path}}` or `{{path|fallback text}}`.
const PLACEHOLDER_PATTERN = /\{\{\s*([\w.]+)\s*(?:\|([^}]*))?\}\}/g;

function readValueAtPath(source: unknown, path_segments: string[]): unknown {
  return path_segments.reduce<unknown>(
    (current_value, segment) =>
      current_value !== null && typeof current_value === "object" ? (current_value as Record<string, unknown>)[segment] : undefined,
    source,
  );
}

/**
 * Replaces `{{tool_name.path.to.value}}` and `{{bank_name}}` in a script line.
 * A value that is missing becomes its fallback, or an empty string, so braces are never read aloud.
 */
export function resolveScriptPlaceholders(template: string, placeholder_values: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER_PATTERN, (_placeholder, value_path: string, fallback_text?: string) => {
    const resolved_value = readValueAtPath(placeholder_values, value_path.split("."));
    const is_speakable = ["string", "number", "boolean"].includes(typeof resolved_value);
    return is_speakable ? String(resolved_value) : (fallback_text?.trim() ?? "");
  });
}

/** Resolves placeholders in every string of a tool's arguments, however deeply nested. */
export function resolveScriptArguments<Value>(value: Value, placeholder_values: Record<string, unknown>): Value {
  if (typeof value === "string") {
    return resolveScriptPlaceholders(value, placeholder_values) as Value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveScriptArguments(item, placeholder_values)) as Value;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested_value]) => [key, resolveScriptArguments(nested_value, placeholder_values)]),
    ) as Value;
  }
  return value;
}
