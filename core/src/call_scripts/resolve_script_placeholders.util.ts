export interface ScriptPlaceholderValues {
  bank_name: string;
  // Latest successful result of each tool on this call, keyed by tool name.
  tool_results: Record<string, unknown>;
}

// {{bank_name}}, {{tool_name.path.to.value}} and, for scripts only core runs,
// {{tool_name.path|fallback text}}.
const PLACEHOLDER_PATTERN =
  /\{\{\s*([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*(?:\|([^}]*))?\}\}/g;

function readPath(root_value: unknown, path_segments: string[]): unknown {
  let current_value = root_value;
  for (const path_segment of path_segments) {
    if (current_value === null || typeof current_value !== 'object') {
      return undefined;
    }
    current_value = (current_value as Record<string, unknown>)[path_segment];
  }
  return current_value;
}

function formatValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

// A placeholder that cannot be resolved becomes its fallback, or an empty
// string: a spoken line must never contain raw braces.
export function resolveScriptPlaceholders(
  script_text: string,
  placeholder_values: ScriptPlaceholderValues,
): string {
  const resolved_text = script_text.replace(
    PLACEHOLDER_PATTERN,
    (_placeholder, value_path: string, fallback_text?: string) => {
      const [root_key, ...path_segments] = value_path.split('.');
      const resolved_value =
        root_key === 'bank_name' && path_segments.length === 0
          ? placeholder_values.bank_name
          : formatValue(
              readPath(
                placeholder_values.tool_results[root_key],
                path_segments,
              ),
            );
      return resolved_value ?? fallback_text?.trim() ?? '';
    },
  );
  return resolved_text
    .replace(/ {2,}/g, ' ')
    .replace(/ ([.,!?])/g, '$1')
    .trim();
}
